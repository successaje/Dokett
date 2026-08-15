// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AscVerify} from "../lib/AscVerify.sol";
import {AscVerifier} from "../AscVerifier.sol";
import {Register} from "../Register.sol";

/**
 * @title PaymentAdapter
 * @notice Proof present: advances an obligation on a verified Ethereum repayment.
 *
 * @dev The happy path, and — with no extra code — the cure path.
 *
 *      Admissibility is decided by the PROVEN HEIGHT, never by when the proof was
 *      submitted. A payment made inside a window is admissible whether it is proven
 *      one minute or one month later, so a delinquency raised because nobody
 *      submitted in time is always reversible by submitting late (I4). That single
 *      comparison is what makes it safe to hand {SilenceAdapter.markDelinquent} to
 *      strangers: the worst a wrong mark can do is embarrass the marker.
 *
 *      Nothing here trusts the caller. The transfer's token, payer, payee and
 *      minimum value are taken from the obligation and enforced by the verifier
 *      against the decoded log; the height is bound by the merkle and continuity
 *      proofs. The caller chooses only WHICH obligation to point the proof at, and
 *      a proof that does not match it reverts.
 */
contract PaymentAdapter {
    Register public immutable register;
    AscVerifier public immutable verifier;

    error WrongChain(uint64 expected, uint64 actual);
    error OutsideWindow(uint64 provenHeight, uint64 windowStart, uint64 windowEnd);
    error BelowPeriodAmount(uint256 value, uint128 periodAmount);
    error ScheduleComplete();
    error ValueTooLarge(uint256 value);

    event PaymentProven(
        uint256 indexed id, address indexed submitter, uint64 provenHeight, uint256 value, uint8 periodsCovered
    );

    constructor(Register register_, AscVerifier verifier_) {
        register = register_;
        verifier = verifier_;
    }

    /**
     * @notice Prove a repayment and advance the obligation.
     * @dev Permissionless: borrower, creditor, keeper or any bot. Submission costs a
     *      fraction of a cent, which is the assumption {SilenceAdapter} rests on —
     *      if proving were expensive or gated, non-submission would stop being
     *      evidence of non-payment.
     */
    function provePayment(uint256 id, AscVerify.Proof calldata p) external {
        Register.Obligation memory o = register.getObligation(id);
        if (p.chainKey != o.chainKey) revert WrongChain(o.chainKey, p.chainKey);
        if (o.periodsSatisfied >= o.periodsTotal) revert ScheduleComplete();

        // Verifier enforces: confirmation depth, receipt status, replay, emitter,
        // event signature, both parties, and the minimum value. It reverts on any
        // mismatch, so everything below is operating on a proven transfer.
        (uint256 value, uint64 height) =
            verifier.proveErc20Transfer(p, o.sourceToken, o.sourcePayer, o.sourcePayee, o.periodAmount);

        uint64 windowEnd = o.windowEndHeight;
        uint64 windowStart = windowEnd - o.periodBlocks;
        if (height <= windowStart || height > windowEnd) {
            revert OutsideWindow(height, windowStart, windowEnd);
        }

        if (value > type(uint128).max) revert ValueTooLarge(value);

        // Overpayment covers whole future windows, capped by what remains. A borrower
        // who pays three periods at once should not still be delinquent next month.
        uint256 covered = value / o.periodAmount;
        uint256 remaining = o.periodsTotal - o.periodsSatisfied;
        if (covered == 0) revert BelowPeriodAmount(value, o.periodAmount);
        if (covered > remaining) covered = remaining;

        register.recordPayment(id, height, uint128(value), uint8(covered));

        emit PaymentProven(id, msg.sender, height, value, uint8(covered));
    }
}
