// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title IChainInfo
 * @notice The Creditcoin ASC ChainInfo precompile.
 * @dev Address 0x…0FD3. Transcribed from the shipped ABI in the usc-sdk npm
 *      package (src/chain-info/chain_info.json, v0.18.0). Names are snake_case
 *      in the precompile ABI and are preserved verbatim — do not "fix" them.
 *
 *      Note what this precompile does NOT expose: any source-chain timestamp.
 *      The only trustworthy time signal available to a contract is the attested
 *      block HEIGHT. Covenant's schedules are therefore denominated in source
 *      chain block height, never in wall-clock time. See {AscVerify}.
 */
interface IChainInfo {
    struct ChainInfo {
        uint64 chainKey;
        uint64 chainId;
        bytes chainName;
        uint8 chainEncoding;
    }

    struct ChainInfoResult {
        ChainInfo info;
        bool exists;
    }

    struct HeightHashResult {
        uint64 height;
        bytes32 hash;
        bool isAttestation;
        bool exists;
    }

    struct HeightResult {
        uint64 height;
        bool exists;
    }

    struct HashResult {
        bytes32 hash;
        bool exists;
    }

    struct BoundsCheckResult {
        uint64 parentHeight;
        bytes32 parentHash;
        bool parentIsAttestation;
        uint64 childHeight;
        bytes32 childHash;
        bool childIsAttestation;
        bool isAttested;
    }

    /// @notice Highest attested height for a chain — Covenant's clock.
    function get_latest_attestation_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory result);

    function get_latest_checkpoint_height_and_hash(uint64 chainKey)
        external
        view
        returns (HeightHashResult memory result);

    function is_height_attested(uint64 chainKey, uint64 targetHeight) external view returns (bool isAttested);

    function find_highest_attested_before(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (HeightHashResult memory result);

    function find_lowest_attested_after(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (HeightHashResult memory result);

    function get_attestation_bounds(uint64 chainKey, uint64 targetHeight)
        external
        view
        returns (BoundsCheckResult memory result);

    function get_attestation_genesis_height(uint64 chainKey) external view returns (uint64 genesisHeight);

    function get_attestation_height_for_digest(uint64 chainKey, bytes32 digest)
        external
        view
        returns (HeightResult memory);

    function get_checkpoint_for_height(uint64 chainKey, uint64 height) external view returns (HashResult memory);

    /// @notice Resolves a chainKey to its real chain id. Used to assert configuration
    ///         at deploy time, because chainKeys are NOT stable across environments.
    function get_chain_by_key(uint64 chainKey) external view returns (ChainInfoResult memory result);

    function get_supported_chains() external view returns (ChainInfo[] memory chains);
}

library ChainInfoLib {
    address internal constant PRECOMPILE_ADDRESS = 0x0000000000000000000000000000000000000fD3;

    function getChainInfo() internal pure returns (IChainInfo) {
        return IChainInfo(PRECOMPILE_ADDRESS);
    }
}
