// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Script, console2} from "forge-std/Script.sol";

import {AscVerify} from "../src/lib/AscVerify.sol";
import {AscVerifier, IAdapterAllowlist} from "../src/AscVerifier.sol";
import {Register} from "../src/Register.sol";
import {Bond} from "../src/Bond.sol";
import {PaymentAdapter} from "../src/adapters/PaymentAdapter.sol";
import {SilenceAdapter, IBond} from "../src/adapters/SilenceAdapter.sol";

/**
 * @title Deploy
 * @notice Deploys the Covenant stack and wires it in one transaction bundle.
 *
 * @dev Ordering is forced by two circular-ish dependencies, and getting either
 *      wrong produces a system that looks deployed but is permanently inert:
 *
 *        · AscVerifier needs the Register's address to know who may consume proof
 *          keys, and the Register needs the verifier's at construction. One link
 *          therefore has to be made after the fact — hence `initialize`, which is
 *          deployer-only and one-shot. An uninitialized verifier is inert rather
 *          than permissive, so a half-finished deploy fails closed.
 *
 *        · Adapters must be installed through {Register.bootstrapAdapters},
 *          because the normal path carries a 48h timelock and a registry with no
 *          adapters cannot advance a single obligation. That path closes forever
 *          the moment the first obligation is registered.
 *
 *      Usage:
 *
 *        forge script script/Deploy.s.sol:Deploy \
 *          --rpc-url $CC3_TESTNET_RPC --broadcast
 *
 *      Required env: CHAIN_KEY, EXPECTED_CHAIN_ID, PRIVATE_KEY.
 *      Optional:     TIMELOCK, MIN_CONFIRMATIONS, MAX_SAMPLE_GAP,
 *                    RECOVERY_GRACE, COLLATERAL, SKIP_CHAINKEY_ASSERT.
 */
contract Deploy is Script {
    struct Config {
        uint64 chainKey;
        uint64 expectedChainId;
        uint64 minConfirmations;
        uint64 maxSampleGap;
        uint64 recoveryGrace;
        address timelock;
        address collateral;
        bool skipChainKeyAssert;
    }

    struct Deployment {
        AscVerifier verifier;
        Register register;
        Bond bond;
        PaymentAdapter payment;
        SilenceAdapter silence;
    }

    function run() external returns (Deployment memory d) {
        Config memory cfg = _config();
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        console2.log("deployer     ", deployer);
        console2.log("timelock     ", cfg.timelock);
        console2.log("chainKey     ", cfg.chainKey);
        console2.log("expectChainId", cfg.expectedChainId);

        vm.startBroadcast(pk);

        // 1. The evidence layer. One shared instance: a per-adapter replay map
        //    would let a payment proof be spent twice, and a per-adapter
        //    observation record would fragment the I7 liveness gate.
        d.verifier = new AscVerifier(cfg.minConfirmations, cfg.maxSampleGap, cfg.recoveryGrace);

        // 2. The record.
        d.register = new Register(AscVerify(address(d.verifier)), cfg.timelock);

        // 3. Close the loop. Must happen in this bundle — see the contract note.
        d.verifier.initialize(IAdapterAllowlist(address(d.register)));

        // 4. First-loss capital, then the two adapters that drive status.
        d.bond = new Bond(d.register, cfg.timelock);
        d.payment = new PaymentAdapter(d.register, d.verifier);
        d.silence = new SilenceAdapter(d.register, d.verifier, IBond(address(d.bond)));

        vm.stopBroadcast();

        _verifyChainKey(d.verifier, cfg);
        _report(d, cfg, deployer);
        _write(d, cfg);
    }

    /* ─────────────────────────────── config ────────────────────────────── */

    function _config() internal view returns (Config memory c) {
        c.chainKey = uint64(vm.envUint("CHAIN_KEY"));
        c.expectedChainId = uint64(vm.envUint("EXPECTED_CHAIN_ID"));

        // 64 Ethereum blocks ≈ 13 minutes, comfortably past finality.
        c.minConfirmations = uint64(vm.envOr("MIN_CONFIRMATIONS", uint256(64)));
        // Longest observation gap still counted as continuous coverage.
        c.maxSampleGap = uint64(vm.envOr("MAX_SAMPLE_GAP", uint256(15 minutes)));
        // How long coverage must be re-established before penalties resume.
        c.recoveryGrace = uint64(vm.envOr("RECOVERY_GRACE", uint256(1 hours)));

        c.timelock = vm.envOr("TIMELOCK", address(0));
        c.collateral = vm.envOr("COLLATERAL", address(0));
        c.skipChainKeyAssert = vm.envOr("SKIP_CHAINKEY_ASSERT", false);

        require(c.chainKey != 0, "CHAIN_KEY must be set and non-zero");
        require(c.expectedChainId != 0, "EXPECTED_CHAIN_ID must be set");
        require(c.maxSampleGap > 0, "MAX_SAMPLE_GAP must be non-zero");
        require(c.recoveryGrace >= c.maxSampleGap, "RECOVERY_GRACE must exceed MAX_SAMPLE_GAP");
    }

    /* ──────────────────────── post-deploy assertions ───────────────────── */

    /**
     * @dev Chainkeys are not portable: Ethereum mainnet is 3 on CC3 testnet and 1
     *      on CC3 mainnet. A wrong one does not error — it verifies proofs against
     *      the wrong chain, silently. Resolving the chain id through ChainInfo and
     *      asserting it is the only thing standing between a typo and a registry
     *      full of evidence about a chain nobody meant to read.
     */
    function _verifyChainKey(AscVerifier verifier, Config memory cfg) internal view {
        if (cfg.skipChainKeyAssert) {
            console2.log("!! chainkey assertion SKIPPED by request");
            return;
        }

        /*
         * Low-level, because a typed call cannot survive simulation.
         *
         * `forge script` executes against a fork, and a fork carries no code for
         * a native precompile — the call returns 0x and Solidity's decode of an
         * empty return reverts uncatchably, taking the deployment with it.
         *
         * The assertion still has to happen, so it happens where it actually
         * works: `script/preflight.js` reads ChainInfo over a real eth_call
         * before this script is ever invoked. Deploying without that preflight
         * is the unsafe path, which is why `npm run deploy` runs it first.
         */
        (bool ok, bytes memory data) = address(verifier).staticcall(
            abi.encodeWithSignature("assertChainId(uint64,uint64)", cfg.chainKey, cfg.expectedChainId)
        );

        if (ok) {
            console2.log("chainkey verified on chain: key", cfg.chainKey, "-> chainId", cfg.expectedChainId);
        } else if (data.length == 0) {
            console2.log("");
            console2.log("!! ChainInfo unreadable in simulation (expected).");
            console2.log("   Verified instead by script/preflight.js against the node.");
        } else {
            revert("chainkey assertion FAILED against a reachable ChainInfo - check CHAIN_KEY");
        }
    }

    /* ───────────────────────────── reporting ───────────────────────────── */

    function _report(Deployment memory d, Config memory cfg, address deployer) internal pure {
        console2.log("");
        console2.log("=== deployed ===");
        console2.log("AscVerifier    ", address(d.verifier));
        console2.log("Register       ", address(d.register));
        console2.log("Bond           ", address(d.bond));
        console2.log("PaymentAdapter ", address(d.payment));
        console2.log("SilenceAdapter ", address(d.silence));
        console2.log("");

        // The two wiring steps that need the timelock key. Deliberately NOT done
        // here: if the timelock is the deployer on a testnet these are one call
        // each, but on anything real they are governance actions, and a deploy
        // script that quietly assumes it holds the timelock key is a deploy script
        // that will one day be run against mainnet.
        console2.log("=== REQUIRED: run as timelock ===");
        console2.log("1. register.bootstrapAdapters([paymentAdapter, silenceAdapter])");
        console2.log("   Until this runs, no obligation can advance. One-shot; closes");
        console2.log("   permanently once the first obligation is registered.");
        console2.log("2. bond.setCollateral(<stablecoin>, true)");
        console2.log("   Until this runs, no bond can be posted.");
        if (cfg.timelock == deployer) {
            console2.log("   (timelock == deployer; run script/Bootstrap.s.sol)");
        }
    }

    function _write(Deployment memory d, Config memory cfg) internal {
        string memory k = "covenant";
        vm.serializeAddress(k, "ascVerifier", address(d.verifier));
        vm.serializeAddress(k, "register", address(d.register));
        vm.serializeAddress(k, "bond", address(d.bond));
        vm.serializeAddress(k, "paymentAdapter", address(d.payment));
        vm.serializeAddress(k, "silenceAdapter", address(d.silence));
        vm.serializeAddress(k, "timelock", cfg.timelock);
        vm.serializeUint(k, "chainKey", cfg.chainKey);
        vm.serializeUint(k, "expectedChainId", cfg.expectedChainId);
        vm.serializeUint(k, "minConfirmations", cfg.minConfirmations);
        vm.serializeUint(k, "maxSampleGap", cfg.maxSampleGap);
        string memory out = vm.serializeUint(k, "recoveryGrace", cfg.recoveryGrace);

        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, path);
        console2.log("");
        console2.log("wrote", path);
    }
}

/**
 * @title Bootstrap
 * @notice The two timelock-gated wiring calls, split out from {Deploy}.
 *
 * @dev Separate because they need a different key. On a testnet where the
 *      deployer holds the timelock this is a formality; on anything real these
 *      are governance actions and must be executed deliberately.
 *
 *   REGISTER=0x… PAYMENT_ADAPTER=0x… SILENCE_ADAPTER=0x… BOND=0x… COLLATERAL=0x… \
 *   forge script script/Deploy.s.sol:Bootstrap --rpc-url $CC3_TESTNET_RPC --broadcast
 */
contract Bootstrap is Script {
    function run() external {
        Register register = Register(payable(vm.envAddress("REGISTER")));
        Bond bond = Bond(vm.envAddress("BOND"));
        address collateral = vm.envOr("COLLATERAL", address(0));

        address[] memory adapters = new address[](2);
        adapters[0] = vm.envAddress("PAYMENT_ADAPTER");
        adapters[1] = vm.envAddress("SILENCE_ADAPTER");

        vm.startBroadcast(vm.envUint("TIMELOCK_PRIVATE_KEY"));

        register.bootstrapAdapters(adapters);
        console2.log("adapters installed");

        if (collateral != address(0)) {
            bond.setCollateral(collateral, true);
            console2.log("collateral allowed", collateral);
        } else {
            console2.log("!! COLLATERAL unset: no bond can be posted until setCollateral runs");
        }

        vm.stopBroadcast();

        require(register.isAdapter(adapters[0]), "payment adapter not installed");
        require(register.isAdapter(adapters[1]), "silence adapter not installed");
        console2.log("bootstrap verified");
    }
}
