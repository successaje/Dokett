import { useEffect, useLayoutEffect, useState } from 'react';
import { lens, useLens } from './lib/lens';
import { height } from './lib/format';
import { Mark } from './components/primitives';
import Landing from './routes/Landing';
import Registry from './routes/Registry';
import Solvency from './routes/Solvency';
import Encumbrance from './routes/Encumbrance';
import Obligation from './routes/Obligation';
import Underwriter from './routes/Underwriter';
import Profile from './routes/Profile';
import Developers from './routes/Developers';
import RegisterObligation from './routes/RegisterObligation';
import Doc from './routes/Doc';
import { PostsIndex, PostDetail } from './routes/Posts';
import Onboarding from './components/Onboarding';
import SessionMenu from './components/SessionMenu';

/**
 * Hash routing: no dependency, and every view stays a shareable deep link.
 *
 * Resets scroll on every navigation. Without this, navigating to a new view
 * while scrolled down leaves the next page scrolled down too — and because the
 * masthead is sticky, that can land the new page's own title behind it.
 */
/** Strips any `?query` before it reaches route matching — a route is a path. */
function hashPath(): string {
  const raw = window.location.hash.slice(1) || '/';
  const q = raw.indexOf('?');
  return q === -1 ? raw : raw.slice(0, q);
}

function useHashRoute(): string {
  const [hash, setHash] = useState(hashPath);
  useEffect(() => {
    const onChange = () => {
      setHash(hashPath());
      window.scrollTo(0, 0);
    };
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
            {unreachable ? 'unreachable' : res.state === 'ok' ? `block ${height(res.data.asOfBlock)}` : '—'}
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
    () => (localStorage.getItem('dokett.theme') as 'light' | 'dark' | null) ?? 'system',
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem('dokett.theme');
    } else {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('dokett.theme', theme);
    }
  }, [theme]);

  const next = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system';
  return (
    <button
      className="icon-btn"
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
 * Developers and Posts are real destinations that were previously
 * unreachable from inside the app, so they're added rather than swapped in
 * over the first cluster.
 *
 * "About" was dropped from this list, not from the app — the wordmark still
 * links to "/" from every page, exactly as it did before this nav existed.
 * Losing it as an explicit label was the cheapest width to reclaim toward
 * fitting the whole header on one line.
 */
const NAV_RECORD = [
  ['/registry', 'Registry'],
  ['/solvency', 'Solvency'],
  ['/encumbrance', 'Encumbrance'],
  ['/underwriter', 'Underwriters'],
  ['/register', 'Register'],
] as const;

const NAV_MORE = [
  ['/developers', 'Developers'],
  ['/posts', 'Posts'],
] as const;

function View({ route }: { route: string }) {
  const obligation = route.match(/^\/obligation\/(\d+)$/);
  if (obligation?.[1]) return <Obligation id={obligation[1]} />;

  const underwriter = route.match(/^\/underwriter\/(0x[0-9a-fA-F]{40})$/);
  if (underwriter?.[1]) return <Underwriter address={underwriter[1]} />;

  // 40 hex chars for a payment address, 64 for an obligor commitment.
  const profile = route.match(/^\/profile\/(0x[0-9a-fA-F]{40}|0x[0-9a-fA-F]{64})$/);
  if (profile?.[1]) return <Profile subject={profile[1]} />;

  const post = route.match(/^\/posts\/([a-z0-9-]+)$/);
  if (post?.[1]) return <PostDetail slug={post[1]} />;

  const doc = route.match(/^\/developers\/([a-z0-9-]+)$/);
  if (doc?.[1]) return <Doc slug={doc[1]} />;

  switch (route) {
    case '/solvency':
      return <Solvency />;
    case '/encumbrance':
      return <Encumbrance />;
    case '/underwriter':
      return <Underwriter />;
    case '/registry':
      return <Registry />;
    case '/register':
      return <RegisterObligation />;
    case '/developers':
      return <Developers />;
    case '/posts':
      return <PostsIndex />;
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

/*
 * --header-h drives .lp-cover's height (see theme.css) so the landing hero
 * fills exactly the screen and stops there. It used to be a hardcoded pixel
 * value, once per breakpoint — and broke twice from that: once when the
 * subtitle was dropped and the mobile header shrank without the constant
 * following, and again when nav links were added and the mobile header grew.
 * Both times "the problem" section quietly became partly visible on load,
 * which is the one thing this variable exists to prevent, and neither
 * would have been caught without measuring the live page rather than
 * trusting the number.
 *
 * Measuring it instead of hardcoding it removes the whole bug class: this
 * observes whatever .masthead actually renders, on either page, and stays
 * correct no matter how its content changes in the future.
 */
function useHeaderHeightVar(route: string) {
  // Layout effect, not a plain effect: this must land before the browser
  // paints, or the hero briefly renders at its un-measured fallback height
  // and then visibly snaps to the correct one a frame later.
  useLayoutEffect(() => {
    const header = document.querySelector('.masthead');
    if (!header) return;

    const set = () => {
      const h = header.getBoundingClientRect().height;
      if (h > 0) document.documentElement.style.setProperty('--header-h', `${h}px`);
    };

    set();
    const ro = new ResizeObserver(set);
    ro.observe(header);
    return () => ro.disconnect();
    // Re-attach on every route change: switching between the Landing header
    // and the Console header replaces the DOM node entirely, and an observer
    // bound to the old (now-detached) node would silently stop updating.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);
}

export default function App() {
  const route = useHashRoute();
  useHeaderHeightVar(route);

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
          {/*
            Same .masthead-top/.nav structure as the Console header — one
            mechanism for both, not two parallel ones. (A previous version
            kept a separate always-single-row variant for this page; it and
            the Console header's --header-h drifted out of sync within one
            edit, which is exactly the failure mode sharing one mechanism is
            meant to prevent.)

            The subtitle is dropped, but for a different reason than the
            structure: it's redundant here specifically. The hero copy one
            paragraph down already spells out "a cross-chain registry" in
            full sentences — the tiny header label only earns its place once
            someone is deep in the Console with no restating copy nearby,
            which is exactly where it still appears.
          */}
          <div className="page masthead-inner">
            <div className="masthead-top">
              <a className="wordmark" href="#/">
                <Mark />
                Dokett
              </a>
              <div className="masthead-actions">
                <ThemeToggle />
              </div>
            </div>
            <nav className="nav">
              <a href="#/registry">Enter the register</a>
              <a href="#/solvency">Solvency</a>
              <a href="#/encumbrance">Encumbrance</a>
            </nav>
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
      : route.startsWith('/developers')
        ? '/developers'
        : route;

  return (
    <div className="shell">
      <header className="masthead">
        <div className="page masthead-inner">
          <div className="masthead-top">
            <a className="wordmark" href="#/">
              <Mark />
              Dokett
              <span className="wordmark-sub">Register of Obligations</span>
            </a>
            <div className="masthead-actions">
              <SessionMenu />
              <ThemeToggle />
            </div>
          </div>
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
