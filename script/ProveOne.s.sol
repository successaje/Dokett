// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";

import {AscVerify} from "../src/lib/AscVerify.sol";
import {IChainInfo, ChainInfoLib} from "../src/interfaces/IChainInfo.sol";

/**
 * @title Probe
 * @notice A diagnostic that answers one question: do we read the ASC precompiles
 *         correctly on a real network?
 *
 * @dev Every test in this repo runs against mocks installed at the precompile
 *      addresses. That validates our LOGIC but not our READING of the
 *      precompiles — the proof payload shape, the `encodedTransaction` encoding,
 *      the decoder's behaviour on real mainnet bytes. If any of those differ from
 *      what we inferred from the SDK, the error surfaces here rather than three
 *      layers up inside an obligation's status machine.
 *
 *      Deliberately isolated from Register/Bond/adapters. When this fails you know
 *      the problem is the evidence layer; when it passes, everything above it is
 *      operating on assumptions that have been checked against a live chain.
 */
contract Probe is AscVerify {
    struct Decoded {
        uint64 height;
        uint8 txType;
        uint8 receiptStatus;
        uint256 logCount;
        address emitter;
        bytes32 topic0;
        uint256 topicCount;
        bytes data;
    }

    event Probed(uint64 indexed chainKey, uint64 indexed height, address emitter, bytes32 topic0);

    constructor(uint64 minConfirmations_, uint64 maxSampleGap_, uint64 recoveryGrace_)
        AscVerify(minConfirmations_, maxSampleGap_, recoveryGrace_)
    {}

    /**
     * @notice Verify a real proof and return everything we decoded from it.
     * @dev Runs the full guard chain — confirmation depth, replay reservation,
     *      precompile verification, receipt-status assertion, log extraction — so a
     *      success here means the whole of {AscVerify} works against live data.
     */
    function probe(Proof calldata p) external returns (Decoded memory d) {
        EvmV1Decoder.LogEntry memory log = _verify(p);

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(p.encodedTransaction);

        d.height = p.height;
        d.txType = EvmV1Decoder.getTransactionType(p.encodedTransaction);
        d.receiptStatus = uint8(receipt.receiptStatus);
        d.logCount = receipt.receiptLogs.length;
        d.emitter = log.address_;
        d.topic0 = log.topics.length > 0 ? log.topics[0] : bytes32(0);
        d.topicCount = log.topics.length;
        d.data = log.data;

        emit Probed(p.chainKey, p.height, d.emitter, d.topic0);
    }

    /// @notice Read-only decode, without consuming the proof key. For dry runs.
    function inspect(bytes calldata encodedTransaction, uint32 logIndex)
        external
        pure
        returns (uint8 txType, uint8 receiptStatus, uint256 logCount, address emitter, bytes32 topic0)
    {
        txType = EvmV1Decoder.getTransactionType(encodedTransaction);
        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        receiptStatus = uint8(receipt.receiptStatus);
        logCount = receipt.receiptLogs.length;
        if (logIndex < receipt.receiptLogs.length) {
            emitter = receipt.receiptLogs[logIndex].address_;
            topic0 = receipt.receiptLogs[logIndex].topics.length > 0 ? receipt.receiptLogs[logIndex].topics[0] : bytes32(0);
        }
    }

    /// @notice What the chain actually thinks, so a chainkey typo is visible.
    function chainReport(uint64 chainKey)
        external
        view
        returns (bool exists, uint64 chainId, uint64 attestedHeight, bool penalties)
    {
        IChainInfo ci = ChainInfoLib.getChainInfo();
        IChainInfo.ChainInfoResult memory r = ci.get_chain_by_key(chainKey);
        exists = r.exists;
        chainId = r.info.chainId;
        attestedHeight = attestedHead(chainKey);
        penalties = penaltiesEnabled(chainKey);
    }
}

/**
 * @title DeployProbe
 * @notice Deploys {Probe} and prints the supported-chain table.
 *
 * @dev The chain table is the point as much as the deployment. Chainkeys are not
 *      portable between environments, and reading them off the live precompile is
 *      the only way to be sure which one this network means by "Ethereum mainnet".
 *
 *   CHAIN_KEY=3 PRIVATE_KEY=0x… \
 *   forge script script/ProveOne.s.sol:DeployProbe --rpc-url $CC3_TESTNET_RPC --broadcast
 */
contract DeployProbe is Script {
    function run() external returns (Probe probe) {
        uint64 chainKey = uint64(vm.envUint("CHAIN_KEY"));
        uint64 minConf = uint64(vm.envOr("MIN_CONFIRMATIONS", uint256(64)));

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        probe = new Probe(minConf, uint64(vm.envOr("MAX_SAMPLE_GAP", uint256(15 minutes))), uint64(vm.envOr("RECOVERY_GRACE", uint256(1 hours))));
        vm.stopBroadcast();

        console2.log("Probe", address(probe));
        console2.log("");

        /*
         * Precompiles are read through low-level staticcalls, not typed calls.
         *
         * `forge script` executes locally against a fork, and a fork only
         * carries code, storage and balances. A native Substrate precompile has
         * no EVM bytecode, so revm sees an empty account and returns 0x — and
         * Solidity's try/catch does NOT catch the resulting decode failure, so
         * a typed call takes the whole deployment down with it.
         *
         * Checking `ok && data.length > 0` degrades cleanly instead: the table
         * prints when run against a real node, and is skipped when simulating.
         */
        _report(chainKey);

        console2.log("");
        console2.log("next: set PROBE in .env, then npm run prove:one");
    }

    /// @dev Prints what the live precompile says, when it can be reached.
    function _report(uint64 chainKey) internal view {
        address ci = ChainInfoLib.PRECOMPILE_ADDRESS;

        (bool ok, bytes memory data) =
            ci.staticcall(abi.encodeWithSignature("get_chain_by_key(uint64)", chainKey));

        if (!ok || data.length == 0) {
            console2.log("");
            console2.log("!! ChainInfo precompile unreachable here.");
            console2.log("   Expected when simulating: forge executes locally and a fork");
            console2.log("   carries no code for a native precompile. Verify against the node:");
            console2.log("     cast call 0x0000000000000000000000000000000000000fD3 \\");
            console2.log("       'get_supported_chains()((uint64,uint64,bytes,uint8)[])' --rpc-url $CC3_RPC");
            return;
        }

        IChainInfo.ChainInfoResult memory r =
            abi.decode(data, (IChainInfo.ChainInfoResult));

        console2.log("");
        console2.log("=== chainKey", chainKey, "===");
        console2.log("  known  ", r.exists);
        console2.log("  chainId", r.info.chainId);
        require(r.exists, "chainKey unknown on this network - check CHAIN_KEY for this environment");
    }
}
