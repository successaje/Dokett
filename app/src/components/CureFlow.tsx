import { useState } from 'react';
import type { Obligation } from '../lib/types';

/**
 * The cure path, made reachable by a human.
 *
 * ─── WHY THIS SCREEN EXISTS ────────────────────────────────────────────────
 *
 * THREAT-MODEL T-04 names a residual risk plainly: a borrower who paid, but
 * whose proof nobody submitted before the cure window closed, is wrongly
 * defaulted. The stated mitigation was "borrower self-service in the Console" —
 * which was, until now, a promise with no mechanism behind it.
 *
 * This is the mechanism. It is deliberately the least clever screen in the app:
 * one field, one button, and an honest account of what happens next.
 *
 * ─── NO LOGIN REQUIRED, ON PURPOSE ─────────────────────────────────────────
 *
 * `provePayment` admits a proof on the height it binds to, never on who sent
 * it. Borrower, creditor, keeper, stranger — all identical to the contract. So
 * this form is open to anyone, and it stays open when signed out.
 *
 * That is not laxity. If curing required an account, a borrower's rescue would
 * depend on our auth vendor being reachable at the moment it mattered, and the
 * protocol's fairness claim would quietly become a claim about our uptime.
 */

type Stage = 'idle' | 'fetching' | 'submitting' | 'done' | 'error';

const TX_RE = /^0x[0-9a-fA-F]{64}$/;

export default function CureFlow({ obligation }: { obligation: Obligation }) {
  const [txHash, setTxHash] = useState('');
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState<string | null>(null);

  const curable = obligation.status === 'Delinquent';
  const valid = TX_RE.test(txHash.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    setStage('fetching');
    setMessage(null);

    try {
      /*
       * Wiring note, left visible rather than faked: this needs a submitter with
       * CTC for gas. The honest options are a relay endpoint or the signed-in
       * user's embedded wallet, and which one ships depends on whether a
       * paymaster is available on CC3 — Creditcoin supports EIP-4337, so
       * sponsorship is possible but not yet configured.
       *
       * Until that decision is made this reports the real state instead of
       * pretending to have submitted. A cure screen that silently does nothing
       * is worse than no cure screen: the borrower stops looking for help.
       */
      const res = await fetch('/api/cure', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ obligationId: obligation.id, txHash: txHash.trim() }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `relay returned ${res.status}`);
      }

      setStage('done');
      setMessage('Proof accepted and submitted. The obligation returns to Current once it confirms.');
    } catch (err) {
      setStage('error');
      setMessage(
        err instanceof Error && err.message.includes('404')
          ? 'No relay is configured on this deployment yet, so nothing was submitted. Anyone can still cure this obligation directly by calling provePayment with the proof for this transaction — the contract does not care who sends it.'
          : `Nothing was submitted: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (!curable) return null;

  return (
    <section className="cure">
      <div className="cure-head">
        <span className="eyebrow">Cure this obligation</span>
        <span className="cure-deadline">
          cure closes at height <span className="tnum">{obligation.cureEndHeight}</span>
        </span>
      </div>

      <p className="cure-lede">
        This obligation was marked delinquent because no proof of payment arrived before its window
        closed — <strong>not</strong> because anyone determined that it went unpaid. If the payment
        was made, proving it now restores the obligation to Current and it is recorded as cured, not
        defaulted.
      </p>

      <form className="cure-form" onSubmit={submit}>
        <label className="cure-label" htmlFor="txhash">
          Ethereum transaction hash of the payment
        </label>
        <div className="search">
          <input
            id="txhash"
            value={txHash}
            onChange={(e) => setTxHash(e.target.value)}
            placeholder="0x…"
            spellCheck={false}
            autoComplete="off"
            aria-invalid={txHash.length > 0 && !valid}
          />
          <button type="submit" disabled={!valid || stage === 'fetching' || stage === 'submitting'}>
            {stage === 'fetching' ? 'Fetching proof' : stage === 'submitting' ? 'Submitting' : 'Cure'}
          </button>
        </div>

        {txHash.length > 0 && !valid ? (
          <p className="cure-note" role="alert">
            That is not a transaction hash — expected 32 bytes, like{' '}
            <span className="mono">0x</span> followed by 64 hex characters.
          </p>
        ) : null}
      </form>

      {message ? (
        <p className="cure-note" data-tone={stage === 'done' ? 'good' : 'bad'} role="status">
          {message}
        </p>
      ) : null}

      <p className="cure-note">
        Anyone may submit this — the contract admits a proof on the source height it binds to, never
        on who sent it. You do not need an account, and you do not need to be the borrower.
      </p>
    </section>
  );
}
