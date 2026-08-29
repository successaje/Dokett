import type { ReactNode } from 'react';
import { useReveal } from '../lib/motion';
import { Mark } from '../components/primitives';

/**
 * The title page.
 *
 * ─── WHAT CHANGED, AND WHY ─────────────────────────────────────────────────
 *
 * This page used to carry the entire argument: every failed predecessor, the
 * three conditions that made the protocol buildable, a live specimen of the
 * height ruler, the full limitations list. All of it accurate, and all of it
 * wrong for a front door — a visitor could read for ten minutes and understand
 * the architecture without ever touching the product.
 *
 * A registry should be experienced, not read. So the page now does three things
 * and stops: state the gap, show the shape of the answer, and route people to
 * the thing that answers it. The removed material was not deleted — it lives
 * where someone who wants it will look: prior attempts and the cost curve in
 * Posts, mechanics in Developers, the full threat model in the docs.
 *
 * Not a crypto hero. No gradient, no 3D render, no "the future of" — those sell
 * a product, and Dokett is a record.
 */

/** Reveals its children once, on first scroll into view. Inert without motion. */
function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="reveal"
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

const AUDIENCES: [string, string, string, string, string][] = [
  [
    'Lenders',
    'Know what a counterparty already owes',
    'Query cross-chain obligations before extending credit.',
    '#/solvency',
    'Run a solvency check',
  ],
  [
    'RWA platforms',
    'Know whether collateral is already encumbered',
    'Check existing claims before accepting an asset.',
    '#/encumbrance',
    'Check an asset',
  ],
  [
    'Underwriters',
    'Price risk against named obligations',
    'Stake first-loss capital, earn the spread when obligations perform.',
    '#/underwriter',
    'See the book',
  ],
  [
    'Developers',
    'Build on the obligation layer',
    'Query obligations, solvency and encumbrance through a free public API.',
    '#/developers',
    'Read the API',
  ],
];

const SHIPPED: string[] = [
  'Real Ethereum mainnet evidence',
  'Attestcoin integration, source-verified contracts',
  'Autonomous obligation lifecycle',
  'Permissionless payment proofs',
  'Automatic default detection',
  'First-loss slashing',
  'Free public read API',
  'Testnet, synthetic data only',
];

const REPO = 'https://github.com/successaje/covenant';

export default function Landing() {
  return (
    <div className="landing">
      {/* ── cover ─────────────────────────────────────────────────────── */}
      <section className="page lp-cover">
        <div className="eyebrow rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          Dokett · a register of obligations
        </div>

        <h1 className="lp-title rise" style={{ '--d': '70ms' } as React.CSSProperties}>
          Crypto has a credit market
          <br />
          and no credit bureau.
        </h1>

        <p className="lp-lede rise" style={{ '--d': '150ms' } as React.CSSProperties}>
          Dokett is the obligation layer for the open economy — a cross-chain registry where
          promises to pay become first-class on-chain objects, and their state changes only when
          backed by cryptographically verified evidence.
        </p>

        <p className="lp-lede lp-lede-tight rise" style={{ '--d': '200ms' } as React.CSSProperties}>
          No reporter. No committee. No oracle deciding what happened.
        </p>

        <div className="lp-cta rise" style={{ '--d': '260ms' } as React.CSSProperties}>
          <a className="lp-btn lp-btn-primary" href="#/registry">
            Enter the register
          </a>
          <a className="lp-btn" href={REPO} target="_blank" rel="noreferrer">
            Read the source
          </a>
        </div>
      </section>

      {/* ── the problem ───────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">The problem</div>
          <h2 className="lp-h2">A lender is about to extend $1M.</h2>
          <p className="lp-quiet">What do you already owe?</p>
          <p className="lp-body">
            In traditional finance there are bureaus, lien registries and courts to answer that.
            On-chain, a borrower can hold debt across several chains and protocols, each system
            seeing only its own slice.
          </p>
          <p className="lp-body">
            <strong>Issuing assets on-chain is being solved. Knowing what is owed against them is
            not.</strong>
          </p>
        </Reveal>
      </section>

      {/* ── the solution ──────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">The solution</div>
          <h2 className="lp-h2">A shared, verifiable record of obligations.</h2>

          <div className="lp-flow" aria-label="Register, prove, degrade, settle">
            {['Register', 'Prove', 'Degrade', 'Settle'].map((s, i, a) => (
              <span key={s} className="lp-flow-step">
                {s}
                {i < a.length - 1 && <span className="lp-flow-arrow" aria-hidden="true">→</span>}
              </span>
            ))}
          </div>

          <p className="lp-body">
            A repayment on Ethereum is cryptographically verified through Attestcoin, and the
            corresponding Creditcoin obligation advances. If the expected evidence never arrives,
            the obligation becomes delinquent on its own, and eventually defaults.
          </p>
          <p className="lp-body">
            <strong>The protocol determines the state. Not a reporter.</strong>
          </p>
        </Reveal>
      </section>

      {/* ── built for ─────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">Built for</div>
        </Reveal>

        <div className="lp-paths">
          {AUDIENCES.map(([role, title, body, href, cta], i) => (
            <Reveal key={role} delay={i * 70}>
              <a className="lp-path" href={href}>
                <div className="lp-path-role">{role}</div>
                <h3 className="lp-path-title">{title}</h3>
                <p className="lp-path-body">{body}</p>
                <span className="lp-path-cta">{cta} →</span>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── why here ──────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">Why Creditcoin + Attestcoin</div>
          <h2 className="lp-h2">
            Creditcoin provides the record.
            <br />
            Attestcoin provides the evidence.
          </h2>
          <p className="lp-body">
            Dokett uses Attestcoin Smart Contracts to verify real Ethereum events inside a
            Creditcoin contract — no bridge, no messaging layer, no oracle operator.
          </p>
          <p className="lp-measure mono">375,746 gas · 0.000187873 CTC · a real mainnet transaction</p>
          <p className="lp-body">
            <a href="#/posts/attestcoin-cost-model">Read the verification experiment →</a>
          </p>
        </Reveal>
      </section>

      {/* ── the important part ────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <div className="lp-pull">
            <p className="lp-pull-b">The protocol has no “Default” button.</p>
          </div>
          <p className="lp-body">
            A keeper can trigger evaluation. It cannot decide the outcome. When the attested
            source-chain height passes a payment deadline with no admissible evidence, the
            obligation transitions according to protocol rules.
          </p>
          <p className="lp-body">
            <strong>The keeper triggers. The evidence decides.</strong>
          </p>
        </Reveal>
      </section>

      {/* ── infrastructure ────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">This is infrastructure, not another lending app.</h2>
          <p className="lp-body">
            Dokett is not trying to become another lending venue. It is the shared obligation
            record underneath them — and every answer comes from verifiable on-chain evidence.
          </p>

          <div className="lp-asks">
            <div className="lp-ask">
              <span className="lp-ask-who">A lending protocol asks</span>
              <span className="lp-ask-q">What does this borrower already owe?</span>
            </div>
            <div className="lp-ask">
              <span className="lp-ask-who">An RWA platform asks</span>
              <span className="lp-ask-q">Is this asset already encumbered?</span>
            </div>
            <div className="lp-ask">
              <span className="lp-ask-who">A repayment asks</span>
              <span className="lp-ask-q">Has this obligation been paid?</span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ── shipped ───────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">Built and verifiable today · CC3 testnet</div>
          <ul className="lp-checks">
            {SHIPPED.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="lp-body lp-caveat">
            The attestor set is permissioned today and privacy is version one — payment addresses
            and amounts are public by construction.{' '}
            <a href="#/developers/threat-model">Full limitations →</a>
          </p>
        </Reveal>
      </section>

      {/* ── close ─────────────────────────────────────────────────────── */}
      <section className="page lp-close">
        <Reveal>
          <h2 className="lp-h2">Ask before you lend.</h2>
          <p className="lp-body">
            What does this counterparty already owe? Is this collateral already pledged? Can the
            repayment be proven?
          </p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-primary" href="#/solvency">
              Run a solvency check
            </a>
            <a className="lp-btn" href="#/encumbrance">
              Check an asset
            </a>
            <a className="lp-btn" href="#/developers">
              Read the API
            </a>
          </div>
        </Reveal>
      </section>

      {/* ── footer ────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="page">
          <div className="lp-cols">
            <div className="lp-col lp-col-about">
              <h4>
                <Mark size={16} strokeWidth={3} />
              </h4>
              <p>
                A register of obligations, built on Attestcoin Smart Contracts. Every status here
                was reached by evidence — never by a reporter, a committee, or an oracle operator.
              </p>
            </div>

            <div className="lp-col">
              <h4>Console</h4>
              <a href="#/registry">Registry</a>
              <a href="#/solvency">Solvency</a>
              <a href="#/encumbrance">Encumbrance</a>
              <a href="#/underwriter">Underwriters</a>
            </div>

            <div className="lp-col">
              <h4>Protocol</h4>
              <a href="#/developers">Developers</a>
              <a href="#/posts">Posts</a>
              <a href="#/developers/architecture">Architecture</a>
              <a href="#/developers/threat-model">Threat model</a>
              <a href="#/developers/asc-integration">ASC integration</a>
            </div>

            <div className="lp-col">
              <h4>Source</h4>
              <a href={REPO} target="_blank" rel="noreferrer">
                GitHub
              </a>
              <a href={`${REPO}/blob/main/src/lib/AscVerify.sol`} target="_blank" rel="noreferrer">
                AscVerify.sol
              </a>
              <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
                MIT licence
              </a>
            </div>
          </div>

          <div className="lp-legal">
            <span>Testnet and synthetic data. No real borrower information appears in this system.</span>
            <span>Creditcoin CC3 · chainKey 3 → Ethereum mainnet</span>
          </div>
        </div>

        <div className="lp-imprint" aria-hidden="true">
          <span>Dokett</span>
        </div>
      </footer>
    </div>
  );
}
