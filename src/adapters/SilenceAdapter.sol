// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AscVerifier} from "../AscVerifier.sol";
import {Register} from "../Register.sol";

interface IBond {
    function slash(uint256 id, uint128 amount, address payee) external returns (uint128 slashed);
}

/**
 * @title SilenceAdapter
 * @notice Proof absent: degrades an obligation when no payment was ever proven.
 *
 * @dev ─── WHAT THIS DOES NOT CLAIM ────────────────────────────────────────────
 *
 *      You cannot prove a negative with an inclusion proof. There is no ASC
 *      primitive for "no transaction matching predicate P exists in blocks N..M",
 *      and this contract does not pretend otherwise. Anyone reading it looking for
 *      a non-inclusion proof will not find one, because none exists.
 *
 *      ─── WHAT IT DOES PROVE ──────────────────────────────────────────────────
 *
 *      An on-chain fact about Creditcoin state:
 *
 *          no admissible proof of payment for this window was presented before the
 *          attested head passed windowEndHeight + minConfirmations
 *
 *      That is checkable, deterministic, and nobody's opinion.
 *
 *      ─── WHY THAT IS EQUIVALENT TO NON-PAYMENT ───────────────────────────────
 *
 *      Submission is permissionless — borrower, creditor, keeper, or any bot. It
 *      costs on the order of $0.000024, three orders of magnitude below any payment
 *      it would evidence. The borrower is the party most motivated to submit. And
 *      if the inference is ever wrong, {PaymentAdapter} reverses it: a proof of an
 *      in-window payment cures a delinquency however late it arrives (I4).
 *
 *      So nobody has to volunteer bad news, and nobody can suppress it. That is the
 *      whole design. Every other credit protocol has a reporter somewhere in the
 *      loop, and every one of them has been lied to.
 */
contract SilenceAdapter {
    Register public immutable register;
    AscVerifier public immutable verifier;

    /// @notice Optional first-loss layer. address(0) until Bond ships.
    IBond public immutable bond;

    /// @dev Bounties are small and paid from the obligation's own escrow. They exist
    ///      to make watching profitable, not to make marking lucrative — a large
    ///      bounty would fund exactly the griefing this design tolerates by curing.
    uint128 public constant DELINQUENCY_BOUNTY = 0.01 ether;
    uint128 public constant FINALIZE_BOUNTY = 0.02 ether;

    error PenaltiesDisabled(uint64 chainKey);
    error WindowStillOpen(uint64 attestedHead, uint64 required);
    error WindowAlreadySatisfied(uint64 lastProvenHeight, uint64 windowStart);
    error NotDelinquent(Register.Status status);
    error CureStillOpen(uint64 attestedHead, uint64 required);

    event MarkedDelinquent(uint256 indexed id, address indexed keeper, uint64 attestedHead, uint64 cureEndHeight);
    event Defaulted(uint256 indexed id, address indexed keeper, uint128 outstanding, uint128 slashed);

    constructor(Register register_, AscVerifier verifier_, IBond bond_) {
        register = register_;
        verifier = verifier_;
        bond = bond_;
    }

    /**
     * @notice Mark an obligation delinquent because its window closed unproven.
     *
     * @dev Permissionless and bounty-paid. Safe to expose to strangers only because
     *      of the cure path — see the contract note.
     *
     *      Three gates, and the order matters:
     *
     *        1. LIVENESS (I7). Penalties require an unbroken observation record. A
     *           stalled oracle produces no proofs for ANYONE, so without this a
     *           single outage would default the entire book at once. Note the head
     *           is poked first: the check must run against a current reading, and
     *           poking cannot help an attacker — any coverage gap resets the grace
     *           window, so a fresh sample is not a fresh record.
     *
     *        2. The window is closed, with confirmation depth applied. Using the
     *           attested head rather than Creditcoin's clock means a frozen head
     *           expires nothing: the protection is structural, not bolted on.
     *
     *        3. Nothing was proven for this window. `lastProvenHeight` sits inside
     *           the previous window whenever a payment has advanced the schedule, so
     *           comparing against `windowStart` asks exactly the right question.
     *
     *      Note on (3): given today's only writer of `lastProvenHeight` — {PaymentAdapter},
     *      which always rolls `windowEndHeight` forward by at least one full period on
     *      success — this branch cannot currently trigger; it is defense-in-depth
     *      against a future adapter that advances `lastProvenHeight` without rolling
     *      the window. If you add one, keep that pairing or this guard silently stops
     *      protecting anything.
     */
    function markDelinquent(uint256 id) external {
        Register.Obligation memory o = register.getObligation(id);

        verifier.pokeHead(o.chainKey);
        if (!verifier.penaltiesEnabled(o.chainKey)) revert PenaltiesDisabled(o.chainKey);

        uint64 head = verifier.attestedHead(o.chainKey);
        uint64 required = o.windowEndHeight + verifier.minConfirmations();
        if (head < required) revert WindowStillOpen(head, required);

        uint64 windowStart = o.windowEndHeight - o.periodBlocks;
        if (o.lastProvenHeight > windowStart) revert WindowAlreadySatisfied(o.lastProvenHeight, windowStart);

        register.markStatus(id, Register.Status.Delinquent);
        register.payBounty(id, msg.sender, DELINQUENCY_BOUNTY);

        emit MarkedDelinquent(id, msg.sender, head, o.windowEndHeight + o.cureBlocks);
    }

    /**
     * @notice Finalize a default once the cure window has passed unproven, and slash.
     *
     * @dev The liveness gate is re-checked rather than assumed from {markDelinquent}.
     *      A stall can begin between the two calls, and the cure window is precisely
     *      the period during which a borrower needs the oracle to be working in
     *      order to save themselves. Defaulting someone for failing to submit a
     *      proof they could not have submitted is the one outcome this system must
     *      never produce.
     */
    function finalizeDefault(uint256 id) external {
        Register.Obligation memory o = register.getObligation(id);
        if (o.status != Register.Status.Delinquent) revert NotDelinquent(o.status);

        verifier.pokeHead(o.chainKey);
        if (!verifier.penaltiesEnabled(o.chainKey)) revert PenaltiesDisabled(o.chainKey);

        uint64 head = verifier.attestedHead(o.chainKey);
        uint64 required = o.windowEndHeight + o.cureBlocks;
        if (head < required) revert CureStillOpen(head, required);

        register.markStatus(id, Register.Status.Default);

        uint128 slashed;
        if (address(bond) != address(0)) {
            slashed = bond.slash(id, o.outstanding, o.creditorPayout);
        }

        register.payBounty(id, msg.sender, FINALIZE_BOUNTY);

        emit Defaulted(id, msg.sender, o.outstanding, slashed);
    }

    /* ─────────────────────────────── views ─────────────────────────────── */

    /// @notice Whether {markDelinquent} would succeed right now, and why not if not.
    /// @dev For keepers and the Lens, so a UI can show "cure by block N" honestly.
    function delinquencyStatus(uint256 id)
        external
        view
        returns (bool markable, uint64 attestedHead_, uint64 requiredHeight, bool liveness)
    {
        Register.Obligation memory o = register.getObligation(id);
        liveness = verifier.penaltiesEnabled(o.chainKey);
        attestedHead_ = verifier.attestedHead(o.chainKey);
        requiredHeight = o.windowEndHeight + verifier.minConfirmations();

        bool open = attestedHead_ >= requiredHeight;
        bool unsatisfied = o.lastProvenHeight <= o.windowEndHeight - o.periodBlocks;
        bool eligible = o.status == Register.Status.Active || o.status == Register.Status.Current;

        markable = liveness && open && unsatisfied && eligible;
    }
}
