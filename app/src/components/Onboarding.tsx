import { useEffect, useState } from 'react';

/**
 * First-run orientation for the Console.
 *
 * The registry views assume you already know what an obligation is, why a claim
 * can be unbonded, and why every deadline is a block height rather than a date.
 * Someone landing cold — a judge, an investor, a lender evaluating this — has
 * none of that, and a table of hex addresses will not teach them.
 *
 * Deliberately NOT a modal. A dialog that blocks the record until dismissed
 * makes the reader's first interaction "get this out of the way", and anything
 * learned that way is not retained. This sits inline above the view, is
 * dismissible, and stays dismissed.
 *
 * The three points are the three things that most reliably confuse a first
 * reader, in the order they will hit them.
 */

const KEY = 'dokett.onboarded.v1';

const POINTS: [string, string][] = [
  [
    'Every status was reached by evidence',
    'Nothing here was reported, voted on, or supplied by an oracle operator. A status moves only when an ASC proof of a real Ethereum event is verified on-chain, or when a deadline measured in attested block height passes.',
  ],
  [
    'Anyone may register a claim against anyone',
    'That is deliberate — a registry that gatekeeps registration is a private database. It also means claims can be fictional, so a registrar posts a bond, and unbonded claims are shown separately and never summed into a total.',
  ],
  [
    'Deadlines are block heights, not dates',
    'The protocol’s clock is the attested head of Ethereum, which can stall. Showing wall-clock dates would imply a deadline the contracts do not actually enforce.',
  ],
];

export default function Onboarding() {
  const [dismissed, setDismissed] = useState(true);

  // Read after mount so a stale server render can never flash the panel at
  // someone who dismissed it long ago.
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(KEY) === '1');
    } catch {
      // Private mode or blocked storage: show it. Repeating orientation is a far
      // smaller cost than a first-time reader getting none.
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* nothing to do — it will simply appear again next visit */
    }
  };

  return (
    <aside className="onboard" aria-label="How to read this register">
      <div className="onboard-head">
        <span className="eyebrow">Reading this register</span>
        <button className="onboard-close" onClick={close} aria-label="Dismiss orientation">
          Dismiss
        </button>
      </div>

      <div className="onboard-points">
        {POINTS.map(([title, body], i) => (
          <div className="onboard-point" key={title}>
            <div className="rail-idx">{String(i + 1).padStart(2, '0')}</div>
            <div className="onboard-point-title">{title}</div>
            <p className="onboard-point-body">{body}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}
