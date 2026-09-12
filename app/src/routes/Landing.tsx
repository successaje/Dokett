import type { ReactNode } from 'react';
import { useReveal } from '../lib/motion';
import { Mark } from '../components/primitives';

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="reveal" style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}

const REPO = 'https://github.com/successaje/Dokett';
const DEMOBANK = 'https://demobank-credit.vercel.app';
const SAMPLE_SUBJECT = '0x986a7f70b1677d3c4ea6c16116f2b47b53eebc59ae822d4ed18030c008aa928a';
const SAMPLE_ASSET = '0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f';

const AUDIENCES: [string, string, string, string, string][] = [
  [
    'Lenders',
    'See registered exposure before extending credit',
    'Inspect bonded and unbonded claims separately, with adverse history attached.',
    `#/solvency?q=${SAMPLE_SUBJECT}`,
    'Open a populated check',
  ],
  [
    'RWA platforms',
    'See whether collateral already carries a claim',
    'Query a public collateral reference before accepting the asset.',
    `#/encumbrance?q=${SAMPLE_ASSET}`,
    'Inspect an encumbered asset',
  ],
  [
    'Developers',
    'Add the obligation layer to another application',
    'Read the same free public API used by the Console and DemoBank.',
    '#/developers',
    'Read the API',
  ],
];

export default function Landing() {
  return (
    <div className="landing">
      <section className="page lp-cover">
        <div className="eyebrow rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          Dokett · Creditcoin obligation registry
        </div>
        <h1 className="lp-title rise" style={{ '--d': '70ms' } as React.CSSProperties}>
          Know what a borrower already owes before you lend.
        </h1>
        <p className="lp-lede rise" style={{ '--d': '150ms' } as React.CSSProperties}>
          Dokett is a shared obligation registry on Creditcoin. It uses Attestcoin proofs of
          Ethereum payments and attested block height to maintain a record that lenders and RWA
          platforms can query before taking risk.
        </p>
        <p className="lp-lede lp-lede-tight rise" style={{ '--d': '200ms' } as React.CSSProperties}>
          Testnet infrastructure. Real Ethereum mainnet evidence. Synthetic borrowers only.
        </p>
        <div className="lp-cta rise" style={{ '--d': '260ms' } as React.CSSProperties}>
          <a className="lp-btn lp-btn-primary" href={DEMOBANK} target="_blank" rel="noreferrer">
            Run the lender demo ↗
          </a>
          <a className="lp-btn" href={`#/solvency?q=${SAMPLE_SUBJECT}`}>Inspect a borrower</a>
          <a className="lp-btn" href={REPO} target="_blank" rel="noreferrer">Review the source</a>
        </div>
      </section>

      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">One decision, three layers</div>
          <h2 className="lp-h2">A lender checks before it approves.</h2>
          <div className="lp-steps">
            <div className="lp-step">
              <div className="eyebrow">01 · Evidence</div>
              <h3 className="lp-step-title">Attestcoin verifies</h3>
              <p className="lp-step-body">
                A Creditcoin contract verifies a qualifying Ethereum transfer and the attested
                Ethereum height. Failed transactions and replayed proofs are rejected.
              </p>
            </div>
            <div className="lp-step">
              <div className="eyebrow">02 · Record</div>
              <h3 className="lp-step-title">Dokett records</h3>
              <p className="lp-step-body">
                Obligations move through Current, Delinquent, Default and Settled according to
                verified payments and deadlines measured against the attested source chain.
              </p>
            </div>
            <div className="lp-step">
              <div className="eyebrow">03 · Policy</div>
              <h3 className="lp-step-title">The lender decides</h3>
              <p className="lp-step-body">
                Dokett returns facts, including bonded and unbonded claims. Each lender keeps its
                own risk rules and reaches its own credit decision.
              </p>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="page lp-section">
        <Reveal>
          <div className="lp-pull"><p className="lp-pull-b">The protocol has no “Default” button.</p></div>
          <p className="lp-body">
            Anyone can trigger evaluation, but nobody can choose the result. If no qualifying
            payment proof has been submitted when the attested Ethereum height passes the deadline,
            the obligation becomes delinquent and can later default under the contract rules.
          </p>
          <p className="lp-body">
            This proves a precise fact about the registry: no admissible proof was recorded in time.
            It does not claim to prove that no payment occurred. A payment made inside the window can
            still cure delinquency while the cure period remains open.
          </p>
          <p className="lp-measure mono">Default + 250 mUSDC first-loss slash · one CC3 transaction · independently inspectable</p>
          <p className="lp-body">
            <a href="https://creditcoin-testnet.blockscout.com/tx/0x952c03ffa363ce8f0fe4eab397636f5aebc1b139380cfabd756ead678e2d480d" target="_blank" rel="noreferrer">
              Inspect the default and slash →
            </a>
          </p>
        </Reveal>
      </section>

      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">Try a real record</div>
          <h2 className="lp-h2">Start with data already on the register.</h2>
          <p className="lp-body">Each path opens a populated example. No address hunting and no setup required.</p>
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

      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">Reference integration</div>
          <h2 className="lp-h2">DemoBank is a separate lender application.</h2>
          <p className="lp-body">
            DemoBank is written by the Dokett team and deployed separately. It uses only Dokett’s
            public HTTP endpoints, then applies its own underwriting policy. That boundary shows
            where the registry ends and a lender’s judgment begins.
          </p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-primary" href={DEMOBANK} target="_blank" rel="noreferrer">Open DemoBank ↗</a>
            <a className="lp-btn" href="#/developers">Use the public API</a>
          </div>
        </Reveal>
      </section>

      <section className="page lp-section">
        <Reveal>
          <div className="eyebrow">Built and verifiable today · CC3 testnet</div>
          <ul className="lp-checks">
            <li>16 obligations across every lifecycle state</li>
            <li>Real Ethereum mainnet payment evidence</li>
            <li>Permissionless proof submission and evaluation</li>
            <li>Bonded underwriting with an executed first-loss slash</li>
            <li>Free, unauthenticated read API</li>
            <li>99 contract, projection and relay tests</li>
          </ul>
          <p className="lp-body lp-caveat">
            Registration is permissionless, so a claim is not proof that the underlying debt was
            legally agreed. Bonding adds economic weight without turning Dokett into an arbiter.
            The Attestcoin attestor set is permissioned today, and on-chain registration is not legal
            lien perfection. <a href="#/developers/threat-model">Read the threat model →</a>
          </p>
        </Reveal>
      </section>

      <section className="page lp-close">
        <Reveal>
          <h2 className="lp-h2">Ask before you lend.</h2>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-primary" href={DEMOBANK} target="_blank" rel="noreferrer">Run the lender demo ↗</a>
            <a className="lp-btn" href="#/registry">Inspect the register</a>
          </div>
        </Reveal>
      </section>

      <footer className="lp-footer">
        <div className="page">
          <div className="lp-cols">
            <div className="lp-col lp-col-about">
              <h4><Mark size={16} strokeWidth={3} /></h4>
              <p>A Creditcoin obligation registry whose post-registration transitions follow verified evidence and attested source-chain deadlines.</p>
              <a href="https://x.com/dokettlabs" target="_blank" rel="noreferrer">X (Twitter)</a>
            </div>
            <div className="lp-col">
              <h4>Console</h4>
              <a href="#/registry">Registry</a>
              <a href={`#/solvency?q=${SAMPLE_SUBJECT}`}>Solvency</a>
              <a href={`#/encumbrance?q=${SAMPLE_ASSET}`}>Encumbrance</a>
              <a href="#/underwriter">Underwriters</a>
            </div>
            <div className="lp-col">
              <h4>Evidence</h4>
              <a href="#/developers">Developers</a>
              <a href="#/posts">Research</a>
              <a href="#/developers/architecture">Architecture</a>
              <a href="#/developers/threat-model">Threat model</a>
            </div>
            <div className="lp-col">
              <h4>Source</h4>
              <a href={REPO} target="_blank" rel="noreferrer">GitHub</a>
              <a href={`${REPO}/blob/main/src/lib/AscVerify.sol`} target="_blank" rel="noreferrer">AscVerify.sol</a>
              <a href={`${REPO}/blob/main/LICENSE`} target="_blank" rel="noreferrer">MIT licence</a>
            </div>
          </div>
          <div className="lp-legal">
            <span>Testnet and synthetic data. No real borrower information appears in this system.</span>
            <span>Creditcoin CC3 · chainKey 3 → Ethereum mainnet</span>
          </div>
        </div>
        <div className="lp-imprint" aria-hidden="true"><span>Dokett</span></div>
      </footer>
    </div>
  );
}
