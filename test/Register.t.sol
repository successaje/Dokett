// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

import {Register} from "../src/Register.sol";
import {AscVerify} from "../src/lib/AscVerify.sol";
import {NativeQueryVerifierLib} from "../src/interfaces/INativeQueryVerifier.sol";
import {ChainInfoLib} from "../src/interfaces/IChainInfo.sol";
import {MockBlockProver, MockChainInfo} from "./mocks/MockPrecompiles.sol";

contract AscVerifyDeploy is AscVerify {
    constructor(uint64 c, uint64 g, uint64 r) AscVerify(c, g, r) {}
}

/// @dev Rejects ether, to prove settlement cannot be held hostage by a bad payout address.
contract HostileRegistrar {
    Register immutable reg;

    constructor(Register reg_) {
        reg = reg_;
    }

    function register(Register.ObligationInit calldata init, uint64 chainId) external payable returns (uint256) {
        return reg.register{value: msg.value}(init, chainId);
    }

    receive() external payable {
        revert("no");
    }
}

contract SubjectSmartAccount is IERC1271 {
    address immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    function isValidSignature(bytes32 digest, bytes calldata signature) external view returns (bytes4) {
        return ECDSA.recover(digest, signature) == owner ? IERC1271.isValidSignature.selector : bytes4(0xffffffff);
    }
}

contract RegisterTest is Test {
    uint64 constant CHAIN_KEY = 3; // Ethereum mainnet on CC3 testnet
    uint64 constant ETH_CHAIN_ID = 1;
    uint64 constant MIN_CONF = 64;
    uint64 constant MAX_SAMPLE_GAP = 15 minutes;
    uint64 constant RECOVERY_GRACE = 1 hours;

    uint64 constant START_HEIGHT = 21_000_000;
    uint64 constant PERIOD_BLOCKS = 216_000; // ~30d at 12s
    uint64 constant CURE_BLOCKS = 50_400; // ~7d

    Register register;
    AscVerify ascVerify;
    MockChainInfo chainInfo;

    address timelock = makeAddr("timelock");
    address adapter = makeAddr("adapter");
    address registrar = makeAddr("registrar");
    address keeper = makeAddr("keeper");

    function setUp() public {
        deployCodeTo("MockPrecompiles.sol:MockBlockProver", NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        deployCodeTo("MockPrecompiles.sol:MockChainInfo", ChainInfoLib.PRECOMPILE_ADDRESS);
        chainInfo = MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS);
        chainInfo.setChain(CHAIN_KEY, ETH_CHAIN_ID, START_HEIGHT);

        ascVerify = new AscVerifyDeploy(MIN_CONF, MAX_SAMPLE_GAP, RECOVERY_GRACE);
        register = new Register(ascVerify, timelock);

        vm.warp(1 days);
        vm.deal(registrar, 100 ether);
        _installAdapter(adapter);
    }

    function _installAdapter(address a) internal {
        vm.prank(timelock);
        register.queueAdapter(a, true);
        vm.warp(block.timestamp + register.ADAPTER_TIMELOCK());
        register.setAdapter(a);
    }

    function _init() internal returns (Register.ObligationInit memory i) {
        i.obligor = keccak256("obligor-commitment");
        i.creditor = keccak256("creditor-commitment");
        i.creditorPayout = makeAddr("payout");
        i.chainKey = CHAIN_KEY;
        i.sourceToken = makeAddr("usdc");
        i.sourcePayer = makeAddr("borrower");
        i.sourcePayee = makeAddr("lender");
        i.principal = 5000e6;
        i.periodAmount = 1800e6;
        i.aprBps = 340;
        i.startHeight = START_HEIGHT;
        i.periodBlocks = PERIOD_BLOCKS;
        i.cureBlocks = CURE_BLOCKS;
        i.periodsTotal = 3;
    }

    function _register() internal returns (uint256 id) {
        vm.prank(registrar);
        id = register.register{value: 2 ether}(_init(), ETH_CHAIN_ID);
    }

    function _sign(uint256 privateKey, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _registerAuthorized(uint256 subjectKey) internal returns (uint256 id, address signer) {
        Register.ObligationInit memory init = _init();
        signer = vm.addr(subjectKey);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = register.obligationAuthorizationDigest(init, registrar, signer, ETH_CHAIN_ID, 1, deadline);
        bytes memory signature = _sign(subjectKey, digest);

        vm.prank(registrar);
        id = register.registerAuthorized{value: 2 ether}(init, ETH_CHAIN_ID, signer, 1, deadline, signature);
    }

    /* ─────────────────────── genesis bootstrap ────────────────────── */

    /**
     * @notice A fresh deployment must be usable without waiting out its own timelock.
     * @dev Otherwise the registry is inert for 48h: no adapter installed means no
     *      obligation can ever advance.
     */
    function test_Bootstrap_InstallsInitialAdapterSet() public {
        Register fresh = new Register(ascVerify, timelock);
        address[] memory set = new address[](2);
        set[0] = makeAddr("payment");
        set[1] = makeAddr("silence");

        vm.prank(timelock);
        fresh.bootstrapAdapters(set);

        assertTrue(fresh.isAdapter(set[0]));
        assertTrue(fresh.isAdapter(set[1]));
        assertTrue(fresh.bootstrapped());
    }

    function test_Bootstrap_OnlyTimelock() public {
        Register fresh = new Register(ascVerify, timelock);
        address[] memory set = new address[](1);
        set[0] = adapter;

        vm.expectRevert(abi.encodeWithSelector(Register.NotTimelock.selector, address(this)));
        fresh.bootstrapAdapters(set);
    }

    function test_Bootstrap_IsOneShot() public {
        Register fresh = new Register(ascVerify, timelock);
        address[] memory set = new address[](1);
        set[0] = adapter;

        vm.prank(timelock);
        fresh.bootstrapAdapters(set);

        vm.prank(timelock);
        vm.expectRevert(Register.AlreadyBootstrapped.selector);
        fresh.bootstrapAdapters(set);
    }

    /**
     * @notice THE GUARD THE WHOLE ARGUMENT RESTS ON.
     *
     * @dev Bootstrap is defensible only because nobody has capital at risk yet.
     *      The moment one obligation exists that stops being true, so the path must
     *      close permanently — even though `bootstrapped` is still false here.
     *      Without this, a timelock holder could bypass the 48h warning on a live
     *      registry with real bonds posted against it.
     */
    function test_Bootstrap_ClosesPermanentlyOnceAnObligationExists() public {
        Register fresh = new Register(ascVerify, timelock);

        // Install an adapter the slow way, register one obligation.
        vm.prank(timelock);
        fresh.queueAdapter(adapter, true);
        vm.warp(block.timestamp + fresh.ADAPTER_TIMELOCK());
        fresh.setAdapter(adapter);

        vm.prank(registrar);
        fresh.register{value: 2 ether}(_init(), ETH_CHAIN_ID);

        address[] memory set = new address[](1);
        set[0] = makeAddr("late-adapter");

        assertFalse(fresh.bootstrapped(), "never bootstrapped, yet still must refuse");
        vm.prank(timelock);
        vm.expectRevert(abi.encodeWithSelector(Register.RegistryNotEmpty.selector, uint256(2)));
        fresh.bootstrapAdapters(set);
    }

    /* ────────────────────── registration (I8) ─────────────────────── */

    function test_Register_IsPermissionlessAndBonded() public {
        uint256 id = _register();
        Register.Obligation memory o = register.getObligation(id);

        assertEq(uint8(o.status), uint8(Register.Status.Active));
        assertEq(o.outstanding, 5000e6, "outstanding starts at principal");
        assertEq(o.windowEndHeight, START_HEIGHT + PERIOD_BLOCKS, "first window closes one period in");
        assertEq(o.registrarBond, register.MIN_REGISTRAR_BOND());
        assertEq(o.keeperFund, 2 ether - register.MIN_REGISTRAR_BOND());
    }

    function test_Register_RequiresBond() public {
        vm.prank(registrar);
        vm.expectRevert(
            abi.encodeWithSelector(
                Register.BondTooSmall.selector, 0.1 ether, register.MIN_REGISTRAR_BOND() + register.MIN_KEEPER_FUND()
            )
        );
        register.register{value: 0.1 ether}(_init(), ETH_CHAIN_ID);
    }

    /**
     * @notice Chainkeys are not portable: Ethereum mainnet is 3 on CC3 testnet and
     *         1 on CC3 mainnet. Registering against the wrong key would verify
     *         proofs against the wrong chain, silently. It must fail loudly instead.
     */
    function test_Register_RejectsChainkeyMisconfiguration() public {
        Register.ObligationInit memory i = _init();
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(AscVerify.ChainIdMismatch.selector, CHAIN_KEY, 137, ETH_CHAIN_ID));
        register.register{value: 2 ether}(i, 137);
    }

    /// @dev A schedule whose windows cannot cover the principal is not a promise.
    function test_Register_RejectsUnsatisfiableSchedule() public {
        Register.ObligationInit memory i = _init();
        i.periodAmount = 100e6; // 3 × 100 < 5000

        vm.prank(registrar);
        vm.expectRevert(Register.InvalidSchedule.selector);
        register.register{value: 2 ether}(i, ETH_CHAIN_ID);
    }

    /* ──────────────── I2: no privileged reporter ──────────────────── */

    /**
     * @notice Nobody outside an allowlisted adapter can move an obligation — not
     *         the registrar, not the timelock, not the deployer. This is the whole
     *         thesis expressed as an access check.
     */
    function test_StatusCannotBeAssertedByAnyone() public {
        uint256 id = _register();

        address[3] memory outsiders = [registrar, timelock, address(this)];
        for (uint256 i = 0; i < outsiders.length; i++) {
            vm.prank(outsiders[i]);
            vm.expectRevert(abi.encodeWithSelector(Register.NotAdapter.selector, outsiders[i]));
            register.markStatus(id, Register.Status.Default);
        }
    }

    function test_IllegalTransitions_AreRejected() public {
        uint256 id = _register();

        // Active → Default skips delinquency and its cure window.
        vm.prank(adapter);
        vm.expectRevert(
            abi.encodeWithSelector(Register.IllegalTransition.selector, Register.Status.Active, Register.Status.Default)
        );
        register.markStatus(id, Register.Status.Default);
    }

    /// @notice Default is terminal. A workout is a new obligation, not a rewrite.
    function test_DefaultCannotBeUndone() public {
        uint256 id = _register();

        vm.startPrank(adapter);
        register.markStatus(id, Register.Status.Delinquent);
        register.markStatus(id, Register.Status.Default);

        vm.expectRevert(
            abi.encodeWithSelector(
                Register.IllegalTransition.selector, Register.Status.Default, Register.Status.Delinquent
            )
        );
        register.markStatus(id, Register.Status.Delinquent);
        vm.stopPrank();
    }

    /* ─────────────────────── payment & cure ───────────────────────── */

    function test_RecordPayment_AdvancesSchedule() public {
        uint256 id = _register();

        vm.prank(adapter);
        register.recordPayment(id, START_HEIGHT + 1000, 1800e6, 1);

        Register.Obligation memory o = register.getObligation(id);
        assertEq(uint8(o.status), uint8(Register.Status.Current));
        assertEq(o.periodsSatisfied, 1);
        assertEq(o.outstanding, 5000e6 - 1800e6);
        assertEq(o.windowEndHeight, START_HEIGHT + 2 * PERIOD_BLOCKS, "window rolls forward one period");
    }

    /**
     * @notice I4: a delinquent obligation returns to Current on a payment proof.
     *         Admissibility is decided by the PROVEN HEIGHT, not by when the proof
     *         was submitted — which is what makes permissionless marking safe.
     */
    function test_Cure_RestoresCurrentFromDelinquent() public {
        uint256 id = _register();

        vm.startPrank(adapter);
        register.markStatus(id, Register.Status.Delinquent);
        register.recordPayment(id, START_HEIGHT + PERIOD_BLOCKS - 10, 1800e6, 1);
        vm.stopPrank();

        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Current), "late proof of in-window payment cures");
    }

    function test_FullRepayment_Settles() public {
        uint256 id = _register();

        vm.prank(adapter);
        register.recordPayment(id, START_HEIGHT + 1000, 5000e6, 3);

        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Settled));
        assertEq(register.withdrawable(registrar), 2 ether, "escrow credited back on settlement");
    }

    /* ───────────────────── escrow is pull, not push ───────────────── */

    /**
     * @notice A registrar whose address reverts on receipt must not be able to
     *         block settlement. Settlement is a fact about a borrower's record; it
     *         cannot be held hostage by a creditor's wallet.
     */
    function test_Settlement_CannotBeBlockedByHostileRegistrar() public {
        HostileRegistrar hostile = new HostileRegistrar(register);
        vm.deal(address(hostile), 10 ether);

        uint256 id = hostile.register{value: 2 ether}(_init(), ETH_CHAIN_ID);

        vm.prank(adapter);
        register.recordPayment(id, START_HEIGHT + 1000, 5000e6, 3);

        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Settled), "settles regardless");
        assertEq(register.withdrawable(address(hostile)), 2 ether, "funds credited, not stranded");

        vm.prank(address(hostile));
        vm.expectRevert(abi.encodeWithSelector(Register.BountyTransferFailed.selector, address(hostile)));
        register.withdraw();
        assertEq(register.withdrawable(address(hostile)), 2 ether, "credit survives a failed withdrawal");
    }

    /* ──────────────────────────── bounties ────────────────────────── */

    function test_Bounty_PaidFromObligationEscrow() public {
        uint256 id = _register();
        uint128 fund = register.getObligation(id).keeperFund;

        vm.prank(adapter);
        register.payBounty(id, keeper, 0.01 ether);

        assertEq(keeper.balance, 0.01 ether);
        assertEq(register.getObligation(id).keeperFund, fund - 0.01 ether);
    }

    /// @notice A griefer cannot drain the protocol by farming bounty calls.
    function test_Bounty_CannotExceedObligationEscrow() public {
        uint256 id = _register();
        uint128 fund = register.getObligation(id).keeperFund;

        vm.prank(adapter);
        register.payBounty(id, keeper, fund + 100 ether);

        assertEq(keeper.balance, fund, "capped at this obligation's own escrow");
        assertEq(register.getObligation(id).keeperFund, 0);
    }

    /* ─────────────────────────── governance ───────────────────────── */

    function test_Adapter_RequiresTimelock() public {
        address rogue = makeAddr("rogue");

        vm.expectRevert(abi.encodeWithSelector(Register.NotTimelock.selector, address(this)));
        register.queueAdapter(rogue, true);

        vm.prank(timelock);
        register.queueAdapter(rogue, true);

        vm.expectRevert(
            abi.encodeWithSelector(Register.TimelockNotElapsed.selector, uint64(block.timestamp + 48 hours))
        );
        register.setAdapter(rogue);

        vm.warp(block.timestamp + 48 hours);
        register.setAdapter(rogue);
        assertTrue(register.isAdapter(rogue));
    }

    /* ───────────────────────────── dispute ────────────────────────── */

    function test_RegisterAuthorized_RecordsSubjectAndImmutableProvenance() public {
        (uint256 id, address signer) = _registerAuthorized(0xA11CE);

        (Register.Provenance kind, address recordedSigner, bytes32 committedTerms, uint128 registrationBond) =
            register.provenanceOf(id);
        assertEq(uint8(kind), uint8(Register.Provenance.SubjectAuthorized));
        assertEq(recordedSigner, signer);
        assertEq(committedTerms, register.hashTerms(_init()));
        assertEq(registrationBond, register.MIN_REGISTRAR_BOND());

        vm.prank(adapter);
        register.recordPayment(id, START_HEIGHT + 1000, 5000e6, 3);
        assertEq(register.registrationBondPosted(id), register.MIN_REGISTRAR_BOND(), "settlement preserves provenance");
        assertEq(register.getObligation(id).registrarBond, 0, "only refundable escrow is cleared");
    }

    function test_RegisterAuthorized_RejectsReplay() public {
        Register.ObligationInit memory init = _init();
        uint256 subjectKey = 0xA11CE;
        address signer = vm.addr(subjectKey);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = register.obligationAuthorizationDigest(init, registrar, signer, ETH_CHAIN_ID, 9, deadline);
        bytes memory signature = _sign(subjectKey, digest);

        vm.startPrank(registrar);
        register.registerAuthorized{value: 2 ether}(init, ETH_CHAIN_ID, signer, 9, deadline, signature);
        vm.expectRevert(abi.encodeWithSelector(Register.AuthorizationAlreadyUsed.selector, digest));
        register.registerAuthorized{value: 2 ether}(init, ETH_CHAIN_ID, signer, 9, deadline, signature);
        vm.stopPrank();
    }

    function test_RegisterAuthorized_RejectsExpiredSignature() public {
        Register.ObligationInit memory init = _init();
        uint256 subjectKey = 0xA11CE;
        address signer = vm.addr(subjectKey);
        uint256 deadline = block.timestamp - 1;
        bytes memory signature = _sign(
            subjectKey, register.obligationAuthorizationDigest(init, registrar, signer, ETH_CHAIN_ID, 1, deadline)
        );

        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(Register.AuthorizationExpired.selector, deadline));
        register.registerAuthorized{value: 2 ether}(init, ETH_CHAIN_ID, signer, 1, deadline, signature);
    }

    function test_RegisterAuthorized_SupportsEip1271Subject() public {
        Register.ObligationInit memory init = _init();
        uint256 ownerKey = 0xB0B;
        SubjectSmartAccount account = new SubjectSmartAccount(vm.addr(ownerKey));
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _sign(
            ownerKey,
            register.obligationAuthorizationDigest(init, registrar, address(account), ETH_CHAIN_ID, 7, deadline)
        );

        vm.prank(registrar);
        uint256 id =
            register.registerAuthorized{value: 2 ether}(init, ETH_CHAIN_ID, address(account), 7, deadline, signature);
        assertEq(register.subjectSigner(id), address(account));
    }

    function test_RegisterAuthorized_BindsTermsRegistrarAndSubjectSigner() public {
        Register.ObligationInit memory init = _init();
        uint256 subjectKey = 0xA11CE;
        address signer = vm.addr(subjectKey);
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature = _sign(
            subjectKey, register.obligationAuthorizationDigest(init, registrar, signer, ETH_CHAIN_ID, 15, deadline)
        );

        Register.ObligationInit memory altered = init;
        altered.principal += 1;
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(Register.InvalidAuthorization.selector, signer));
        register.registerAuthorized{value: 2 ether}(altered, ETH_CHAIN_ID, signer, 15, deadline, signature);

        address differentRegistrar = makeAddr("different registrar");
        vm.deal(differentRegistrar, 10 ether);
        vm.prank(differentRegistrar);
        vm.expectRevert(abi.encodeWithSelector(Register.InvalidAuthorization.selector, signer));
        register.registerAuthorized{value: 2 ether}(init, ETH_CHAIN_ID, signer, 15, deadline, signature);

        address differentSigner = vm.addr(0xB0B);
        vm.prank(registrar);
        vm.expectRevert(abi.encodeWithSelector(Register.InvalidAuthorization.selector, differentSigner));
        register.registerAuthorized{value: 2 ether}(init, ETH_CHAIN_ID, differentSigner, 15, deadline, signature);
    }

    /// @notice An authenticated dispute is visible but never status-changing.
    function test_Dispute_IsAuthenticatedAndAdvisoryOnly() public {
        (uint256 id, address signer) = _registerAuthorized(0xA11CE);

        vm.prank(signer);
        register.dispute(id, bytes32("NEVER_BORROWED"));

        (address filedBy, bytes32 reason, bytes32 evidence, uint64 filedAt) = register.disputeOf(id);
        assertEq(filedBy, signer);
        assertEq(reason, bytes32("NEVER_BORROWED"));
        assertEq(evidence, bytes32(0));
        assertEq(filedAt, block.timestamp);
        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Active), "status unchanged");
    }

    function test_Dispute_RejectsStrangerAndRegistrarOnlyClaim() public {
        (uint256 id, address signer) = _registerAuthorized(0xA11CE);
        vm.expectRevert(abi.encodeWithSelector(Register.UnauthorizedDisputer.selector, address(this), signer));
        register.dispute(id, bytes32("FALSE_TERMS"));

        uint256 registrarOnly = _register();
        vm.expectRevert(abi.encodeWithSelector(Register.SubjectAuthorizationRequired.selector, registrarOnly));
        register.dispute(registrarOnly, bytes32("FALSE_TERMS"));
    }

    function test_Dispute_RelayerCanSubmitSubjectSignature() public {
        uint256 subjectKey = 0xA11CE;
        (uint256 id, address signer) = _registerAuthorized(subjectKey);
        bytes32 reason = bytes32("WRONG_AMOUNT");
        bytes32 evidence = keccak256("ipfs evidence commitment");
        uint256 deadline = block.timestamp + 1 days;
        bytes32 digest = register.disputeAuthorizationDigest(id, reason, evidence, 41, deadline);

        vm.prank(makeAddr("relayer"));
        register.disputeBySig(id, reason, evidence, 41, deadline, _sign(subjectKey, digest));

        assertEq(register.disputedBy(id), signer);
        assertEq(register.disputeEvidence(id), evidence);
    }

    function test_Dispute_CannotBeOverwritten() public {
        (uint256 id, address signer) = _registerAuthorized(0xA11CE);
        vm.startPrank(signer);
        register.dispute(id, bytes32("NEVER_BORROWED"));
        vm.expectRevert(abi.encodeWithSelector(Register.AlreadyDisputed.selector, id));
        register.dispute(id, bytes32("DIFFERENT_REASON"));
        vm.stopPrank();
    }

    function test_Dispute_SignatureBindsReasonAndEvidence() public {
        uint256 subjectKey = 0xA11CE;
        (uint256 id, address signer) = _registerAuthorized(subjectKey);
        bytes32 reason = bytes32("WRONG_AMOUNT");
        bytes32 evidence = keccak256("evidence commitment");
        uint256 deadline = block.timestamp + 1 days;
        bytes memory signature =
            _sign(subjectKey, register.disputeAuthorizationDigest(id, reason, evidence, 21, deadline));

        vm.expectRevert(abi.encodeWithSelector(Register.InvalidAuthorization.selector, signer));
        register.disputeBySig(id, bytes32("OTHER_REASON"), evidence, 21, deadline, signature);

        vm.expectRevert(abi.encodeWithSelector(Register.InvalidAuthorization.selector, signer));
        register.disputeBySig(id, reason, keccak256("other evidence"), 21, deadline, signature);
    }

    function test_UnknownObligation_Reverts() public {
        vm.expectRevert(abi.encodeWithSelector(Register.UnknownObligation.selector, uint256(999)));
        register.dispute(999, bytes32("x"));
    }
}
