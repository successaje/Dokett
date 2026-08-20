import type { ReactNode } from 'react';
import type { Status } from '../lib/types';
import { STATUS_MEANING, height, truncate } from '../lib/format';

/* ──────────────────────────────── mark ──────────────────────────────── */

/**
 * The Covenant mark: an open C held by a vertical rule.
 *
 * The promise stays open; the rule is what holds it — which is the protocol.
 * An obligation is not made binding by a seal, it is held by the record.
 *
 * Inlined rather than an <img> so it inherits `currentColor` and flips with the
 * theme for free, and so it costs no request. Geometry is optically centred, not
 * centred on the viewBox: the C carries more mass than the rule.
 */
export function Mark({ size = 26, strokeWidth = 2.4 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M21.8 9.8a9.2 9.2 0 1 0 0 12.4" />
      <path d="M26.2 4.8v22.4" />
    </svg>
  );
}

/* ─────────────────────────────── status ─────────────────────────────── */

/**
 * Protocol state, and the only place colour is permitted in this app.
 *
 * `data-s` drives the palette from CSS rather than a lookup here, so an
 * unrecognised status still renders in the neutral tone instead of falling
 * through to an unstyled label. A registry that silently drops a status it does
 * not recognise is worse than one that shows it plainly.
 */
export function StatusPill({ status }: { status: Status }) {
  return (
    <span className="status" data-s={status} title={STATUS_MEANING[status]}>
      {status}
    </span>
  );
}

/** Marks a claim whose registrar posted no bond. Never shown inside a total. */
export function UnbondedFlag() {
  return (
    <span
      className="flag-unbonded"
      title="Registrar posted no bond. Carries no weight in the Lens and is never summed with bonded claims."
    >
      unbonded
    </span>
  );
}

/* ──────────────────────────── identifiers ───────────────────────────── */

/** Monospace identifier, truncated for the eye. Full value stays in `title`. */
export function Addr({ value, lead, tail }: { value: string; lead?: number; tail?: number }) {
  return (
    <span className="mono" title={value}>
      {truncate(value, lead, tail)}
    </span>
  );
}

/* ────────────────────────────── figures ─────────────────────────────── */

export function Figures({ children }: { children: ReactNode }) {
  return <div className="figures">{children}</div>;
}

export function Figure({
  label,
  value,
  sub,
  title,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  title?: string;
}) {
  // A literal zero is real evidence here (no bond posted, no coverage), not a
  // loading state — but full weight makes it read as "broken" rather than
  // "true". Dimming it keeps the number legible while a reader's eye lands on
  // the figures that actually vary first.
  const isZero = value === 0 || value === '0';

  return (
    <div className="figure" title={title}>
      <div className="figure-label">{label}</div>
      <div className="figure-value" data-zero={isZero ? 'true' : undefined}>
        {value}
      </div>
      {sub ? <div className="figure-sub">{sub}</div> : null}
    </div>
  );
}

/* ────────────────────────────── sections ────────────────────────────── */

export function Section({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {aside ? <div className="note">{aside}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function DL({ children }: { children: ReactNode }) {
  return <dl className="dl">{children}</dl>;
}

export function Row({ k, v, title }: { k: string; v: ReactNode; title?: string }) {
  return (
    <>
      <dt title={title}>{k}</dt>
      <dd>{v}</dd>
    </>
  );
}

/* ──────────────────────────── lifecycle rail ────────────────────────── */

const LIFECYCLE: { name: Status; note: string }[] = [
  { name: 'Active', note: 'registered' },
  { name: 'Current', note: 'payment proven' },
  { name: 'Delinquent', note: 'window closed unproven' },
  { name: 'Default', note: 'cure expired' },
];

const TERMINAL: Partial<Record<Status, string>> = {
  Settled: 'schedule satisfied',
  ChargedOff: 'written off',
};

/**
 * The status machine, drawn.
 *
 * Shows the whole path rather than only the current badge, because the useful
 * question about an obligation is never "what is it now" alone — it is "what
 * happens next, and what would move it there". Terminal states replace the rail
 * entirely: a settled obligation has no next step, and drawing one would imply
 * a liveness it does not have.
 */
export function LifecycleRail({ status }: { status: Status }) {
  const terminal = TERMINAL[status];
  if (terminal) {
    return (
      <div className="rail">
        <div className="rail-step" data-state="here">
          <div className="rail-idx">terminal</div>
          <div className="rail-name">{status}</div>
          <div className="rail-note">{terminal}</div>
        </div>
      </div>
    );
  }

  const at = LIFECYCLE.findIndex((s) => s.name === status);

  return (
    <div className="rail">
      {LIFECYCLE.map((step, i) => (
        <div
          key={step.name}
          className="rail-step"
          data-state={at < 0 ? 'future' : i < at ? 'past' : i === at ? 'here' : 'future'}
        >
          <div className="rail-idx">{String(i + 1).padStart(2, '0')}</div>
          <div className="rail-name">{step.name}</div>
          <div className="rail-note">{step.note}</div>
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── height ruler ─────────────────────────── */

export interface RulerProps {
  windowEnd: bigint;
  cureEnd: bigint;
  /**
   * Attested source-chain head, if it is actually known.
   *
   * Undefined is a legitimate and common answer: the Lens projects Creditcoin
   * events and does not observe the source chain, so for a healthy obligation
   * there is genuinely no head to report. Drawing a marker anyway would be
   * inventing the one number this whole screen exists to be precise about.
   */
  head?: bigint;
  /** True when `head` is only a lower bound implied by the status, not an observation. */
  headIsLowerBound?: boolean;
}

/**
 * The obligation's deadlines as a physical scale in source-chain block height.
 *
 * The only chart in this console, and it earns its place because height is the
 * one quantity a reader must reason about spatially: how much room is left
 * before a default becomes final.
 *
 * Dates would be a lie. The protocol's clock is the attested head of a foreign
 * chain, which can stall, and rendering wall time would imply a deadline the
 * contracts do not enforce.
 *
 * The head can legitimately sit past the right edge — an obligation left
 * unfinalised long after its cure expired — so the domain is padded rather than
 * clamped to the deadlines. Clamping would hide precisely the overrun a reader
 * needs to see.
 */
export function HeightRuler({ windowEnd, cureEnd, head, headIsLowerBound }: RulerProps) {
  const cureSpan = cureEnd > windowEnd ? cureEnd - windowEnd : 1n;

  // Frame the region that matters — the cure band — rather than the whole
  // schedule. A long lead-in before the window adds no information: the reader's
  // question is how much room is left, not how far they have come.
  const domainLo = windowEnd - cureSpan;
  const rightmost = head && head > cureEnd ? head : cureEnd;
  const domainHi = rightmost + cureSpan / 4n;
  const domain = domainHi - domainLo || 1n;

  const pct = (h: bigint) => {
    const clamped = h < domainLo ? domainLo : h > domainHi ? domainHi : h;
    return Number(((clamped - domainLo) * 10000n) / domain) / 100;
  };

  const wEnd = pct(windowEnd);
  const cEnd = pct(cureEnd);
  const hd = head === undefined ? null : pct(head);

  const label =
    `Window closes at height ${height(windowEnd)}, cure expires at ${height(cureEnd)}. ` +
    (head === undefined
      ? 'The attested source-chain head is not reported by this projection.'
      : `${headIsLowerBound ? 'The head is at least' : 'The attested head is'} ${height(head)}.`);

  return (
    <div>
      <div className="ruler" role="img" aria-label={label}>
        {hd !== null && <div className="ruler-fill" style={{ width: `${hd}%` }} />}

        {/* the cure band: the only stretch in which a late proof still saves it */}
        <div
          className="ruler-band"
          style={{ left: `${wEnd}%`, width: `${Math.max(cEnd - wEnd, 0)}%` }}
        />

        <div className="ruler-mark" data-kind="window" data-label="window" style={{ left: `${wEnd}%` }} />
        <div
          className="ruler-mark"
          data-kind="cure"
          data-label="cure"
          data-flip={cEnd > 82 ? 'true' : 'false'}
          style={{ left: `${cEnd}%` }}
        />
        {hd !== null && (
          <div
            className="ruler-mark"
            data-kind="head"
            data-label={`${headIsLowerBound ? 'head ≥' : 'head'} ${height(head!)}`}
            data-flip={hd > 58 ? 'true' : 'false'}
            style={{ left: `${hd}%` }}
          />
        )}
      </div>

      <div className="ruler-legend">
        <span className="ruler-key">
          <i style={{ background: 'var(--st-delinquent)' }} /> window closes{' '}
          <span className="tnum">{height(windowEnd)}</span>
        </span>
        <span className="ruler-key">
          <i style={{ background: 'var(--st-default)' }} /> cure expires{' '}
          <span className="tnum">{height(cureEnd)}</span>
        </span>
        {head === undefined ? (
          <span className="ruler-key" style={{ color: 'var(--ink-4)' }}>
            attested head not reported by this projection
          </span>
        ) : (
          <span className="ruler-key">
            <i style={{ background: 'var(--ink)' }} />{' '}
            {headIsLowerBound ? 'head at least' : 'attested head'}{' '}
            <span className="tnum">{height(head)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────── docket ────────────────────────────── */

export interface DocketEntry {
  title: string;
  height?: string;
  body?: ReactNode;
  emphasis?: boolean;
}

/**
 * The obligation's history as a chronological record.
 *
 * Each entry names the evidence that caused the transition, because in this
 * protocol nothing moves without one. It reads as a docket rather than an
 * activity feed on purpose: the reader's question is "what is this claim, and
 * what backs each step of it" — a question about a document.
 */
export function Docket({ entries }: { entries: DocketEntry[] }) {
  if (!entries.length) return <div className="note">No recorded transitions.</div>;

  return (
    <div className="docket">
      {entries.map((e, i) => (
        <div className="docket-entry" key={i} data-emphasis={e.emphasis ? 'true' : 'false'}>
          <div className="docket-head">
            <span className="docket-title">{e.title}</span>
            {e.height ? <span className="docket-height">height {height(e.height)}</span> : null}
          </div>
          {e.body ? <div className="docket-body">{e.body}</div> : null}
        </div>
      ))}
    </div>
  );
}

/* ───────────────────────────── states ───────────────────────────────── */

export function Loading({ rows = 5 }: { rows?: number }) {
  return (
    <div className="stack" style={{ gap: 12, padding: '14px 0' }} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 7}%` }} />
      ))}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-title">{title}</div>
      {children}
    </div>
  );
}

/**
 * An error state that names which layer failed.
 *
 * "Something went wrong" is useless here. A reader needs to know whether the
 * record is absent or merely unreachable, because those have opposite meanings
 * for a lending decision.
 */
export function Failed({
  what,
  detail,
  onRetry,
}: {
  what: string;
  detail?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state">
      <div className="state-title">Could not read {what}</div>
      <p style={{ margin: '4px 0 0', maxWidth: '62ch' }}>
        The Lens is a projection over chain events, so this is a reporting failure rather than a
        statement about the record. Nothing here should be read as “no obligations exist”.
      </p>
      {detail ? (
        <p className="mono" style={{ marginTop: 8, fontSize: 11.5, color: 'var(--ink-4)' }}>
          {detail}
        </p>
      ) : null}
      {onRetry ? (
        <button className="btn" style={{ marginTop: 12 }} onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
