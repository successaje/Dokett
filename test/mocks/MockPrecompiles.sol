// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {INativeQueryVerifier} from "../../src/interfaces/INativeQueryVerifier.sol";
import {IChainInfo} from "../../src/interfaces/IChainInfo.sol";

/**
 * @notice Stand-in for the BlockProver precompile at 0x…0FD2.
 * @dev It deliberately ALWAYS returns true for a well-formed call. The point of
 *      the suite is not to re-test Creditcoin's proof verification — it is to
 *      prove that AscVerify still refuses evidence the precompile happily accepts,
 *      which is exactly the case for a reverted transaction.
 */
contract MockBlockProver is INativeQueryVerifier {
    bool public accept = true;
    uint64 public txIndex = 7;

    function setAccept(bool v) external {
        accept = v;
    }

    function setTxIndex(uint64 v) external {
        txIndex = v;
    }

    function verify(uint64, uint64, bytes calldata, MerkleProof calldata, ContinuityProof calldata)
        external
        view
        returns (bool)
    {
        return accept;
    }

    function verify(uint64, uint64[] calldata, bytes[] calldata, MerkleProof[] calldata, ContinuityProof calldata)
        external
        view
        returns (bool)
    {
        return accept;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external returns (bool) {
        emit TransactionVerified(chainKey, height, txIndex);
        return accept;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64[] calldata heights,
        bytes[] calldata,
        MerkleProof[] calldata,
        ContinuityProof calldata
    ) external returns (bool) {
        for (uint256 i; i < heights.length; ++i) {
            emit TransactionVerified(chainKey, heights[i], txIndex);
        }
        return accept;
    }

    /// @dev Returns a distinct index per Merkle root so batch entries don't collide.
    function calculateTxIndex(MerkleProof calldata merkleProof) external view returns (uint64) {
        if (merkleProof.root == bytes32(0)) return txIndex;
        return uint64(uint256(merkleProof.root));
    }
}

/**
 * @notice Stand-in for the ChainInfo precompile at 0x…0FD3.
 * @dev Only the pieces Covenant relies on carry behaviour; the rest satisfy the
 *      interface so any signature drift is caught at compile time.
 */
contract MockChainInfo is IChainInfo {
    mapping(uint64 => uint64) public head;
    mapping(uint64 => uint64) public chainIdOf;
    mapping(uint64 => bool) public known;

    function setChain(uint64 chainKey, uint64 chainId, uint64 head_) external {
        known[chainKey] = true;
        chainIdOf[chainKey] = chainId;
        head[chainKey] = head_;
    }

    function setHead(uint64 chainKey, uint64 head_) external {
        head[chainKey] = head_;
    }

    function forget(uint64 chainKey) external {
        known[chainKey] = false;
    }

    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory r)
    {
        r.height = head[chainKey];
        r.hash = bytes32(uint256(head[chainKey]));
        r.isAttestation = true;
        r.exists = known[chainKey];
    }

    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfoResult memory r) {
        r.info = ChainInfo({chainKey: chainKey, chainId: chainIdOf[chainKey], chainName: "mock", chainEncoding: 0});
        r.exists = known[chainKey];
    }

    function is_height_attested(uint64 chainKey, uint64 targetHeight) external view returns (bool) {
        return known[chainKey] && targetHeight <= head[chainKey];
    }

    /* ── interface completeness: unused by Covenant ── */

    function get_latest_checkpoint_height_and_hash(uint64) external pure returns (HeightHashResult memory r) {}
    function find_highest_attested_before(uint64, uint64) external pure returns (HeightHashResult memory r) {}
    function find_lowest_attested_after(uint64, uint64) external pure returns (HeightHashResult memory r) {}
    function get_attestation_bounds(uint64, uint64) external pure returns (BoundsCheckResult memory r) {}
    function get_attestation_genesis_height(uint64) external pure returns (uint64) {}
    function get_attestation_height_for_digest(uint64, bytes32) external pure returns (HeightResult memory r) {}
    function get_checkpoint_for_height(uint64, uint64) external pure returns (HashResult memory r) {}
    function get_supported_chains() external pure returns (ChainInfo[] memory c) {}
}
