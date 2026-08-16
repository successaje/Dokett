import { useEffect, useState } from 'react';
import { lens, useLens } from './lib/lens';
import { Pill } from './components/primitives';
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
 * Indexer freshness.
 *
 * The Lens is a projection, so "as of block N" is a real caveat rather than
 * decoration — every figure on screen is that stale. A console for a credit
 * registry that renders numbers without saying when they were true is inviting
 * someone to lend against them.
 */
function IndexStatus() {
  const res = useLens((s) => lens.health(s), []);

  if (res.state === 'error')
    return (
      <Pill tone="bad" dot>
        Lens unreachable
      </Pill>
    );
  if (res.state !== 'ok')
    return (
      <Pill tone="neutral" dot>
        connecting…
      </Pill>
    );

  return (
    <span title={`Projection current to Creditcoin block ${res.data.asOfBlock}`}>
      <Pill tone="good" dot>
        block {res.data.asOfBlock}
      </Pill>
    </span>
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
      style={{ padding: '5px 10px', fontSize: 12 }}
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
        <div className="card">
          <div className="msg">
            No such view. <a href="#/">Back to the registry</a>.
          </div>
        </div>
      );
  }
}

export default function App() {
  const route = useHashRoute();
  const active = route.startsWith('/obligation') ? '/' : route.startsWith('/underwriter') ? '/underwriter' : route;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="wrap masthead-inner">
          <a className="brand" href="#/">
            Covenant <small>CONSOLE</small>
          </a>
          <nav className="nav">
            {NAV.map(([href, label]) => (
              <a key={href} href={`#${href}`} aria-current={active === href ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <div className="row" style={{ gap: 8 }}>
            <IndexStatus />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="wrap" style={{ padding: '24px', flex: 1 }}>
        <View route={route} />
      </main>

      <footer className="wrap foot">
        <div style={{ maxWidth: 720 }}>
          Every status in this console was reached through a cryptographically verified ASC proof or a
          comparison against the attested source-chain height. Nothing here was asserted by a reporter,
          voted on by a committee, or supplied by an oracle operator.
          <br />
          <br />
          Testnet, synthetic data. Identity is a commitment, but payment addresses and amounts are public
          by construction — do not put real borrower data in this registry.
        </div>
      </footer>
    </div>
  );
}
