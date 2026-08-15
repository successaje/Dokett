// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Bond} from "../src/Bond.sol";
import {Register} from "../src/Register.sol";
import {AscVerify} from "../src/lib/AscVerify.sol";
import {AscVerifier, IAdapterAllowlist} from "../src/AscVerifier.sol";
import {NativeQueryVerifierLib} from "../src/interfaces/INativeQueryVerifier.sol";
import {ChainInfoLib} from "../src/interfaces/IChainInfo.sol";
import {MockBlockProver, MockChainInfo} from "./mocks/MockPrecompiles.sol";

contract MockUSDC {
    string public name = "Mock USDC";
    uint8 public decimals = 6;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 v) external {
        balanceOf[to] += v;
    }

    function approve(address s, uint256 v) external returns (bool) {
        allowance[msg.sender][s] = v;
        return true;
    }

    function transfer(address to, uint256 v) external returns (bool) {
        balanceOf[msg.sender] -= v;
        balanceOf[to] += v;
        return true;
    }

    function transferFrom(address f, address t, uint256 v) external returns (bool) {
        uint256 a = allowance[f][msg.sender];
        require(a >= v, "allowance");
        if (a != type(uint256).max) allowance[f][msg.sender] = a - v;
        balanceOf[f] -= v;
        balanceOf[t] += v;
        return true;
    }
}

/// @dev Stands in for the adapters: lets a test drive Register status directly.
contract StatusDriver {
    Register public immutable register;

    constructor(Register r) {
        register = r;
    }

    function set(uint256 id, Register.Status s) external {
        register.markStatus(id, s);
    }

    /**
     * @dev Health cannot be asserted, only proven — {Register.markStatus} rejects
     *      Active→Current by design (I2), so a test that wants a Settled obligation
     *      has to go through the payment path like everyone else.
     */
    function pay(uint256 id, uint64 height, uint128 value, uint8 periods) external {
        register.recordPayment(id, height, value, periods);
    }

    function slash(Bond bond, uint256 id, uint128 amount, address payee) external returns (uint128) {
        return bond.slash(id, amount, payee);
    }
}

contract BondTest is Test {
    uint64 constant CHAIN_KEY = 3;
    uint64 constant ETH_CHAIN_ID = 1;
    uint64 constant PERIOD_BLOCKS = 216_000;

    Register register;
    AscVerifier verifier;
    Bond bond;
    MockUSDC usdc;
    StatusDriver driver;
    MockChainInfo chainInfo;

    address timelock = makeAddr("timelock");
    address registrar = makeAddr("registrar");
    address alice = makeAddr("alice"); // underwriter
    address bob = makeAddr("bob"); // underwriter
    address creditor = makeAddr("creditor"); // premium funder
    address payout = makeAddr("payout");

    uint256 id;

    function setUp() public {
        deployCodeTo("MockPrecompiles.sol:MockBlockProver", NativeQueryVerifierLib.PRECOMPILE_ADDRESS);
        deployCodeTo("MockPrecompiles.sol:MockChainInfo", ChainInfoLib.PRECOMPILE_ADDRESS);
        chainInfo = MockChainInfo(ChainInfoLib.PRECOMPILE_ADDRESS);
        chainInfo.setChain(CHAIN_KEY, ETH_CHAIN_ID, 1_000_000);

        verifier = new AscVerifier(64, 15 minutes, 1 hours);
        register = new Register(AscVerify(address(verifier)), timelock);
        verifier.initialize(IAdapterAllowlist(address(register)));

        bond = new Bond(register, timelock);
        usdc = new MockUSDC();
        driver = new StatusDriver(register);

        vm.prank(timelock);
        bond.setCollateral(address(usdc), true);

        vm.prank(timelock);
        register.queueAdapter(address(driver), true);
        vm.warp(block.timestamp + register.ADAPTER_TIMELOCK());
        register.setAdapter(address(driver));

        vm.deal(registrar, 100 ether);
        id = _register();

        for (uint256 i = 0; i < 3; i++) {
            address who = [alice, bob, creditor][i];
            usdc.mint(who, 1_000_000e6);
            vm.prank(who);
            usdc.approve(address(bond), type(uint256).max);
        }
    }

    function _register() internal returns (uint256) {
        Register.ObligationInit memory i;
        i.obligor = keccak256("obligor");
        i.creditor = keccak256("creditor");
        i.creditorPayout = payout;
        i.chainKey = CHAIN_KEY;
        i.sourceToken = address(0xA);
        i.sourcePayer = address(0xB);
        i.sourcePayee = address(0xC);
        i.principal = 3000e6;
        i.periodAmount = 1000e6;
        i.aprBps = 340;
        i.startHeight = 500_000;
        i.periodBlocks = PERIOD_BLOCKS;
        i.cureBlocks = 50_400;
        i.periodsTotal = 3;

        vm.prank(registrar);
        return register.register{value: 5 ether}(i, ETH_CHAIN_ID);
    }

    function _post(address who, uint128 amount) internal returns (uint256) {
        vm.prank(who);
        return bond.post(id, address(usdc), amount, 340);
    }

    /* ─────────────────────────── underwriting ──────────────────────────── */

    function test_Post_StakesNamedFirstLoss() public {
        uint256 bondId = _post(alice, 500e6);

        (, address underwriter,,, uint128 amount,,,, ) = bond.positions(bondId);
        assertEq(underwriter, alice);
        assertEq(amount, 500e6);
        assertEq(usdc.balanceOf(address(bond)), 500e6, "capital is escrowed, not promised");
        assertEq(bond.coverageOf(id), 500e6);
    }

    function test_Post_RejectsUnallowedCollateral() public {
        MockUSDC rogue = new MockUSDC();
        vm.expectRevert(abi.encodeWithSelector(Bond.CollateralNotAllowed.selector, address(rogue)));
        vm.prank(alice);
        bond.post(id, address(rogue), 500e6, 340);
    }

    function test_Post_RejectsDefaultedObligation() public {
        driver.set(id, Register.Status.Delinquent);
        driver.set(id, Register.Status.Default);

        vm.expectRevert(
            abi.encodeWithSelector(Bond.ObligationNotBondable.selector, Register.Status.Default)
        );
        vm.prank(alice);
        bond.post(id, address(usdc), 500e6, 340);
    }

    /**
     * @notice The bond-count cap is a liveness guard, not a policy preference.
     * @dev {slash} walks this list. Uncapped, an attacker posts dust bonds until
     *      slashing exceeds the block gas limit, and a defaulted obligation becomes
     *      permanently unslashable — the exact outcome the protocol exists to prevent.
     */
    function test_Post_CapsBondCount() public {
        for (uint256 i = 0; i < bond.MAX_BONDS_PER_OBLIGATION(); i++) {
            _post(alice, bond.MIN_BOND());
        }
        // Hoisted: an argument that is itself a call gets evaluated AFTER
        // expectRevert is armed, so expectRevert would bind to the getter, not post().
        uint128 min = bond.MIN_BOND();

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Bond.TooManyBonds.selector, id));
        bond.post(id, address(usdc), min, 340);
    }

    /* ───────────────────────────── slashing ────────────────────────────── */

    /**
     * @notice A money-moving contract must re-derive the fact, not trust the caller.
     * @dev An allowlisted adapter that has NOT driven the Register to Default still
     *      cannot slash. This is what stops a compromised or buggy adapter from
     *      inventing a default and draining first-loss capital.
     */
    function test_Slash_RequiresRegisterToAgreeItIsDefaulted() public {
        _post(alice, 500e6);

        vm.expectRevert(
            abi.encodeWithSelector(Bond.ObligationNotDefaulted.selector, Register.Status.Active)
        );
        driver.slash(bond, id, 500e6, payout);
    }

    function test_Slash_RejectsNonAdapter() public {
        _post(alice, 500e6);
        vm.expectRevert(abi.encodeWithSelector(Bond.NotAdapter.selector, address(this)));
        bond.slash(id, 500e6, payout);
    }

    function test_Slash_PaysCreditorAndRefundsPremium() public {
        uint256 bondId = _post(alice, 500e6);

        vm.prank(creditor);
        bond.fundPremium(bondId, 17e6);

        driver.set(id, Register.Status.Delinquent);
        driver.set(id, Register.Status.Default);

        uint256 creditorBefore = usdc.balanceOf(creditor);
        uint128 slashed = driver.slash(bond, id, 500e6, payout);

        assertEq(slashed, 500e6, "first-loss consumed");
        assertEq(usdc.balanceOf(payout), 500e6, "creditor is made whole from the bond");
        assertEq(
            usdc.balanceOf(creditor) - creditorBefore,
            17e6,
            "premium returns to its funder: they got the payout, they do not also keep the fee"
        );
        assertEq(bond.coverageOf(id), 0);
    }

    /// @notice Loss is shared in proportion to capital at risk, not by list order.
    function test_Slash_IsProRataAcrossUnderwriters() public {
        _post(alice, 750e6);
        _post(bob, 250e6);

        driver.set(id, Register.Status.Delinquent);
        driver.set(id, Register.Status.Default);

        driver.slash(bond, id, 400e6, payout);

        assertEq(usdc.balanceOf(payout), 400e6);
        assertEq(bond.coverageOf(id), 600e6, "600 of 1000 still live");
        // alice absorbed 75% of the loss, bob 25%
        (,,,, uint128 aAmt,, uint128 aSlashed,,) = bond.positions(1);
        (,,,, uint128 bAmt,, uint128 bSlashed,,) = bond.positions(2);
        assertEq(aAmt - aSlashed, 450e6);
        assertEq(bAmt - bSlashed, 150e6);
    }

    /// @notice Slashing is capped by bonded capital: the bond is first-loss, not full recourse.
    function test_Slash_CappedByCoverage() public {
        _post(alice, 100e6);

        driver.set(id, Register.Status.Delinquent);
        driver.set(id, Register.Status.Default);

        uint128 slashed = driver.slash(bond, id, 5000e6, payout);
        assertEq(slashed, 100e6, "cannot slash capital that was never posted");
    }

    /* ───────────────────────────── settlement ──────────────────────────── */

    function test_Release_PaysPrincipalPlusPremium() public {
        uint256 bondId = _post(alice, 500e6);

        vm.prank(creditor);
        bond.fundPremium(bondId, 17e6);

        driver.pay(id, 716_000, 3000e6, 3); // full schedule -> Settled

        uint256 before = usdc.balanceOf(alice);
        bond.release(bondId); // permissionless: anyone may close it out

        assertEq(usdc.balanceOf(alice) - before, 517e6, "principal back, premium earned");
    }

    function test_Release_RejectedBeforeSettlement() public {
        uint256 bondId = _post(alice, 500e6);
        vm.expectRevert(
            abi.encodeWithSelector(Bond.ObligationNotSettled.selector, Register.Status.Active)
        );
        bond.release(bondId);
    }

    function test_Release_RejectsDoubleRelease() public {
        uint256 bondId = _post(alice, 500e6);
        driver.pay(id, 716_000, 3000e6, 3);

        bond.release(bondId);
        vm.expectRevert(abi.encodeWithSelector(Bond.AlreadyReleased.selector, bondId));
        bond.release(bondId);
    }

    /* ───────────────────────── INV-1: accounting ───────────────────────── */

    /**
     * @notice INV-1: Σ slashed + Σ released ≤ Σ posted. No bond inflation, ever.
     * @dev Fuzzed over the two terminal paths. If this can be broken, the protocol
     *      pays out capital that was never staked.
     */
    function testFuzz_Inv1_NoBondInflation(uint128 a, uint128 b, uint128 premium, bool defaults) public {
        a = uint128(bound(a, bond.MIN_BOND(), 100_000e6));
        b = uint128(bound(b, bond.MIN_BOND(), 100_000e6));
        premium = uint128(bound(premium, 0, 10_000e6));

        uint256 bondA = _post(alice, a);
        _post(bob, b);

        vm.prank(creditor);
        bond.fundPremium(bondA, premium);

        if (defaults) {
            driver.set(id, Register.Status.Delinquent);
            driver.set(id, Register.Status.Default);
            driver.slash(bond, id, a + b, payout);
        } else {
            driver.pay(id, 716_000, 3000e6, 3);
            bond.release(bondA);
            bond.release(2);
        }

        assertLe(
            bond.totalSettled(address(usdc)),
            bond.totalPosted(address(usdc)),
            "INV-1: cannot pay out more than was staked"
        );
        assertEq(
            usdc.balanceOf(address(bond)),
            bond.totalPosted(address(usdc)) - bond.totalSettled(address(usdc)),
            "escrow balance must equal unsettled capital"
        );
    }
}
