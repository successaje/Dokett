// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";

import {Register} from "../src/Register.sol";
import {AscVerify} from "../src/lib/AscVerify.sol";
import {AscVerifier, IAdapterAllowlist} from "../src/AscVerifier.sol";
import {PaymentAdapter} from "../src/adapters/PaymentAdapter.sol";
import {SilenceAdapter, IBond} from "../src/adapters/SilenceAdapter.sol";
import {INativeQueryVerifier, NativeQueryVerifierLib} from "../src/interfaces/INativeQueryVerifier.sol";
import {ChainInfoLib} from "../src/interfaces/IChainInfo.sol";
import {MockBlockProver, MockChainInfo} from "./mocks/MockPrecompiles.sol";

contract MockBond is IBond {
    uint128 public available;
    uint256 public lastId;
    address public lastPayee;

    function fund(uint128 v) external {
        available = v;
    }

    function slash(uint256 id, uint128 amount, address payee) external returns (uint128) {
        lastId = id;
        lastPayee = payee;
        uint128 s = amount > available ? available : amount;
        available -= s;
        return s;
    }
}

/**
 * @title Adapter integration tests
 * @notice The full obligation lifecycle, driven by a REAL Ethereum mainnet transfer.
 */
contract AdaptersTest is Test {
    uint64 constant CHAIN_KEY = 3;
    uint64 constant ETH_CHAIN_ID = 1;
    uint64 constant MIN_CONF = 64;
    uint64 constant MAX_SAMPLE_GAP = 15 minutes;
    uint64 constant RECOVERY_GRACE = 1 hours;

    uint64 constant PERIOD_BLOCKS = 216_000; // ~30d at 12s
    uint64 constant CURE_BLOCKS = 50_400; // ~7d

    /// @dev Un-pranked calls to markDelinquent/finalizeDefault pay their bounty to
    ///      this contract; without this it reverts on the transfer, not on the thing
    ///      the test is actually checking.
    receive() external payable {}

    Register register;
    AscVerifier verifier;
    PaymentAdapter payment;
    SilenceAdapter silence;
    MockChainInfo chainInfo;
    MockBlockProver prover;
    MockBond bondMock;

    address timelock = makeAddr("timelock");
    address registrar = makeAddr("registrar");
    address keeper = makeAddr("keeper");
    address payout = makeAddr("payout");

    // real mainnet fixture
    bytes encodedTx;
    uint64 txHeight;
    address token;
    address payer;
    address payee;
    uint256 txValue;

    uint64 startHeight;
    uint64 windowEnd;
    uint256 id;

    function setUp() public {
        deployCodeTo("MockPrecompiles.sol:MockBlockProver", NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        deployCodeTo("MockPrecompiles.sol:MockChainInfo", ChainInfoLib.PRECOMPILE_ADDRESS);
        prover = MockBlockProver(NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        chainInfo = MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS);

        string memory json = vm.readFile("demo/fixtures/erc20-transfer-success.json");
        encodedTx = vm.parseJsonBytes(json, ".encodedTransaction");
        txHeight = uint64(vm.parseJsonUint(json, ".blockNumber"));
        token = vm.parseJsonAddress(json, ".token");
        payer = vm.parseJsonAddress(json, ".from");
        payee = vm.parseJsonAddress(json, ".to");
        txValue = vm.parseJsonUint(json, ".value");

        // Window bracketing the real transfer.
        startHeight = txHeight - 1000;
        windowEnd = startHeight + PERIOD_BLOCKS;

        chainInfo.setChain(CHAIN_KEY, ETH_CHAIN_ID, txHeight + MIN_CONF);

        verifier = new AscVerifier(MIN_CONF, MAX_SAMPLE_GAP, RECOVERY_GRACE);
        register = new Register(AscVerify(address(verifier)), timelock);
        verifier.initialize(IAdapterAllowlist(address(register)));

        bondMock = new MockBond();
        payment = new PaymentAdapter(register, verifier);
        silence = new SilenceAdapter(register, verifier, IBond(address(bondMock)));

        _install(address(payment));
        _install(address(silence));

        vm.warp(1 days);
        vm.deal(registrar, 100 ether);
        id = _register();
    }

    function _install(address a) internal {
        vm.prank(timelock);
        register.queueAdapter(a, true);
        vm.warp(block.timestamp + register.ADAPTER_TIMELOCK());
        register.setAdapter(a);
    }

    function _register() internal returns (uint256) {
        Register.ObligationInit memory i;
        i.obligor = keccak256("obligor");
        i.creditor = keccak256("creditor");
        i.creditorPayout = payout;
        i.chainKey = CHAIN_KEY;
        i.sourceToken = token;
        i.sourcePayer = payer;
        i.sourcePayee = payee;
        i.principal = uint128(txValue * 3);
        i.periodAmount = uint128(txValue);
        i.aprBps = 340;
        i.startHeight = startHeight;
        i.periodBlocks = PERIOD_BLOCKS;
        i.cureBlocks = CURE_BLOCKS;
        i.periodsTotal = 3;

        vm.prank(registrar);
        return register.register{value: 5 ether}(i, ETH_CHAIN_ID);
    }

    function _proof(bytes32 root) internal view returns (AscVerify.Proof memory p) {
        p.chainKey = CHAIN_KEY;
        p.height = txHeight;
        p.encodedTransaction = encodedTx;
        p.logIndex = 0;
        p.merkleProof =
            INativeQueryVerifier.MerkleProof({root: root, siblings: new INativeQueryVerifier.MerkleProofEntry[](0)});
        p.continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: bytes32(0), roots: new bytes32[](0)});
    }

    /// @dev Simulates a keeper watching the chain, so I7's observation record builds.
    function _observe() internal {
        uint64 head = chainInfo.head(CHAIN_KEY);
        for (uint64 t = 0; t <= RECOVERY_GRACE; t += MAX_SAMPLE_GAP / 2) {
            vm.warp(block.timestamp + MAX_SAMPLE_GAP / 2);
            head += 40;
            chainInfo.setHead(CHAIN_KEY, head);
            verifier.pokeHead(CHAIN_KEY);
        }
    }

    /* ─────────────────────── payment: the happy path ────────────────────── */

    function test_ProvePayment_AdvancesToCurrent() public {
        payment.provePayment(id, _proof(bytes32(uint256(1))));

        Register.Obligation memory o = register.getObligation(id);
        assertEq(uint8(o.status), uint8(Register.Status.Current));
        assertEq(o.periodsSatisfied, 1);
        assertEq(o.lastProvenHeight, txHeight, "proven height is bound by the proof");
        assertEq(o.windowEndHeight, windowEnd + PERIOD_BLOCKS, "window rolls forward");
    }

    function test_ProvePayment_RejectsProofOutsideWindow() public {
        // Roll the schedule forward so the fixture now sits in a PAST window.
        payment.provePayment(id, _proof(bytes32(uint256(1))));

        AscVerify.Proof memory p = _proof(bytes32(uint256(2)));
        vm.expectRevert(
            abi.encodeWithSelector(
                PaymentAdapter.OutsideWindow.selector, txHeight, windowEnd, windowEnd + PERIOD_BLOCKS
            )
        );
        payment.provePayment(id, p);
    }

    function test_ProvePayment_RejectsReplay() public {
        AscVerify.Proof memory p = _proof(bytes32(uint256(1)));
        payment.provePayment(id, p);

        bytes32 key = verifier.proofKey(CHAIN_KEY, txHeight, 1, 0);
        vm.expectRevert(abi.encodeWithSelector(AscVerify.ProofAlreadyConsumed.selector, key));
        payment.provePayment(id, p);
    }

    /**
     * @notice Only adapters may consume proof keys.
     * @dev Otherwise anyone could burn the key for a real payment and leave the
     *      borrower unable to prove it — a cheap way to manufacture a default.
     */
    function test_Verifier_RejectsUnauthorizedCaller() public {
        vm.expectRevert(abi.encodeWithSelector(AscVerifier.NotAuthorized.selector, address(this)));
        verifier.proveErc20Transfer(_proof(bytes32(uint256(1))), token, payer, payee, 0);
    }

    /* ──────────────────────── silence: degradation ──────────────────────── */

    function test_MarkDelinquent_RequiresClosedWindow() public {
        _observe();

        vm.expectRevert(
            abi.encodeWithSelector(
                SilenceAdapter.WindowStillOpen.selector, chainInfo.head(CHAIN_KEY), windowEnd + MIN_CONF
            )
        );
        silence.markDelinquent(id);
    }

    function test_MarkDelinquent_Succeeds() public {
        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);
        _observe();

        uint256 before = keeper.balance;
        vm.prank(keeper);
        silence.markDelinquent(id);

        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Delinquent));
        assertEq(keeper.balance - before, silence.DELINQUENCY_BOUNTY(), "keeper is paid to watch");
    }

    /**
     * @notice A satisfied window does not stay "satisfied" forever: the NEXT window
     *         is unpaid until proven, and can be marked delinquent normally.
     * @dev {SilenceAdapter.WindowAlreadySatisfied} is unreachable through this public
     *      path: {PaymentAdapter} always rolls `windowEndHeight` forward by at least
     *      one full period on success, and the admissibility bound `height <=
     *      windowEndHeight` guarantees `lastProvenHeight` can never exceed the NEW
     *      window's start. The check is kept as defense-in-depth against a future
     *      adapter that sets `lastProvenHeight` without rolling the window — this
     *      test instead confirms the property that check exists to protect: the
     *      window that actually rolls forward is genuinely open.
     */
    function test_MarkDelinquent_NextWindowIsOpenAfterAPayment() public {
        payment.provePayment(id, _proof(bytes32(uint256(1))));

        uint64 newWindowEnd = register.getObligation(id).windowEndHeight;
        assertEq(newWindowEnd, windowEnd + PERIOD_BLOCKS, "window rolled forward by one period");

        chainInfo.setHead(CHAIN_KEY, newWindowEnd + MIN_CONF);
        _observe();

        silence.markDelinquent(id);
        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Delinquent), "new window is genuinely unpaid");
    }

    /* ──────────────────────────── I4: the cure ──────────────────────────── */

    /**
     * @notice THE PROPERTY THAT MAKES PERMISSIONLESS MARKING SAFE.
     *         A payment made inside the window cures a delinquency however late it
     *         is proven. Admissibility depends on the proven height, never on when
     *         the proof arrived.
     */
    function test_Cure_LateProofOfInWindowPaymentRestoresCurrent() public {
        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);
        _observe();

        silence.markDelinquent(id);
        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Delinquent));

        // Long after the window closed, the borrower proves they had in fact paid.
        payment.provePayment(id, _proof(bytes32(uint256(1))));

        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Current), "cured");
    }

    /* ────────────────────── default and slashing ────────────────────────── */

    function test_FinalizeDefault_RejectedWhileCureOpen() public {
        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);
        _observe();
        silence.markDelinquent(id);

        vm.expectRevert(
            abi.encodeWithSelector(
                SilenceAdapter.CureStillOpen.selector, chainInfo.head(CHAIN_KEY), windowEnd + CURE_BLOCKS
            )
        );
        silence.finalizeDefault(id);
    }

    function test_FinalizeDefault_SlashesBond() public {
        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);
        _observe();
        silence.markDelinquent(id);

        bondMock.fund(uint128(txValue));
        chainInfo.setHead(CHAIN_KEY, windowEnd + CURE_BLOCKS);
        _observe();

        vm.prank(keeper);
        silence.finalizeDefault(id);

        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Default));
        assertEq(bondMock.lastPayee(), payout, "slashed to the creditor's payout address");
        assertEq(bondMock.available(), 0, "first-loss capital consumed");
    }

    /* ───────────── I7: liveness — the systemic failure mode ─────────────── */

    /**
     * @notice Nothing may be penalised on a chain that has not been watched.
     * @dev Registration pokes the head once, which is a sample, not a record.
     */
    function test_Penalties_RefusedWithoutObservationRecord() public {
        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);

        vm.expectRevert(abi.encodeWithSelector(SilenceAdapter.PenaltiesDisabled.selector, CHAIN_KEY));
        silence.markDelinquent(id);
    }

    /**
     * @notice THE ATTACK. The attestor set stalls; no proof can be produced for
     *         ANYONE. On recovery the head jumps, and every pending window becomes
     *         overdue at once. Without I7 a single outage defaults the whole book.
     */
    function test_StallRecovery_DoesNotDefaultTheBook() public {
        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);
        _observe();
        silence.markDelinquent(id);

        // Oracle stops for six hours. Wall time passes; the head does not move.
        vm.warp(block.timestamp + 6 hours);

        // Recovery: the head catches up past the cure deadline in one jump.
        chainInfo.setHead(CHAIN_KEY, windowEnd + CURE_BLOCKS + 1800);

        vm.expectRevert(abi.encodeWithSelector(SilenceAdapter.PenaltiesDisabled.selector, CHAIN_KEY));
        silence.finalizeDefault(id);

        // The borrower gets the cure window they were owed.
        payment.provePayment(id, _proof(bytes32(uint256(1))));
        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Current), "saved by the grace window");
    }

    /// @notice A fresh sample is not a fresh record — poking cannot rush a penalty.
    function test_StallRecovery_CannotBeRushedByPoking() public {
        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);
        _observe();
        silence.markDelinquent(id);

        vm.warp(block.timestamp + 6 hours);
        chainInfo.setHead(CHAIN_KEY, windowEnd + CURE_BLOCKS + 1800);
        verifier.pokeHead(CHAIN_KEY);

        vm.expectRevert(abi.encodeWithSelector(SilenceAdapter.PenaltiesDisabled.selector, CHAIN_KEY));
        silence.finalizeDefault(id);

        // Only after coverage is genuinely re-established does the default land.
        _observe();
        silence.finalizeDefault(id);
        assertEq(uint8(register.statusOf(id)), uint8(Register.Status.Default));
    }

    /* ───────────────────────────── keeper view ──────────────────────────── */

    function test_DelinquencyStatus_ExplainsWhyNot() public {
        (bool markable,,, bool liveness) = silence.delinquencyStatus(id);
        assertFalse(markable);
        assertFalse(liveness, "no observation record yet");

        chainInfo.setHead(CHAIN_KEY, windowEnd + MIN_CONF);
        _observe();

        (markable,,, liveness) = silence.delinquencyStatus(id);
        assertTrue(liveness);
        assertTrue(markable);
    }
}
