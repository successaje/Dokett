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

        IChainInfo ci = ChainInfoLib.getChainInfo();

        try ci.get_supported_chains() returns (IChainInfo.ChainInfo[] memory chains) {
            console2.log("=== chains this network attests ===");
            for (uint256 i = 0; i < chains.length; i++) {
                console2.log("  chainKey", chains[i].chainKey, "-> chainId", chains[i].chainId);
            }
        } catch {
            console2.log("!! ChainInfo.get_supported_chains reverted - no ASC precompile on this network?");
        }

        console2.log("");
        (bool exists, uint64 chainId, uint64 head, bool penalties) = probe.chainReport(chainKey);
        console2.log("=== requested chainKey", chainKey, "===");
        console2.log("  known         ", exists);
        console2.log("  chainId       ", chainId);
        console2.log("  attested head ", head);
        console2.log("  penalties     ", penalties);

        require(exists, "chainKey unknown on this network - check CHAIN_KEY for this environment");
        console2.log("");
        console2.log("next: PROBE=%s node demo/prove-one.js", address(probe));
    }
}
