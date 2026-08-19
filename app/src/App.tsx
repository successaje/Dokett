import { useEffect, useState } from 'react';
import { lens, useLens } from './lib/lens';
import { Mark } from './components/primitives';
import Landing from './routes/Landing';
import Registry from './routes/Registry';
import Solvency from './routes/Solvency';
import Encumbrance from './routes/Encumbrance';
import Obligation from './routes/Obligation';
import Underwriter from './routes/Underwriter';
import Profile from './routes/Profile';
import Developers from './routes/Developers';
import Posts from './routes/Posts';
import Onboarding from './components/Onboarding';
import { useSession } from './lib/auth';

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

/**
 * Sign-in control.
 *
 * Renders nothing when Privy is unconfigured, so a clone of this repo shows a
 * complete public register rather than a broken auth affordance. Signing in
 * never gates a read and never gates a cure — it only lets someone find the
 * obligations that concern them.
 */
function SessionControl() {
  const s = useSession();
  if (!s.configured || !s.ready) return null;

  return s.signedIn ? (
    <button className="btn" onClick={s.signOut} title={s.label ?? undefined}>
      {s.label ? `${s.label} · sign out` : 'Sign out'}
    </button>
  ) : (
    <button className="btn" onClick={s.signIn} title="Find the obligations that concern you. Not required to read the register or to cure.">
      Sign in
    </button>
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

/*
 * Two clusters, not one flat list. The record itself — Registry / Solvency /
 * Encumbrance / Underwriters — is precise bureau vocabulary and stays put.
 * Developers, Posts, and About are real destinations that were previously
 * unreachable from inside the app (About existed only as a wordmark click),
 * so they're added rather than swapped in over the first cluster.
 */
const NAV_RECORD = [
  ['/registry', 'Registry'],
  ['/solvency', 'Solvency'],
  ['/encumbrance', 'Encumbrance'],
  ['/underwriter', 'Underwriters'],
] as const;

const NAV_MORE = [
  ['/developers', 'Developers'],
  ['/posts', 'Posts'],
  ['/', 'About'],
] as const;

function View({ route }: { route: string }) {
  const obligation = route.match(/^\/obligation\/(\d+)$/);
  if (obligation?.[1]) return <Obligation id={obligation[1]} />;

  const underwriter = route.match(/^\/underwriter\/(0x[0-9a-fA-F]{40})$/);
  if (underwriter?.[1]) return <Underwriter address={underwriter[1]} />;

  // 40 hex chars for a payment address, 64 for an obligor commitment.
  const profile = route.match(/^\/profile\/(0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64})$/);
  if (profile?.[1]) return <Profile subject={profile[1]} />;

  switch (route) {
    case '/solvency':
      return <Solvency />;
    case '/encumbrance':
      return <Encumbrance />;
    case '/underwriter':
      return <Underwriter />;
    case '/registry':
      return <Registry />;
    case '/developers':
      return <Developers />;
    case '/posts':
      return <Posts />;
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

  /*
   * The title page runs without the console's chrome. Its job is to explain what
   * this is to someone who does not know yet, and a nav bar of registry views —
   * plus a liveness strip reporting an indexer they have no reason to care about
   * — would answer a question they have not asked.
   */
  if (route === '/') {
    return (
      <div className="shell">
        <header className="masthead">
          <div className="page masthead-inner">
            <a className="wordmark" href="#/">
              <Mark />
              Covenant
              <span className="wordmark-sub">Register of Obligations</span>
            </a>
            <nav className="nav">
              <a href="#/registry">Enter the register</a>
            </nav>
            <ThemeToggle />
          </div>
        </header>
        <main style={{ flex: 1 }}>
          <Landing />
        </main>
      </div>
    );
  }

  const active = route.startsWith('/obligation')
    ? '/registry'
    : route.startsWith('/underwriter')
      ? '/underwriter'
      : route;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="page masthead-inner">
          <a className="wordmark" href="#/">
            <Mark />
            Covenant
            <span className="wordmark-sub">Register of Obligations</span>
          </a>
          <nav className="nav">
            {NAV_RECORD.map(([href, label]) => (
              <a key={href} href={`#${href}`} aria-current={active === href ? 'page' : undefined}>
                {label}
              </a>
            ))}
            <span className="nav-divider" aria-hidden="true" />
            {NAV_MORE.map(([href, label]) => (
              <a key={href} href={`#${href}`} aria-current={active === href ? 'page' : undefined}>
                {label}
              </a>
            ))}
          </nav>
          <SessionControl />
          <ThemeToggle />
        </div>
      </header>

      <LivenessStrip />

      <main style={{ flex: 1 }}>
        <div className="page">
          <Onboarding />
        </div>
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
