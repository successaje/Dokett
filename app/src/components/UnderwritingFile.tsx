import { big, bps, units } from '../lib/format';
import type { ObligationDetail } from '../lib/types';

/**
 * The underwriting file.
 *
 * ─── WHY THIS IS A DOCUMENT AND NOT A FORM ─────────────────────────────────
 *
 * The obvious thing to build here is an "Underwrite" button. We deliberately
 * did not, and the reason is worth stating rather than hiding.
 *
 * `Bond.post` pulls collateral with `transferFrom(msg.sender, ...)`, so the
 * underwriter must be the caller. A relay cannot submit on someone's behalf the
 * way it does for a cure, because the capital at risk has to be theirs — a
 * sponsored bond would be the relay's position wearing someone else's name.
 * Making it delegatable means redeploying `Bond` and `SilenceAdapter`, which
 * re-enters the 48-hour adapter timelock.
 *
 * So taking a position genuinely requires a wallet on CC3, CTC for gas,
 * collateral, and two signatures. Rendering a button that leads to four
 * unstated prerequisites would be a worse experience than saying so.
 *
 * What an underwriter actually needs first is not a button — it is the file:
 * what is owed, what has been proven, who is already exposed, and what a
 * position would cost if this defaults. That is what this renders, and every
 * figure in it is derived from the register rather than asserted.
 */

const BONDABLE = new Set(['Active', 'Current']);

export default function UnderwritingFile({ o }: { o: ObligationDetail }) {
  if (!BONDABLE.has(o.status)) return null;

  const outstanding = big(o.outstanding);
  const coverage = big(o.coverage);
  const live = o.bonds.filter((b) => !b.released);

  // Uncovered exposure — what a creditor eats today if this defaults. Floors at
  // zero rather than rendering a negative: coverage above outstanding is
  // over-collateralised, not "negative exposure".
  const uncovered = outstanding > coverage ? outstanding - coverage : 0n;
  const coveredPct =
    outstanding > 0n ? Number((coverage * 10000n) / outstanding) / 100 : 0;

  const proven = o.periodsSatisfied;
  const total = o.periodsTotal;
  const provenPct = total > 0 ? Math.round((proven / total) * 100) : 0;

  // The spread the existing book is charging, if anyone has priced this yet.
  const quoted = live.length
    ? Math.round(live.reduce((s, b) => s + b.spreadBps, 0) / live.length)
    : null;

  return (
    <div className="uwfile">
      <div className="uwfile-grid">
        <div className="uwfile-cell">
          <div className="uwfile-k">Outstanding</div>
          <div className="uwfile-v">{units(o.outstanding)}</div>
          <div className="uwfile-s">of {units(o.principal)} principal</div>
        </div>

        <div className="uwfile-cell">
          <div className="uwfile-k">Already covered</div>
          <div className="uwfile-v">{units(o.coverage)}</div>
          <div className="uwfile-s">
            {live.length === 0
              ? 'no first-loss capital posted'
              : `${coveredPct.toFixed(1)}% across ${live.length} bond${live.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="uwfile-cell" data-emphasis={uncovered > 0n ? 'true' : 'false'}>
          <div className="uwfile-k">Uncovered exposure</div>
          <div className="uwfile-v">{units(uncovered.toString())}</div>
          <div className="uwfile-s">
            {uncovered > 0n ? 'the creditor carries this today' : 'fully covered'}
          </div>
        </div>

        <div className="uwfile-cell">
          <div className="uwfile-k">Payment record</div>
          <div className="uwfile-v">
            {proven}/{total}
          </div>
          <div className="uwfile-s">
            {proven === 0
              ? 'nothing proven yet'
              : `${provenPct}% proven on the source chain`}
          </div>
        </div>
      </div>

      <div className="uwfile-note">
        <p>
          <strong>What a position does.</strong> Post collateral against this obligation and you
          are first in line for loss: if it defaults on verified evidence, your stake is slashed
          pro-rata to the creditor in the same transaction that finalises the default — no
          committee, no vote, no claim to file. If it settles, you keep the stake and collect the
          premium the creditor escrowed.
        </p>
        <p>
          {quoted === null ? (
            <>
              <strong>Nobody has priced this borrower yet.</strong> There is no spread to compare
              against, which is itself information — the first underwriter here sets the number.
            </>
          ) : (
            <>
              <strong>The book is currently quoting {bps(quoted)}.</strong> That is what existing
              underwriters judged this borrower to be worth, with their own capital behind the
              opinion.
            </>
          )}{' '}
          Track records on this registry are recomputed from bond events rather than assigned, so a
          spread here is a price, not a rating.
        </p>
        <p className="uwfile-caveat">
          Taking a position is not sponsored the way curing is, and that is deliberate:{' '}
          <code className="mono">Bond.post</code> pulls collateral from the caller, so the capital
          at risk has to be yours. It needs a wallet on Creditcoin CC3, CTC for gas, and an
          allowlisted collateral token —{' '}
          <a href="#/developers">the contract addresses and ABI are on the Developers page</a>.
        </p>
      </div>
    </div>
  );
}
