// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";

import {AscVerify} from "../src/lib/AscVerify.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib} from "../src/interfaces/INativeQueryVerifier.sol";
import {IChainInfo, ChainInfoLib} from "../src/interfaces/IChainInfo.sol";
import {MockBlockProver, MockChainInfo} from "./mocks/MockPrecompiles.sol";

contract AscVerifyHarness is AscVerify {
    constructor(uint64 minConf, uint64 gap, uint64 grace) AscVerify(minConf, gap, grace) {}

    function verify(Proof calldata p) external returns (EvmV1Decoder.LogEntry memory) {
        return _verify(p);
    }

    function verifyBatch(BatchProof calldata p) external returns (EvmV1Decoder.LogEntry[] memory) {
        return _verifyBatch(p);
    }

    function requireErc20Transfer(
        EvmV1Decoder.LogEntry memory log,
        address token,
        address from,
        address to,
        uint256 minValue
    ) external pure returns (uint256) {
        return _requireErc20Transfer(log, token, from, to, minValue);
    }
}

/**
 * @title AscVerify tests
 * @notice Every fixture here is a REAL Ethereum mainnet transaction, fetched and
 *         encoded by demo/gen-fixtures.js with the same SDK the keeper uses.
 *         Hand-rolled bytes would only prove our encoder agrees with our decoder.
 */
contract AscVerifyTest is Test {
    uint64 constant CHAIN_KEY = 3; // Ethereum mainnet on CC3 testnet
    uint64 constant ETH_CHAIN_ID = 1;
    uint64 constant MIN_CONF = 64;
    uint64 constant MAX_SAMPLE_GAP = 15 minutes;
    uint64 constant RECOVERY_GRACE = 1 hours;

    AscVerifyHarness harness;
    MockBlockProver prover;
    MockChainInfo chainInfo;

    struct Fixture {
        bytes encodedTransaction;
        uint64 blockNumber;
        address token;
        address from;
        address to;
        uint256 value;
        string txHash;
    }

    Fixture success;
    Fixture reverted;
    Fixture legacy;

    function setUp() public {
        // Put the mocks at the real precompile addresses so the code under test is
        // unmodified — it still calls 0x…0FD2 and 0x…0FD3.
        deployCodeTo("MockPrecompiles.sol:MockBlockProver", NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        deployCodeTo("MockPrecompiles.sol:MockChainInfo", ChainInfoLib.PRECOMPILE_ADDRESS);
        prover = MockBlockProver(NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        chainInfo = MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS);

        harness = new AscVerifyHarness(MIN_CONF, MAX_SAMPLE_GAP, RECOVERY_GRACE);

        success = _load("erc20-transfer-success.json", true);
        reverted = _load("tx-reverted.json", false);
        legacy = _load("erc20-transfer-legacy.json", true);

        chainInfo.setChain(CHAIN_KEY, ETH_CHAIN_ID, success.blockNumber + MIN_CONF);
        vm.warp(1 days);
    }

    function _load(string memory name, bool withTransfer) internal view returns (Fixture memory f) {
        string memory json = vm.readFile(string.concat("demo/fixtures/", name));
        f.encodedTransaction = vm.parseJsonBytes(json, ".encodedTransaction");
        f.blockNumber = uint64(vm.parseJsonUint(json, ".blockNumber"));
        f.txHash = vm.parseJsonString(json, ".txHash");
        if (withTransfer) {
            f.token = vm.parseJsonAddress(json, ".token");
            f.from = vm.parseJsonAddress(json, ".from");
            f.to = vm.parseJsonAddress(json, ".to");
            f.value = vm.parseJsonUint(json, ".value");
        }
    }

    function _proof(Fixture memory f, uint32 logIndex, bytes32 root)
        internal
        pure
        returns (AscVerify.Proof memory p)
    {
        p.chainKey = CHAIN_KEY;
        p.height = f.blockNumber;
        p.encodedTransaction = f.encodedTransaction;
        p.logIndex = logIndex;
        p.merkleProof = INativeQueryVerifier.MerkleProof({
            root: root,
            siblings: new INativeQueryVerifier.MerkleProofEntry[](0)
        });
        p.continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: bytes32(0), roots: new bytes32[](0)});
    }

    /* ───────────────────────── happy path ───────────────────────── */

    /// @notice A real mainnet ERC-20 Transfer decodes and matches its own parameters.
    function test_HappyPath_DecodesRealMainnetTransfer() public {
        EvmV1Decoder.LogEntry memory log = harness.verify(_proof(success, 0, bytes32(uint256(1))));

        assertEq(log.address_, success.token, "log emitter should be the token");
        uint256 value = harness.requireErc20Transfer(log, success.token, success.from, success.to, 0);
        assertEq(value, success.value, "decoded value should match the real transfer");
    }

    /**
     * @notice A LEGACY (type 0) mainnet transfer decodes identically to type 2.
     *
     * @dev Both other fixtures are EIP-1559 type 2, so the decoder's legacy
     *      branch was never exercised — the suite would have passed while
     *      pre-1559 transactions failed on chain. Ethereum still carries plenty
     *      of them, and a registry that silently rejected legacy payments would
     *      wrongly default the borrowers who make them.
     *
     *      Found by measuring gas against a real type 0 transaction: it came in
     *      3,608 gas under the model fitted to type 2 fixtures, which turned out
     *      to be its 128 fewer encoded bytes at ~28 gas/byte.
     */
    function test_LegacyTransactionType_DecodesIdentically() public {
        chainInfo.setHead(CHAIN_KEY, legacy.blockNumber + MIN_CONF);

        EvmV1Decoder.LogEntry memory log = harness.verify(_proof(legacy, 0, bytes32(uint256(7))));

        assertEq(log.address_, legacy.token, "legacy log emitter");
        uint256 value = harness.requireErc20Transfer(log, legacy.token, legacy.from, legacy.to, 0);
        assertEq(value, legacy.value, "legacy transfer value must decode exactly as type 2 does");
    }

    /* ───────────────── the footgun: T-02 regression ─────────────── */

    /**
     * @notice A REVERTED mainnet transaction must be rejected even though the
     *         precompile accepts it — and must be rejected FOR THAT REASON.
     *
     * @dev The mock prover returns true here, exactly as the real precompile does:
     *      it proves inclusion, not success.
     *
     *      Mutation-tested finding, recorded because it corrects a claim that is
     *      easy to make loosely: deleting the receiptStatus guard does not let this
     *      fixture through — it fails later with LogIndexOutOfRange(0, 0), because
     *      a reverted transaction carries NO logs (logs are discarded on revert).
     *      So for log-matching adapters the log-count check is an accidental
     *      backstop.
     *
     *      The guard is still load-bearing, for two reasons:
     *        1. Adapters that match on transaction fields rather than logs — a
     *           native-value repayment, or calldata inspection — have no such
     *           backstop. A reverted plain transfer still decodes a clean
     *           {from, to, value} and would be credited.
     *        2. Failing on the real reason beats failing by luck. Asserting the
     *           specific error pins the ORDERING: status is checked before any
     *           log is touched, so no future adapter can inherit the accident.
     *
     *      Hence expectRevert on TransactionReverted specifically, not just any revert.
     */
    function test_RevertedTransaction_IsRejectedForTheRightReason() public {
        assertTrue(prover.accept(), "precompile mock accepts the proof, as the real one would");

        vm.expectRevert(abi.encodeWithSelector(AscVerify.TransactionReverted.selector, uint8(0)));
        harness.verify(_proof(reverted, 0, bytes32(uint256(2))));
    }

    /* ───────────────────────── replay ───────────────────────────── */

    function test_Replay_IsRejected() public {
        AscVerify.Proof memory p = _proof(success, 0, bytes32(uint256(1)));
        harness.verify(p);

        bytes32 key = harness.proofKey(CHAIN_KEY, success.blockNumber, uint64(1), 0);
        assertTrue(harness.consumedProofs(key), "proof should be recorded as consumed");

        vm.expectRevert(abi.encodeWithSelector(AscVerify.ProofAlreadyConsumed.selector, key));
        harness.verify(p);
    }

    /* ─────────────────── confirmation depth ─────────────────────── */

    function test_ConfirmationDepth_Enforced() public {
        chainInfo.setHead(CHAIN_KEY, success.blockNumber + MIN_CONF - 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                AscVerify.NotYetConfirmed.selector,
                CHAIN_KEY,
                success.blockNumber,
                success.blockNumber + MIN_CONF - 1,
                success.blockNumber + MIN_CONF
            )
        );
        harness.verify(_proof(success, 0, bytes32(uint256(1))));
    }

    function test_DeepHistory_IsAdmissible() public {
        // Evidence two years old is still admissible — the head is simply far ahead.
        chainInfo.setHead(CHAIN_KEY, success.blockNumber + 5_000_000);
        EvmV1Decoder.LogEntry memory log = harness.verify(_proof(success, 0, bytes32(uint256(1))));
        assertEq(log.address_, success.token);
    }

    /* ──────────────────── liveness / stall ──────────────────────── */

    /// @dev Simulates a keeper watching the chain: poke, advance the head, repeat.
    function _observe(uint64 seconds_, uint64 blocksPerPoke) internal {
        uint64 head = chainInfo.head(CHAIN_KEY);
        // `<=` not `<`: the first poke inside the loop is what starts the record,
        // so the window has to run one sample past `seconds_` to actually cover it.
        for (uint64 t = 0; t <= seconds_; t += MAX_SAMPLE_GAP / 2) {
            vm.warp(block.timestamp + MAX_SAMPLE_GAP / 2);
            head += blocksPerPoke;
            chainInfo.setHead(CHAIN_KEY, head);
            harness.pokeHead(CHAIN_KEY);
        }
    }

    function test_AttestationStall_Detected() public {
        _observe(RECOVERY_GRACE, 40);
        assertFalse(harness.attestationStalled(CHAIN_KEY), "advancing head is not a stall");

        vm.warp(block.timestamp + MAX_SAMPLE_GAP + 1);
        assertTrue(harness.attestationStalled(CHAIN_KEY), "head frozen past the threshold is a stall");

        chainInfo.setHead(CHAIN_KEY, chainInfo.head(CHAIN_KEY) + 1);
        assertFalse(harness.attestationStalled(CHAIN_KEY), "advancing head clears the stall");
    }

    function test_StallNeverClaimedWithoutBaseline() public view {
        assertFalse(harness.attestationStalled(CHAIN_KEY));
    }

    function test_UnknownChain_ReadsAsStalled() public {
        chainInfo.forget(CHAIN_KEY);
        assertTrue(harness.attestationStalled(CHAIN_KEY), "unknown chain must never read as healthy");
    }

    /* ─────────── I7: penalties require continuous observation ───────── */

    /**
     * @notice Nothing may be penalised on a chain nobody has looked at.
     * @dev The default answer is "no". A registry that penalises by default when
     *      its evidence layer is unobserved is worse than one that stalls.
     */
    function test_Penalties_DisabledWithoutObservation() public view {
        assertFalse(harness.penaltiesEnabled(CHAIN_KEY));
    }

    /// @notice One poke is not coverage — the grace window must still elapse.
    function test_Penalties_DisabledUntilGraceElapses() public {
        harness.pokeHead(CHAIN_KEY);
        assertFalse(harness.penaltiesEnabled(CHAIN_KEY), "a single sample is not a record");

        _observe(RECOVERY_GRACE, 40);
        assertTrue(harness.penaltiesEnabled(CHAIN_KEY), "continuous coverage enables penalties");
    }

    /**
     * @notice THE ATTACK (I7). A stalled head catches up in one jump. Every pending
     *         deadline becomes overdue at once, and nobody had a chance to submit.
     *         Penalties must refuse until coverage has been re-established.
     */
    function test_Penalties_DisabledAfterStallRecovery() public {
        _observe(RECOVERY_GRACE, 40);
        assertTrue(harness.penaltiesEnabled(CHAIN_KEY), "healthy before the stall");

        // Oracle stops. Wall time passes; the head does not move.
        vm.warp(block.timestamp + 6 hours);
        assertFalse(harness.penaltiesEnabled(CHAIN_KEY), "stalled: penalties disabled");

        // Recovery: the head jumps forward by six hours of Ethereum blocks.
        chainInfo.setHead(CHAIN_KEY, chainInfo.head(CHAIN_KEY) + 1800);
        harness.pokeHead(CHAIN_KEY);
        assertFalse(harness.penaltiesEnabled(CHAIN_KEY), "catch-up jump must not enable penalties");

        _observe(RECOVERY_GRACE, 40);
        assertTrue(harness.penaltiesEnabled(CHAIN_KEY), "re-enabled only after fresh coverage");
    }

    /**
     * @notice The adversarial case: withhold observation, then poke immediately
     *         before striking. Withholding must only ever DELAY penalties.
     */
    function test_Penalties_CannotBeAcceleratedByWithholdingObservation() public {
        _observe(RECOVERY_GRACE, 40);
        assertTrue(harness.penaltiesEnabled(CHAIN_KEY));

        // Attacker stops poking, lets the chain run, then pokes once and strikes.
        vm.warp(block.timestamp + 3 hours);
        chainInfo.setHead(CHAIN_KEY, chainInfo.head(CHAIN_KEY) + 900);
        harness.pokeHead(CHAIN_KEY);

        assertFalse(harness.penaltiesEnabled(CHAIN_KEY), "a fresh sample is not a fresh record");
    }

    /* ─────────────────── configuration guards ───────────────────── */

    /// @notice T-14: chainkeys differ per environment; a mismatch must be loud.
    function test_AssertChainId_CatchesMisconfiguration() public {
        harness.assertChainId(CHAIN_KEY, ETH_CHAIN_ID);

        vm.expectRevert(abi.encodeWithSelector(AscVerify.ChainIdMismatch.selector, CHAIN_KEY, uint64(11155111), ETH_CHAIN_ID));
        harness.assertChainId(CHAIN_KEY, 11155111); // Sepolia
    }

    /* ───────────────────── log matching ─────────────────────────── */

    /// @notice Without the emitter check, anyone can deploy a contract that emits a
    ///         well-formed Transfer event with arbitrary parameters and prove it.
    function test_WrongEmitter_IsRejected() public {
        EvmV1Decoder.LogEntry memory log = harness.verify(_proof(success, 0, bytes32(uint256(1))));

        address impostor = address(0xdead);
        vm.expectRevert(abi.encodeWithSelector(AscVerify.WrongEmitter.selector, impostor, success.token));
        harness.requireErc20Transfer(log, impostor, success.from, success.to, 0);
    }

    function test_WrongParties_IsRejected() public {
        EvmV1Decoder.LogEntry memory log = harness.verify(_proof(success, 0, bytes32(uint256(1))));

        vm.expectRevert(
            abi.encodeWithSelector(AscVerify.WrongTransferParties.selector, address(0xbeef), success.to)
        );
        harness.requireErc20Transfer(log, success.token, address(0xbeef), success.to, 0);
    }

    function test_ValueBelowMinimum_IsRejected() public {
        EvmV1Decoder.LogEntry memory log = harness.verify(_proof(success, 0, bytes32(uint256(1))));

        uint256 tooMuch = success.value + 1;
        vm.expectRevert(abi.encodeWithSelector(AscVerify.ValueBelowMinimum.selector, success.value, tooMuch));
        harness.requireErc20Transfer(log, success.token, success.from, success.to, tooMuch);
    }

    function test_LogIndexOutOfRange_IsRejected() public {
        vm.expectRevert(abi.encodeWithSelector(AscVerify.LogIndexOutOfRange.selector, uint32(99), uint256(1)));
        harness.verify(_proof(success, 99, bytes32(uint256(1))));
    }

    /* ───────────────────────── batching ─────────────────────────── */

    /// @notice One continuity proof amortised across several transactions.
    function test_Batch_SharesOneContinuityProof() public {
        AscVerify.BatchProof memory b;
        b.chainKey = CHAIN_KEY;
        b.heights = new uint64[](2);
        b.encodedTransactions = new bytes[](2);
        b.merkleProofs = new INativeQueryVerifier.MerkleProof[](2);
        b.logIndexes = new uint32[](2);

        for (uint256 i; i < 2; ++i) {
            b.heights[i] = success.blockNumber;
            b.encodedTransactions[i] = success.encodedTransaction;
            // distinct roots => distinct txIndex => distinct replay keys
            b.merkleProofs[i] = INativeQueryVerifier.MerkleProof({
                root: bytes32(uint256(100 + i)),
                siblings: new INativeQueryVerifier.MerkleProofEntry[](0)
            });
            b.logIndexes[i] = 0;
        }
        b.sharedContinuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: bytes32(0), roots: new bytes32[](0)});

        EvmV1Decoder.LogEntry[] memory logs = harness.verifyBatch(b);
        assertEq(logs.length, 2);
        assertEq(logs[0].address_, success.token);
        assertEq(logs[1].address_, success.token);
    }

    function test_Batch_RejectsOversize() public {
        AscVerify.BatchProof memory b;
        b.chainKey = CHAIN_KEY;
        b.heights = new uint64[](11);
        b.encodedTransactions = new bytes[](11);
        b.merkleProofs = new INativeQueryVerifier.MerkleProof[](11);
        b.logIndexes = new uint32[](11);

        vm.expectRevert(abi.encodeWithSelector(AscVerify.BatchTooLarge.selector, uint256(11)));
        harness.verifyBatch(b);
    }
}
