import type { ReactNode } from 'react';
import type { Status } from '../lib/types';
import { STATUS_MEANING, STATUS_TONE, truncate, type Tone } from '../lib/format';

export function Card({
  title,
  actions,
  note,
  children,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          <h2 className="card-title">{title}</h2>
          {actions}
        </header>
      )}
      {children}
      {note && <div className="card-note">{note}</div>}
    </section>
  );
}

export function Pill({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`pill pill-${tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  );
}

export function StatusPill({ status }: { status: Status }) {
  return (
    <span title={STATUS_MEANING[status]}>
      <Pill tone={STATUS_TONE[status]} dot>
        {status}
      </Pill>
    </span>
  );
}

/** Monospace address with copy-on-click. Full value stays in `title`. */
export function Addr({ value, lead, tail }: { value: string; lead?: number; tail?: number }) {
  if (!value || /^0x0+$/.test(value)) return <span style={{ color: 'var(--text-faint)' }}>—</span>;
  return (
    <button
      className="mono"
      title={`${value}\n(click to copy)`}
      onClick={() => void navigator.clipboard?.writeText(value)}
      style={{ background: 'none', border: 0, padding: 0, color: 'inherit' }}
    >
      {truncate(value, lead, tail)}
    </button>
  );
}

export function Metric({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
}) {
  const color =
    tone && tone !== 'neutral' ? { color: `var(--${tone === 'done' ? 'done' : tone})` } : undefined;
  return (
    <div className="metric">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={color}>
        {value}
      </div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="card-body stack" style={{ gap: 10 }} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ width: `${100 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="msg">{children}</div>;
}

export function ErrorMsg({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  return (
    <div className="msg msg-error">
      <div>{children}</div>
      {onRetry && (
        <button className="btn" style={{ marginTop: 12 }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Meter({ value, max, tone }: { value: number; max: number; tone?: Tone }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.max(0, (value / max) * 100));
  const cls = tone === 'good' || tone === 'warn' || tone === 'bad' ? tone : '';
  return (
    <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className={`meter-fill ${cls}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
