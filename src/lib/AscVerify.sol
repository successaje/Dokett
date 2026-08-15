// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";

import {INativeQueryVerifier, NativeQueryVerifierLib} from "../interfaces/INativeQueryVerifier.sol";
import {IChainInfo, ChainInfoLib} from "../interfaces/IChainInfo.sol";

/**
 * @title AscVerify
 * @author Covenant
 * @notice The single door to the outside world for any Creditcoin contract that
 *         consumes Attestcoin Smart Contract (ASC) proofs.
 *
 * @dev Released standalone under MIT, independent of Covenant, because every ASC
 *      integration has to get the same five things right and the docs only warn
 *      about one of them:
 *
 *      1. RECEIPT STATUS. The BlockProver precompile verifies transaction
 *         *inclusion*, not *success*. A reverted ERC-20 transfer is validly
 *         included and will verify. Any contract that credits a payment without
 *         checking `receiptStatus == 1` can be satisfied by a failed transfer for
 *         the price of gas. This is the most likely real bug in ASC integrations.
 *
 *      2. REPLAY. One proven log must be consumable exactly once, ever. The key
 *         is (chainKey, height, txIndex, logIndex) — global, not per-consumer.
 *         Keying per-consumer would let one payment satisfy many obligations.
 *
 *      3. CONFIRMATION DEPTH. A proof is only admissible once the attested head
 *         has moved `minConfirmations` beyond the proven block, keeping consumed
 *         evidence clear of source-chain reorgs.
 *
 *      4. THE CLOCK. ChainInfo exposes no source-chain timestamp, and the decoded
 *         transaction carries none either. The only trustworthy time signal is the
 *         attested block HEIGHT, which the proof binds. Schedules denominated in
 *         wall-clock time are not verifiable; schedules denominated in height are.
 *
 *      5. LIVENESS. If the attestor set stalls, nobody can prove anything. A
 *         protocol that penalises the absence of proof must be able to tell
 *         "no payment" apart from "no oracle", or a stalled oracle silently
 *         becomes a mass-liquidation event. {attestationStalled} is that signal.
 *
 * @custom:security-contact security@covenant.credit
 */
abstract contract AscVerify {
    /* ─────────────────────────── types ─────────────────────────── */

    /// @notice A single-transaction ASC proof plus the log within it being claimed.
    struct Proof {
        uint64 chainKey;
        uint64 height;
        bytes encodedTransaction;
        INativeQueryVerifier.MerkleProof merkleProof;
        INativeQueryVerifier.ContinuityProof continuityProof;
        uint32 logIndex; // index into the receipt's log array
    }

    /// @notice Up to `MAX_BATCH` transactions sharing one continuity proof.
    struct BatchProof {
        uint64 chainKey;
        uint64[] heights;
        bytes[] encodedTransactions;
        INativeQueryVerifier.MerkleProof[] merkleProofs;
        INativeQueryVerifier.ContinuityProof sharedContinuityProof;
        uint32[] logIndexes;
    }

    /**
     * @dev The observation record for one source chain.
     *
     *      Height-denominated deadlines already make a stall harmless: a frozen
     *      attested head expires nothing. The hazard is RECOVERY — when a stalled
     *      head catches up it jumps, and every pending deadline becomes overdue at
     *      once, with nobody having had a chance to submit. Height cannot tell that
     *      apart from normal progress, and neither can two sparse samples.
     *
     *      So the liveness rule is about observation, not measurement:
     *        observedAt    — when we last looked
     *        lastAdvanceAt — when the head was last seen to move
     *        healthySince  — start of the current unbroken observation record;
     *                        reset by any coverage gap or stall recovery
     */
    struct HeadWatch {
        uint64 height;
        uint64 observedAt;
        uint64 lastAdvanceAt;
        uint64 healthySince;
    }

    /* ────────────────────────── constants ───────────────────────── */

    INativeQueryVerifier public constant PROVER = INativeQueryVerifier(NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
    IChainInfo public constant CHAIN_INFO = IChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS);

    /// @dev keccak256("Transfer(address,address,uint256)")
    bytes32 internal constant ERC20_TRANSFER_TOPIC = 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef;

    /// @dev The precompile's shared-continuity batch limit.
    uint256 public constant MAX_BATCH = 10;

    /* ─────────────────────────── storage ────────────────────────── */

    /// @notice keccak256(chainKey, height, txIndex, logIndex) => consumed
    mapping(bytes32 => bool) public consumedProofs;

    /// @notice chainKey => last observed attested head
    mapping(uint64 => HeadWatch) public headWatch;

    /// @notice Source-chain confirmations required before a proof is admissible.
    uint64 public immutable minConfirmations;

    /// @notice Longest gap between observations, or between head advances, that
    ///         still counts as continuous coverage.
    uint64 public immutable maxSampleGap;

    /// @notice How long the head must be observed advancing, without a gap, before
    ///         penalty paths may act again.
    uint64 public immutable recoveryGrace;

    /* ──────────────────────────── errors ────────────────────────── */

    error ChainUnknown(uint64 chainKey);
    error ChainIdMismatch(uint64 chainKey, uint64 expected, uint64 actual);
    error NotYetConfirmed(uint64 chainKey, uint64 height, uint64 attestedHead, uint64 required);
    error ProofAlreadyConsumed(bytes32 key);
    error ProofRejected();
    error UnsupportedTransactionType(uint8 txType);
    error TransactionReverted(uint8 receiptStatus);
    error LogIndexOutOfRange(uint32 logIndex, uint256 logCount);
    error BatchTooLarge(uint256 size);
    error BatchLengthMismatch();
    error WrongEmitter(address expected, address actual);
    error WrongEventSignature(bytes32 expected, bytes32 actual);
    error WrongTransferParties(address expectedFrom, address expectedTo);
    error ValueBelowMinimum(uint256 value, uint256 minimum);

    /* ───────────────────────────── init ─────────────────────────── */

    constructor(uint64 minConfirmations_, uint64 maxSampleGap_, uint64 recoveryGrace_) {
        minConfirmations = minConfirmations_;
        maxSampleGap = maxSampleGap_;
        recoveryGrace = recoveryGrace_;
    }

    /* ──────────────────────── chain / liveness ──────────────────── */

    /// @notice Highest attested source-chain height known to Creditcoin. Covenant's clock.
    function attestedHead(uint64 chainKey) public view returns (uint64) {
        IChainInfo.HeightHashResult memory r = CHAIN_INFO.get_latest_attestation_height_and_hash(chainKey);
        if (!r.exists) revert ChainUnknown(chainKey);
        return r.height;
    }

    /**
     * @notice Whether penalty paths may act on this chain right now.
     * @dev The gate for anything that can cost someone money because a proof did
     *      NOT arrive. Four ways to be refused, in order of subtlety:
     *
     *        1. never observed          — no record to reason from
     *        2. observation went stale  — we stopped watching; we cannot vouch
     *                                     for what happened while we weren't
     *        3. head is not advancing   — the oracle is stalled right now
     *        4. inside the grace window — coverage resumed too recently
     *
     *      (4) is the one that matters. Any gap resets `healthySince`, so an
     *      adversary who withholds observation and then pokes immediately before
     *      striking finds penalties still disabled. Withholding can only DELAY
     *      penalties, never accelerate them — the correct direction to fail.
     */
    function penaltiesEnabled(uint64 chainKey) public view returns (bool) {
        HeadWatch memory w = headWatch[chainKey];
        if (w.observedAt == 0) return false;
        if (block.timestamp - w.observedAt > maxSampleGap) return false;
        if (block.timestamp - w.lastAdvanceAt > maxSampleGap) return false;
        return block.timestamp - w.healthySince >= recoveryGrace;
    }

    /**
     * @notice Observability view: is the attested head currently not advancing?
     * @dev Never reports a stall without a baseline, and never reports health for a
     *      chain the precompile does not know. Not the penalty gate — that is
     *      {penaltiesEnabled}, which is strictly stricter.
     */
    function attestationStalled(uint64 chainKey) public view returns (bool) {
        IChainInfo.HeightHashResult memory r = CHAIN_INFO.get_latest_attestation_height_and_hash(chainKey);
        if (!r.exists) return true;

        HeadWatch memory w = headWatch[chainKey];
        if (w.observedAt == 0) return false; // no baseline — cannot claim a stall
        if (r.height > w.height) return false; // head is moving
        return block.timestamp - w.lastAdvanceAt > maxSampleGap;
    }

    /**
     * @notice Records the current attested head and maintains the observation record.
     * @dev Permissionless and cheap. Every state-changing proof path calls it, and
     *      keepers call it on a schedule so coverage stays continuous — an
     *      obligation cannot be penalised on a chain nobody is watching.
     */
    function pokeHead(uint64 chainKey) public returns (uint64 height) {
        IChainInfo.HeightHashResult memory r = CHAIN_INFO.get_latest_attestation_height_and_hash(chainKey);
        if (!r.exists) revert ChainUnknown(chainKey);

        HeadWatch storage w = headWatch[chainKey];
        uint64 nowTs = uint64(block.timestamp);

        if (w.observedAt == 0) {
            // First sight of this chain: coverage starts now, not retroactively.
            w.healthySince = nowTs;
            w.lastAdvanceAt = nowTs;
        } else {
            if (nowTs - w.observedAt > maxSampleGap) {
                // We stopped watching. Whatever happened in the gap is unknown, so
                // the observation record restarts.
                w.healthySince = nowTs;
            }
            if (r.height > w.height) {
                if (nowTs - w.lastAdvanceAt > maxSampleGap) {
                    // The head was stalled and is now catching up. This is exactly
                    // the jump that would otherwise expire every pending deadline
                    // at once, so the record restarts here too.
                    w.healthySince = nowTs;
                }
                w.lastAdvanceAt = nowTs;
                w.height = r.height;
            }
        }

        w.observedAt = nowTs;
        return r.height;
    }

    /**
     * @notice Asserts a chainKey really refers to the expected chain id.
     * @dev Chainkeys are NOT stable across environments: Ethereum mainnet is
     *      chainkey 3 on CC3 testnet and chainkey 1 on CC3 mainnet. Hardcoding one
     *      silently verifies proofs against the wrong chain. Deploy scripts call this.
     */
    function assertChainId(uint64 chainKey, uint64 expectedChainId) public view {
        IChainInfo.ChainInfoResult memory r = CHAIN_INFO.get_chain_by_key(chainKey);
        if (!r.exists) revert ChainUnknown(chainKey);
        if (r.info.chainId != expectedChainId) revert ChainIdMismatch(chainKey, expectedChainId, r.info.chainId);
    }

    /* ───────────────────────── verification ─────────────────────── */

    /**
     * @notice Verifies one ASC proof and returns the claimed log.
     * @dev Order matters. The replay key is reserved BEFORE the external precompile
     *      call so a reentrant caller cannot consume the same log twice; a failed
     *      verification reverts and rolls the reservation back.
     * @return log The log at `p.logIndex` of the proven transaction's receipt.
     */
    function _verify(Proof calldata p) internal returns (EvmV1Decoder.LogEntry memory log) {
        pokeHead(p.chainKey);
        _requireConfirmed(p.chainKey, p.height);

        uint64 txIndex = PROVER.calculateTxIndex(p.merkleProof);
        _consume(p.chainKey, p.height, txIndex, p.logIndex);

        bool ok = PROVER.verifyAndEmit(p.chainKey, p.height, p.encodedTransaction, p.merkleProof, p.continuityProof);
        if (!ok) revert ProofRejected();

        return _extractLog(p.encodedTransaction, p.logIndex);
    }

    /**
     * @notice Verifies up to {MAX_BATCH} proofs sharing a single continuity proof.
     * @dev The continuity proof is the expensive part of a query — it is what grows
     *      with the age of the evidence. Amortising one across ten transactions is
     *      the difference between sweeping a registry per-obligation and per-block.
     */
    function _verifyBatch(BatchProof calldata p) internal returns (EvmV1Decoder.LogEntry[] memory logs) {
        uint256 n = p.heights.length;
        if (n > MAX_BATCH) revert BatchTooLarge(n);
        if (n != p.encodedTransactions.length || n != p.merkleProofs.length || n != p.logIndexes.length) {
            revert BatchLengthMismatch();
        }

        pokeHead(p.chainKey);

        for (uint256 i; i < n; ++i) {
            _requireConfirmed(p.chainKey, p.heights[i]);
            uint64 txIndex = PROVER.calculateTxIndex(p.merkleProofs[i]);
            _consume(p.chainKey, p.heights[i], txIndex, p.logIndexes[i]);
        }

        bool ok = PROVER.verifyAndEmit(
            p.chainKey, p.heights, p.encodedTransactions, p.merkleProofs, p.sharedContinuityProof
        );
        if (!ok) revert ProofRejected();

        logs = new EvmV1Decoder.LogEntry[](n);
        for (uint256 i; i < n; ++i) {
            logs[i] = _extractLog(p.encodedTransactions[i], p.logIndexes[i]);
        }
    }

    /* ──────────────────────── log matching ──────────────────────── */

    /**
     * @notice Requires that `log` is an ERC-20 Transfer matching the expected
     *         token, sender and recipient, for at least `minValue`.
     * @dev The emitter check is not optional. Without it, anyone can deploy a
     *      contract that emits a well-formed Transfer event with arbitrary
     *      parameters and prove it. The event is only meaningful as a payment
     *      because a specific token contract emitted it.
     */
    function _requireErc20Transfer(
        EvmV1Decoder.LogEntry memory log,
        address token,
        address from,
        address to,
        uint256 minValue
    ) internal pure returns (uint256 value) {
        if (log.address_ != token) revert WrongEmitter(token, log.address_);
        if (log.topics.length != 3) revert WrongEventSignature(ERC20_TRANSFER_TOPIC, bytes32(0));
        if (log.topics[0] != ERC20_TRANSFER_TOPIC) revert WrongEventSignature(ERC20_TRANSFER_TOPIC, log.topics[0]);

        if (address(uint160(uint256(log.topics[1]))) != from || address(uint160(uint256(log.topics[2]))) != to) {
            revert WrongTransferParties(from, to);
        }

        value = abi.decode(log.data, (uint256));
        if (value < minValue) revert ValueBelowMinimum(value, minValue);
    }

    /* ───────────────────────── internals ────────────────────────── */

    function _requireConfirmed(uint64 chainKey, uint64 height) internal view {
        uint64 head = attestedHead(chainKey);
        uint64 required = height + minConfirmations;
        if (head < required) revert NotYetConfirmed(chainKey, height, head, required);
    }

    function _consume(uint64 chainKey, uint64 height, uint64 txIndex, uint32 logIndex) internal {
        bytes32 key = proofKey(chainKey, height, txIndex, logIndex);
        if (consumedProofs[key]) revert ProofAlreadyConsumed(key);
        consumedProofs[key] = true;
    }

    /// @notice The global identity of one provable log.
    function proofKey(uint64 chainKey, uint64 height, uint64 txIndex, uint32 logIndex)
        public
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(chainKey, height, txIndex, logIndex));
    }

    /**
     * @dev Decodes the receipt, enforces success, and returns the requested log.
     *      `EvmV1Decoder` exposes `public` library functions, so these are
     *      delegatecalls into a linked library — it must be deployed and linked.
     */
    function _extractLog(bytes memory encodedTransaction, uint32 logIndex)
        internal
        pure
        returns (EvmV1Decoder.LogEntry memory)
    {
        uint8 txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        if (!EvmV1Decoder.isValidTransactionType(txType)) revert UnsupportedTransactionType(txType);

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);

        // ── THE FOOTGUN ──
        // The precompile proves inclusion, not success. Without this line a
        // reverted transfer clears a payment window for the price of gas.
        if (receipt.receiptStatus != 1) revert TransactionReverted(receipt.receiptStatus);

        if (logIndex >= receipt.receiptLogs.length) {
            revert LogIndexOutOfRange(logIndex, receipt.receiptLogs.length);
        }
        return receipt.receiptLogs[logIndex];
    }
}
