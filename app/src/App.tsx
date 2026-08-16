import { useEffect, useState } from 'react';
import { lens, useLens } from './lib/lens';
import Registry from './routes/Registry';
import Solvency from './routes/Solvency';
import Encumbrance from './routes/Encumbrance';
import Obligation from './routes/Obligation';
import Underwriter from './routes/Underwriter';

/** Hash routing: no dependency, and every view stays a shareable deep link. */
function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash.slice(1) || '/');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

/**
 * The liveness strip — invariant I7, made permanent furniture.
 *
 * Whether the attested head is advancing decides whether ANY obligation can be
 * penalised. That makes it a standing condition of the whole record rather than
 * a passing event, so it gets a fixed rail under the masthead instead of a
 * toast that can be dismissed and forgotten.
 *
 * It also carries the projection's own staleness. The Lens is a projection, so
 * "as of block N" is a real caveat, not decoration: every figure on screen is
 * exactly that stale. A console for a credit registry that renders numbers
 * without saying when they were true is inviting someone to lend against them.
 */
function LivenessStrip() {
  const res = useLens((s) => lens.health(s), []);

  const unreachable = res.state === 'error';

  return (
    <div className="liveness" data-degraded={unreachable ? 'true' : 'false'}>
      <div className="page row wrap" style={{ gap: 18, padding: 0 }}>
        <span className="liveness-item">
          <span className="liveness-label">Projection</span>
          <span className="liveness-value">
            {unreachable ? 'unreachable' : res.state === 'ok' ? `block ${res.data.asOfBlock}` : '—'}
          </span>
        </span>

        <span className="liveness-item">
          <span className="liveness-label">Obligations</span>
          <span className="liveness-value">
            {res.state === 'ok' ? res.data.obligations : '—'}
          </span>
        </span>

        <span className="liveness-item" data-caption="true" style={{ marginLeft: 'auto' }}>
          <span className="liveness-label">Clock</span>
          <span className="liveness-value" title="Deadlines are denominated in attested source-chain block height, never wall time.">
            attested source height
          </span>
        </span>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>(
    () => (localStorage.getItem('covenant.theme') as 'light' | 'dark' | null) ?? 'system',
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('covenant.theme');
    } else {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('covenant.theme', theme);
    }
  }, [theme]);

  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  return (
    <button
      className="btn"
      onClick={() => setTheme(next)}
      title={`Theme: ${theme}. Click for ${next}.`}
      aria-label={`Theme: ${theme}. Switch to ${next}.`}
    >
      {theme === 'system' ? '◑' : theme === 'light' ? '☀' : '☾'}
    </button>
  );
}

const NAV = [
  ['/', 'Registry'],
  ['/solvency', 'Solvency'],
  ['/encumbrance', 'Encumbrance'],
  ['/underwriter', 'Underwriters'],
] as const;

function View({ route }: { route: string }) {
  const obligation = route.match(/^\/obligation\/(\d+)$/);
  if (obligation?.[1]) return <Obligation id={obligation[1]} />;

  const underwriter = route.match(/^\/underwriter\/(0x[0-9a-fA-F]{40})$/);
  if (underwriter?.[1]) return <Underwriter address={underwriter[1]} />;

  switch (route) {
    case '/solvency':
      return <Solvency />;
    case '/encumbrance':
      return <Encumbrance />;
    case '/underwriter':
      return <Underwriter />;
    case '/':
      return <Registry />;
    default:
      return (
        <div className="page">
          <div className="state">
            <div className="state-title">No such view</div>
            <a href="#/">Back to the registry</a>
          </div>
        </div>
      );
  }
}

export default function App() {
  const route = useHashRoute();
  const active = route.startsWith('/obligation')
    ? '/'
    : route.startsWith('/underwriter')
      ? '/underwriter'
      : route;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="page masthead-inner">
          <a className="wordmark" href="#/">
            Covenant
            <span className="wordmark-sub">Register of Obligations</span>
          </a>
          <nav className="nav">
            {NAV.map(([href, label]) => (
              <a key={href} href={`#${href}`} aria-current={active === href ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <LivenessStrip />

      <main style={{ flex: 1 }}>
        <View route={route} />
      </main>

      <footer className="page">
        <div className="colophon">
          <p>
            <strong>Every status in this register was reached by evidence.</strong> A
            cryptographically verified ASC proof of an Ethereum event, or a comparison against the
            attested source-chain height. Nothing here was asserted by a reporter, voted on by a
            committee, or supplied by an oracle operator.
          </p>
          <p>
            Deadlines are denominated in <strong>attested block height</strong>, never wall time.
            The protocol's clock is the head of a foreign chain, which can stall; showing dates
            would imply a deadline the contracts do not enforce.
          </p>
          <p>
            Testnet, synthetic data. Identity is a commitment, but payment addresses and amounts are
            public by construction — do not put real borrower data in this registry.
          </p>
        </div>
      </footer>
    </div>
  );
}
