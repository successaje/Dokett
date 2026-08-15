// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title INativeQueryVerifier
 * @notice The Creditcoin ASC BlockProver precompile.
 * @dev Address 0x…0FD2. Compiled Rust, not EVM bytecode.
 *
 *      Transcribed from the shipped ABI in the usc-sdk npm package
 *      (src/block-prover/block_prover.json, v0.18.0) rather than from prose docs,
 *      so the batch overloads and `calculateTxIndex` are exact.
 *
 * @custom:security This precompile verifies transaction INCLUSION only. It does
 *      NOT validate whether the proven transaction succeeded. A reverted transfer
 *      is still validly included and will verify. Callers MUST decode the receipt
 *      and require `receiptStatus == 1`. See {AscVerify}.
 */
interface INativeQueryVerifier {
    /// @notice Emitted by the `verifyAndEmit` variants on success.
    event TransactionVerified(uint64 indexed chainKey, uint64 indexed height, uint64 transactionIndex);

    struct MerkleProofEntry {
        bytes32 hash;
        bool isLeft;
    }

    struct MerkleProof {
        bytes32 root;
        MerkleProofEntry[] siblings;
    }

    struct ContinuityProof {
        bytes32 lowerEndpointDigest;
        bytes32[] roots;
    }

    /// @notice Read-only verification of a single transaction.
    function verify(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external view returns (bool);

    /// @notice Read-only batch verification sharing one continuity proof (max 10).
    function verify(
        uint64 chainKey,
        uint64[] calldata heights,
        bytes[] calldata encodedTransactions,
        MerkleProof[] calldata merkleProofs,
        ContinuityProof calldata sharedContinuityProof
    ) external view returns (bool);

    /// @notice State-changing verification; emits {TransactionVerified}.
    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata encodedTransaction,
        MerkleProof calldata merkleProof,
        ContinuityProof calldata continuityProof
    ) external returns (bool);

    /// @notice State-changing batch verification sharing one continuity proof (max 10).
    function verifyAndEmit(
        uint64 chainKey,
        uint64[] calldata heights,
        bytes[] calldata encodedTransactions,
        MerkleProof[] calldata merkleProofs,
        ContinuityProof calldata sharedContinuityProof
    ) external returns (bool);

    /// @notice Derives the transaction's index within its block from the Merkle path.
    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64);
}

library NativeQueryVerifierLib {
    address internal constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000FD2;

    function getVerifier() internal pure returns (INativeQueryVerifier) {
        return INativeQueryVerifier(PRECOMPILE_ADDRESS);
    }
}
