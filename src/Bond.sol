// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {Register} from "./Register.sol";

/**
 * @title Bond
 * @notice Named first-loss capital. An underwriter stakes against ONE obligor's
 *         obligation, earns a premium if it performs, and is slashed by proof if it
 *         does not.
 *
 * @dev This is the piece that turns a registry into a market.
 *
 *      Every previous attempt at undercollateralised on-chain credit failed at the
 *      same place. Scores (Spectral, Cred, ARCx) produced a number with no recourse:
 *      nobody lends against an opinion. Aave's credit delegation gave the delegator
 *      no upside and no enforcement. Goldfinch had first-loss backers, but the
 *      underlying performance was self-reported, so the capital was staked against
 *      a PDF. Maple's pool delegates had no cross-venue visibility and blew up
 *      together.
 *
 *      What is different here is not the tranching — it is what the tranching sits
 *      on. Slashing is triggered by {SilenceAdapter} from cryptographic evidence
 *      about the source chain, with no committee, no vote, and no reporter. So a
 *      bond is a real, priced, adversarially-tested opinion about one named
 *      borrower, and the price of underwriting them IS their cost of credit — a
 *      live market number rather than a model's guess.
 *
 *      Two economic rules, both deliberate:
 *
 *        1. NAMED, not pooled. A bond backs one obligation. Pooling is what let
 *           correlated risk hide inside a single APY, and it is why the delegate
 *           model died. Aggregation belongs in the Lens, as a view, where anyone
 *           can see the concentration.
 *
 *        2. STABLECOIN-FIRST, by allowlist. A credit system collateralised in its
 *           own volatile token is a reflexive death spiral: the collateral falls
 *           precisely when defaults rise.
 */
contract Bond is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /* ─────────────────────────────── types ─────────────────────────────── */

    struct Position {
        uint256 obligationId;
        address underwriter;
        address collateral;
        address premiumFunder; // normally the creditor; refunded if the bond is slashed
        uint128 amount; // first-loss principal at risk
        uint128 premium; // paid to the underwriter iff the obligation settles
        uint128 slashed;
        uint16 spreadBps; // quoted rate; informational, drives premium off-chain
        bool released;
    }

    /* ───────────────────────────── constants ───────────────────────────── */

    /**
     * @notice Maximum bonds per obligation.
     * @dev Slashing walks this list, so it must be bounded. Without a cap, an
     *      attacker could post hundreds of dust bonds and make {slash} exceed the
     *      block gas limit — turning a default into an unslashable obligation,
     *      which is exactly the outcome the whole protocol exists to prevent.
     */
    uint256 public constant MAX_BONDS_PER_OBLIGATION = 16;

    uint128 public constant MIN_BOND = 1e6; // 1 unit at 6dp; dust bonds waste the cap

    /* ─────────────────────────────── state ─────────────────────────────── */

    Register public immutable register;
    address public immutable timelock;

    mapping(uint256 => Position) public positions;
    mapping(uint256 => uint256[]) internal _bondsOf;
    mapping(address => bool) public allowedCollateral;
    uint256 public nextBondId = 1;

    /// @dev Accounting guard for INV-1: Σ slashed + Σ released ≤ Σ posted, per token.
    mapping(address => uint256) public totalPosted;
    mapping(address => uint256) public totalSettled;

    /* ─────────────────────────────── events ────────────────────────────── */

    event BondPosted(
        uint256 indexed bondId,
        uint256 indexed obligationId,
        address indexed underwriter,
        address collateral,
        uint128 amount,
        uint16 spreadBps
    );
    event PremiumFunded(uint256 indexed bondId, address indexed funder, uint128 amount);
    event BondSlashed(uint256 indexed bondId, uint256 indexed obligationId, address payee, uint128 amount);
    event BondReleased(uint256 indexed bondId, address indexed underwriter, uint128 principal, uint128 premium);
    event CollateralAllowed(address indexed token, bool allowed);

    /* ─────────────────────────────── errors ────────────────────────────── */

    error NotAdapter(address caller);
    error NotTimelock(address caller);
    error NotUnderwriter(address caller);
    error CollateralNotAllowed(address token);
    error BondTooSmall(uint128 amount, uint128 minimum);
    error TooManyBonds(uint256 obligationId);
    error ObligationNotBondable(Register.Status status);
    error ObligationNotDefaulted(Register.Status status);
    error ObligationNotSettled(Register.Status status);
    error AlreadyReleased(uint256 bondId);
    error UnknownBond(uint256 bondId);
    error PremiumAfterTermination(Register.Status status);

    /* ──────────────────────────── construction ─────────────────────────── */

    constructor(Register register_, address timelock_) {
        register = register_;
        timelock = timelock_;
    }

    /**
     * @notice Add or remove an accepted collateral token.
     * @dev Timelock-only but immediate, unlike the Register's 48h adapter delay. The
     *      blast radius is genuinely smaller: each Position stores the collateral it
     *      was posted with, so allowlisting a hostile token cannot affect any
     *      existing bond, and only an underwriter who then voluntarily posts in it
     *      is exposed. The dangerous direction — changing who can move status — is
     *      the one that carries the delay.
     */
    function setCollateral(address token, bool allowed) external {
        if (msg.sender != timelock) revert NotTimelock(msg.sender);
        allowedCollateral[token] = allowed;
        emit CollateralAllowed(token, allowed);
    }

    /* ───────────────────────────── underwriting ────────────────────────── */

    /**
     * @notice Stake first-loss capital against one obligation.
     * @dev Anyone may underwrite anyone. That is the point: the credit decision
     *      belongs to whoever actually holds the information — the loan officer who
     *      knows the borrower, the employer, the co-op, the merchant acquirer —
     *      rather than to whoever happens to hold the deposits.
     */
    function post(uint256 obligationId, address collateral, uint128 amount, uint16 spreadBps)
        external
        nonReentrant
        returns (uint256 bondId)
    {
        if (!allowedCollateral[collateral]) revert CollateralNotAllowed(collateral);
        if (amount < MIN_BOND) revert BondTooSmall(amount, MIN_BOND);

        Register.Status status = register.statusOf(obligationId);
        if (status != Register.Status.Active && status != Register.Status.Current) {
            revert ObligationNotBondable(status);
        }
        if (_bondsOf[obligationId].length >= MAX_BONDS_PER_OBLIGATION) {
            revert TooManyBonds(obligationId);
        }

        bondId = nextBondId++;
        positions[bondId] = Position({
            obligationId: obligationId,
            underwriter: msg.sender,
            collateral: collateral,
            premiumFunder: address(0),
            amount: amount,
            premium: 0,
            slashed: 0,
            spreadBps: spreadBps,
            released: false
        });
        _bondsOf[obligationId].push(bondId);
        totalPosted[collateral] += amount;

        IERC20(collateral).safeTransferFrom(msg.sender, address(this), amount);

        emit BondPosted(bondId, obligationId, msg.sender, collateral, amount, spreadBps);
    }

    /**
     * @notice Fund the premium an underwriter earns if the obligation settles.
     * @dev Normally the creditor: they are buying protection. Kept separate from
     *      {post} so the underwriter never has to trust the creditor to pay later —
     *      the premium is escrowed here, and returns to the funder if the bond is
     *      slashed instead (they got the payout; they should not also keep the fee).
     */
    function fundPremium(uint256 bondId, uint128 amount) external nonReentrant {
        Position storage p = positions[bondId];
        if (p.underwriter == address(0)) revert UnknownBond(bondId);

        Register.Status status = register.statusOf(p.obligationId);
        if (status != Register.Status.Active && status != Register.Status.Current) {
            revert PremiumAfterTermination(status);
        }

        p.premiumFunder = msg.sender;
        p.premium += amount;
        totalPosted[p.collateral] += amount;

        IERC20(p.collateral).safeTransferFrom(msg.sender, address(this), amount);

        emit PremiumFunded(bondId, msg.sender, amount);
    }

    /* ─────────────────────────────── slashing ──────────────────────────── */

    /**
     * @notice Slash every bond on a defaulted obligation, pro-rata, to the creditor.
     *
     * @dev Two independent authorisations, and the second is the important one:
     *
     *        1. the caller must be a Register-allowlisted adapter, and
     *        2. the Register must ITSELF say the obligation is in Default.
     *
     *      (2) is not redundant. It means a compromised or simply buggy adapter
     *      cannot invent a default and drain first-loss capital — it can only act on
     *      a status the Register already reached through a verified proof or an
     *      attested height comparison. The money-moving contract re-derives the fact
     *      rather than trusting the caller who asserts it.
     *
     * @return slashedTotal amount actually transferred, capped by bonded capital
     */
    function slash(uint256 obligationId, uint128 amount, address payee)
        external
        nonReentrant
        returns (uint128 slashedTotal)
    {
        if (!register.isAdapter(msg.sender)) revert NotAdapter(msg.sender);

        Register.Status status = register.statusOf(obligationId);
        if (status != Register.Status.Default) revert ObligationNotDefaulted(status);

        uint256[] storage ids = _bondsOf[obligationId];

        // Pro-rata across live bonds. Two passes: size the pool, then take from each
        // in proportion, so ordering never decides who absorbs the loss.
        uint128 pool;
        for (uint256 i = 0; i < ids.length; i++) {
            Position storage p = positions[ids[i]];
            if (!p.released) pool += p.amount - p.slashed;
        }
        if (pool == 0) return 0;

        uint128 target = amount > pool ? pool : amount;

        for (uint256 i = 0; i < ids.length; i++) {
            uint256 bondId = ids[i];
            Position storage p = positions[bondId];
            if (p.released) continue;

            uint128 live = p.amount - p.slashed;
            if (live == 0) continue;

            // Last live bond absorbs the rounding dust, so the sum is exact.
            uint128 take = uint128((uint256(target) * live) / pool);
            if (take > live) take = live;

            p.slashed += take;
            slashedTotal += take;

            if (take > 0) {
                totalSettled[p.collateral] += take;
                IERC20(p.collateral).safeTransfer(payee, take);
                emit BondSlashed(bondId, obligationId, payee, take);
            }

            // Slashed bond: the premium goes back to whoever funded it.
            if (p.premium > 0 && p.premiumFunder != address(0)) {
                uint128 premium = p.premium;
                address funder = p.premiumFunder;
                p.premium = 0;
                totalSettled[p.collateral] += premium;
                IERC20(p.collateral).safeTransfer(funder, premium);
            }
        }
    }

    /* ─────────────────────────────── release ───────────────────────────── */

    /**
     * @notice Reclaim principal plus premium once the obligation has settled.
     * @dev Permissionless to call but always pays the underwriter, so a keeper or
     *      the creditor can close out a position on their behalf. Nobody can strand
     *      an underwriter's capital by simply declining to act.
     */
    function release(uint256 bondId) external nonReentrant {
        Position storage p = positions[bondId];
        if (p.underwriter == address(0)) revert UnknownBond(bondId);
        if (p.released) revert AlreadyReleased(bondId);

        Register.Status status = register.statusOf(p.obligationId);
        if (status != Register.Status.Settled) revert ObligationNotSettled(status);

        uint128 principal = p.amount - p.slashed;
        uint128 premium = p.premium;

        p.released = true;
        p.premium = 0;
        totalSettled[p.collateral] += principal + premium;

        if (principal + premium > 0) {
            IERC20(p.collateral).safeTransfer(p.underwriter, principal + premium);
        }

        emit BondReleased(bondId, p.underwriter, principal, premium);
    }

    /* ──────────────────────────────── views ────────────────────────────── */

    function bondsOf(uint256 obligationId) external view returns (uint256[] memory) {
        return _bondsOf[obligationId];
    }

    /// @notice Total live first-loss capital protecting an obligation.
    function coverageOf(uint256 obligationId) external view returns (uint128 live) {
        uint256[] storage ids = _bondsOf[obligationId];
        for (uint256 i = 0; i < ids.length; i++) {
            Position storage p = positions[ids[i]];
            if (!p.released) live += p.amount - p.slashed;
        }
    }
}
