// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";

import {Register} from "../src/Register.sol";
import {AscVerify} from "../src/lib/AscVerify.sol";
import {AscVerifier, IAdapterAllowlist} from "../src/AscVerifier.sol";
import {EncumbranceAdapter} from "../src/adapters/EncumbranceAdapter.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib} from "../src/interfaces/INativeQueryVerifier.sol";
import {ChainInfoLib} from "../src/interfaces/IChainInfo.sol";
import {MockBlockProver, MockChainInfo} from "./mocks/MockPrecompiles.sol";

/**
 * @title EncumbranceAdapter tests
 *
 * @notice Witnessing a lien nobody filed.
 *
 * @dev A NOTE ON THE FIXTURE. The venue here is described as
 *      `Transfer(address,address,uint256)` on a real mainnet ERC-20, using the
 *      same real transaction every other suite uses. That token does not emit
 *      "pledges" and this suite does not pretend it does — what is under test is
 *      the mechanism: can a venue be described by (emitter, topic0, topic
 *      positions), proven through Attestcoin, and turned into a lien whose asset
 *      the submitter never got to choose. A three-indexed-topic event is a
 *      three-indexed-topic event, and using a real one keeps the encoder and the
 *      decoder honest in a way a hand-rolled log would not.
 *
 *      topics[0] = event signature
 *      topics[1] = from   → treated as the HOLDER
 *      topics[2] = to     → treated as the ASSET identifier
 */
contract EncumbranceAdapterTest is Test {
    uint64 constant CHAIN_KEY = 3;
    uint64 constant ETH_CHAIN_ID = 1;
    uint64 constant MIN_CONF = 64;
    uint64 constant MAX_SAMPLE_GAP = 15 minutes;
    uint64 constant RECOVERY_GRACE = 1 hours;

    uint256 constant VENUE = 1;

    Register register;
    AscVerifier verifier;
    EncumbranceAdapter enc;
    MockChainInfo chainInfo;
    MockBlockProver prover;

    address timelock = makeAddr("timelock");
    address stranger = makeAddr("stranger");

    bytes encodedTx;
    uint64 txHeight;
    address token;
    address holder;
    address asset;

    function setUp() public {
        deployCodeTo("MockPrecompiles.sol:MockBlockProver", NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        deployCodeTo("MockPrecompiles.sol:MockChainInfo", ChainInfoLib.PRECOMPILE_ADDRESS);
        prover = MockBlockProver(NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        chainInfo = MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS);

        string memory json = vm.readFile("demo/fixtures/erc20-transfer-success.json");
        encodedTx = vm.parseJsonBytes(json, ".encodedTransaction");
        txHeight = uint64(vm.parseJsonUint(json, ".blockNumber"));
        token = vm.parseJsonAddress(json, ".token");
        holder = vm.parseJsonAddress(json, ".from");
        asset = vm.parseJsonAddress(json, ".to");

        chainInfo.setChain(CHAIN_KEY, ETH_CHAIN_ID, txHeight + MIN_CONF);

        verifier = new AscVerifier(MIN_CONF, MAX_SAMPLE_GAP, RECOVERY_GRACE);
        register = new Register(AscVerify(address(verifier)), timelock);
        verifier.initialize(IAdapterAllowlist(address(register)));

        enc = new EncumbranceAdapter(verifier, timelock);

        vm.prank(timelock);
        register.queueAdapter(address(enc), true);
        vm.warp(block.timestamp + 49 hours);
        register.setAdapter(address(enc));

        _installVenue(VENUE, true);
    }

    function _installVenue(uint256 id, bool enabled) internal {
        vm.prank(timelock);
        enc.queueVenue(
            id,
            EncumbranceAdapter.Venue({
                emitter: token,
                topic0: keccak256("Transfer(address,address,uint256)"),
                assetTopic: 2,
                holderTopic: 1,
                enabled: enabled
            })
        );
        vm.warp(block.timestamp + 49 hours);
        enc.setVenue(id);
    }

    function _proof(bytes32 root) internal view returns (AscVerify.Proof memory p) {
        p.chainKey = CHAIN_KEY;
        p.height = txHeight;
        p.encodedTransaction = encodedTx;
        p.logIndex = 0;
        p.merkleProof = INativeQueryVerifier.MerkleProof({
            root: root,
            siblings: new INativeQueryVerifier.MerkleProofEntry[](0)
        });
        p.continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: bytes32(0), roots: new bytes32[](0)});
    }

    /* ─────────────────────────── the point ─────────────────────────────── */

    /// @notice A stranger witnesses a lien at a venue that never integrated anything.
    function test_WitnessesALienNobodyFiled() public {
        vm.prank(stranger);
        bytes32 ref = enc.witnessPledge(VENUE, _proof(bytes32(uint256(1))));

        assertEq(enc.lienCount(ref), 1, "lien recorded");

        EncumbranceAdapter.Lien memory l = enc.lienAt(ref, 0);
        assertEq(l.chainKey, CHAIN_KEY);
        assertEq(l.height, txHeight, "height is the source-chain height, not submission time");
        assertEq(l.emitter, token);
        assertEq(l.holder, bytes32(uint256(uint160(holder))), "holder taken from the proven topic");
    }

    /**
     * @notice The submitter cannot choose which asset the lien lands on.
     * @dev The guard is structural: `witnessPledge` takes no asset argument, so
     *      the commitment can only come from the proven log. This asserts the
     *      derivation actually matches the topic rather than anything the caller
     *      controls — if an asset parameter were ever added, this breaks.
     */
    function test_CollateralRefIsDerivedFromTheProof_NotTheCaller() public {
        vm.prank(stranger);
        bytes32 ref = enc.witnessPledge(VENUE, _proof(bytes32(uint256(1))));

        bytes32 expected = keccak256(abi.encode(CHAIN_KEY, token, bytes32(uint256(uint160(asset)))));
        assertEq(ref, expected, "ref commits to (chainKey, emitter, proven asset topic)");
    }

    /* ───────────────────────────── guards ──────────────────────────────── */

    /**
     * @notice The same pledge cannot be witnessed twice — one event, one lien.
     * @dev Asserts the SPECIFIC error, not just that something reverted. The
     *      replay key is global across adapters, so this proves the witnessed
     *      path shares the same consumed-proof map as payments rather than
     *      quietly keeping its own.
     */
    function test_Replay_IsRejected() public {
        enc.witnessPledge(VENUE, _proof(bytes32(uint256(1))));

        vm.expectPartialRevert(AscVerify.ProofAlreadyConsumed.selector);
        enc.witnessPledge(VENUE, _proof(bytes32(uint256(1))));
    }

    /// @notice A venue that is not enabled witnesses nothing.
    function test_DisabledVenue_IsRejected() public {
        vm.expectRevert(abi.encodeWithSelector(EncumbranceAdapter.VenueDisabled.selector, uint256(99)));
        enc.witnessPledge(99, _proof(bytes32(uint256(1))));
    }

    /// @notice A proof from a contract other than the venue's emitter is refused.
    function test_WrongEmitter_IsRejected() public {
        vm.prank(timelock);
        enc.queueVenue(
            2,
            EncumbranceAdapter.Venue({
                emitter: makeAddr("someOtherProtocol"),
                topic0: keccak256("Transfer(address,address,uint256)"),
                assetTopic: 2,
                holderTopic: 1,
                enabled: true
            })
        );
        vm.warp(block.timestamp + 49 hours);
        enc.setVenue(2);

        vm.expectPartialRevert(AscVerify.WrongEmitter.selector);
        enc.witnessPledge(2, _proof(bytes32(uint256(3))));
    }

    /// @notice A venue describing a topic the event does not have reverts, rather
    ///         than reading past the end and committing to garbage.
    function test_TopicOutOfRange_IsRejected() public {
        vm.prank(timelock);
        enc.queueVenue(
            3,
            EncumbranceAdapter.Venue({
                emitter: token,
                topic0: keccak256("Transfer(address,address,uint256)"),
                assetTopic: 7, // this event has 3 topics
                holderTopic: 1,
                enabled: true
            })
        );
        vm.warp(block.timestamp + 49 hours);
        enc.setVenue(3);

        vm.expectRevert(abi.encodeWithSelector(EncumbranceAdapter.TopicOutOfRange.selector, uint8(7), uint256(3)));
        enc.witnessPledge(3, _proof(bytes32(uint256(4))));
    }

    /* ──────────────────────────── governance ───────────────────────────── */

    /// @notice Only the timelock may describe a venue.
    function test_QueueVenue_RejectsNonTimelock() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(EncumbranceAdapter.NotTimelock.selector, stranger));
        enc.queueVenue(
            4,
            EncumbranceAdapter.Venue({
                emitter: token,
                topic0: bytes32(0),
                assetTopic: 0,
                holderTopic: 1,
                enabled: true
            })
        );
    }

    /**
     * @notice A queued venue cannot be activated early.
     * @dev The delay is the whole mitigation for a mis-described venue: a wrong
     *      assetTopic attributes real, proven liens to the wrong asset, which is
     *      worse than recording nothing because it looks like a finding.
     */
    function test_SetVenue_RejectedBeforeTimelockElapses() public {
        vm.prank(timelock);
        enc.queueVenue(
            5,
            EncumbranceAdapter.Venue({
                emitter: token,
                topic0: keccak256("Transfer(address,address,uint256)"),
                assetTopic: 2,
                holderTopic: 1,
                enabled: true
            })
        );

        vm.expectPartialRevert(EncumbranceAdapter.TimelockNotElapsed.selector);
        enc.setVenue(5);
    }

    /// @notice Activating a venue nobody queued reverts.
    function test_SetVenue_RejectsNothingQueued() public {
        vm.expectRevert(abi.encodeWithSelector(EncumbranceAdapter.NothingQueued.selector, uint256(42)));
        enc.setVenue(42);
    }
}
