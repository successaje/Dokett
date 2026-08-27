import type { ReactNode } from 'react';
import { useReveal } from '../lib/motion';
import { HeightRuler, Mark, StatusPill } from '../components/primitives';

/**
 * The title page.
 *
 * Not a crypto hero. No gradient, no 3D render, no logo carousel, no "the future
 * of" — those sell a product, and Covenant is a record. This page is set as the
 * cover of a document: a statement of the gap, the mechanism, and the terms on
 * which it should be trusted.
 *
 * It states its own limitations before the call to action, which almost no
 * protocol does. That is not modesty; it is the argument. A registry whose
 * entire claim is that nobody can assert anything into it has to be the first to
 * say what it cannot prove — otherwise the claim is just marketing, and a
 * technical reader will assume the rest is too.
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

const FAILURES: [string, string][] = [
  ['On-chain credit scores', 'A number with no recourse and no sybil cost. Nobody lends against an opinion.'],
  ['Aave credit delegation', 'The delegator got no upside and no enforcement. Delegation without payment is charity.'],
  ['Goldfinch', 'Not an underwriting failure — an observability failure. Borrowers reported performance in PDFs.'],
  ['Maple v1', 'Pool delegates with no cross-venue visibility, so the risk was correlated and invisible.'],
];

const STEPS: [string, string, string][] = [
  [
    '01',
    'Register',
    'Anyone records an obligation against any address. Permissionless by design — a registry that gatekeeps registration is a private database. The registrar posts a bond, so spam has a price.',
  ],
  [
    '02',
    'Prove',
    'A repayment on Ethereum is proven to Creditcoin by an ASC proof, verified by a native precompile in one block for about $0.000024. Admissibility keys off the proven height, never who submitted it.',
  ],
  [
    '03',
    'Degrade',
    'If no admissible proof arrives before the window closes, the obligation degrades on its own and the underwriter’s first-loss capital is slashed to the creditor. No reporter, no committee, no oracle operator.',
  ],
];

/**
 * The four things people actually come here to do.
 *
 * A registry is a record, and this console renders that record well — but a
 * reader landing cold could only ever *look* at things, and the page's own call
 * to action invited them to browse. "What can I do here" had no answer.
 *
 * These are stated as roles and intents rather than as feature names, because
 * nobody arrives wanting to visit "Encumbrance"; they arrive wanting to know
 * whether an asset is already pledged. Each one lands on live state.
 */
const PATHS: [string, string, string, string, string][] = [
  [
    'Borrower',
    'Cure a delinquency',
    'Marked delinquent because no proof arrived — not because anyone decided you did not pay. Proving the payment restores the record, however late. No account, no wallet, and no gas: a relay pays for it.',
    '#/registry',
    'Find the obligation',
  ],
  [
    'Underwriter',
    'Price a named borrower',
    'Read the underwriting file on any live obligation — what is owed, what has been proven, who is already exposed. Post capital and you are first in line for loss, slashed by proof rather than by committee.',
    '#/underwriter',
    'See the book',
  ],
  [
    'Lender · originator',
    'Check what they already owe',
    'The oldest question in finance, asked across venues that have never spoken to each other. Bonded and unbonded claims are reported separately and never summed.',
    '#/solvency',
    'Run a solvency check',
  ],
  [
    'Asset issuer · developer',
    'Ask if collateral is pledged',
    'Query whether an asset already carries a claim before you lend against it — from the browser, or from your own backend against the same free public endpoint.',
    '#/encumbrance',
    'Check an asset',
  ],
];

/**
 * Why this chain, argued rather than assumed.
 *
 * The weakest version of this project would treat ASC as a hackathon
 * requirement it had to satisfy. The honest version is that three conditions
 * had to hold simultaneously for an obligation layer to be buildable at all,
 * and removing any one of them breaks it.
 */
const WHY_HERE: [string, string, string][] = [
  [
    '01',
    'A chain whose subject is already credit',
    'Creditcoin has spent years building on-chain credit infrastructure rather than retrofitting lending onto a general-purpose chain. A registry belongs on a chain that wants to be the record, not on a venue that competes with the parties recording on it. Neutrality is a product requirement here, not a preference.',
  ],
  [
    '02',
    'Attestcoin — the missing evidence primitive',
    'A Creditcoin contract can cryptographically verify that a specific Ethereum event occurred: no bridge, no messaging layer, no oracle operator. A repayment on one chain triggering logic on another is exactly the primitive an obligation layer needs, and it did not exist before.',
  ],
  [
    '03',
    'History cheap enough to keep asking about',
    'A registry exists to answer questions about old obligations. We measured rather than assumed: proving a two-year-old Ethereum fact costs 26% more than a twenty-minute-old one — not per year, in total, across 51,529× the age. Near-flat-cost history is what makes a permanent registry economic instead of merely appealing.',
  ],
];

const LIMITS: [string, string][] = [
  [
    'The attestor set is permissioned',
    'Covenant inherits the ASC trust model. That set is currently AuthorizedOnly with a 0 CTC minimum bond and no published slashing regime — stronger than a multisig bridge, weaker than a ZK light client. It is the protocol’s most important external dependency, and the evidence layer is abstracted so a second backend can replace it.',
  ],
  ['Privacy is version one', 'Identity is a commitment, but payment addresses and amounts are public by construction. Do not put real borrower data in this registry today.'],
  ['One source chain', 'Ethereum mainnet only, because that is what ASC attests today.'],
  ['Spam is priced, not adjudicated', 'Anyone can register a fiction against anyone. Bonds and bucketing make it expensive and visible; v1 does not judge it.'],
  ['Registration is not lien perfection', 'On-chain registration carries no legal force in any jurisdiction on its own.'],
];

const REPO = 'https://github.com/successaje/covenant';

export default function Landing() {
  return (
    <div className="landing">
      {/* ── cover ─────────────────────────────────────────────────────── */}
      <section className="page lp-cover">
        <div className="eyebrow rise" style={{ '--d': '0ms' } as React.CSSProperties}>
          Covenant · a register of obligations
        </div>

        <h1 className="lp-title rise" style={{ '--d': '70ms' } as React.CSSProperties}>
          Crypto has a credit market
          <br />
          and no credit bureau.
        </h1>

        <p className="lp-lede rise" style={{ '--d': '150ms' } as React.CSSProperties}>
          Covenant is a registry where a promise to pay is a first-class on-chain object, and its
          state advances only on cryptographically verified evidence — never on anyone’s word.
        </p>

        <div className="lp-cta rise" style={{ '--d': '230ms' } as React.CSSProperties}>
          <a className="lp-btn lp-btn-primary" href="#/registry">
            Enter the register
          </a>
          <a className="lp-btn" href={REPO} target="_blank" rel="noreferrer">
            Read the source
          </a>
        </div>
      </section>

      {/* ── what are you here to do ───────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">What brings you here</h2>
          <p className="lp-body">
            Covenant is a record, but it is not only something to read. Four things people
            actually come here to do — each one lands on live testnet state, not a mockup.
          </p>
        </Reveal>

        <div className="lp-paths">
          {PATHS.map(([role, title, body, href, cta], i) => (
            <Reveal key={title} delay={i * 70}>
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

      {/* ── the gap ────────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">A lender is about to extend $1,000,000</h2>
          <p className="lp-body">
            Before approving it they ask the oldest question in finance —{' '}
            <strong>“what do you already owe?”</strong> In traditional finance an entire apparatus
            exists to answer it: bureaus, lien registries, filing systems, auditors, courts. The
            answer is imperfect, but it exists.
          </p>
          <p className="lp-body">
            Move that borrower on-chain and they might hold a loan on Ethereum, collateral locked on
            a second chain, a tokenized asset on a third, and a credit facility with a protocol that
            has never spoken to any of the others. Each system sees its own slice of reality
            perfectly. <strong>None of them can see the others.</strong> The oldest question in
            finance gets asked, and there is nowhere to send it.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="figures lp-figures">
            <div className="figure">
              <div className="figure-label">On-chain private credit</div>
              <div className="figure-value">$14B</div>
              <div className="figure-sub">active tokenized loans</div>
            </div>
            <div className="figure">
              <div className="figure-label">Tokenized real-world assets</div>
              <div className="figure-value">$20B</div>
              <div className="figure-sub">on-chain AUM</div>
            </div>
            <div className="figure">
              <div className="figure-label">Registries underneath</div>
              <div className="figure-value">0</div>
              <div className="figure-sub">no bureau, no lien registry, no court</div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <p className="lp-body">
            The instinct is to treat this as an early-market gap that scale will close. It is the
            opposite. Every new chain, every new venue and every newly tokenized asset adds another
            silo of obligations nobody else can observe — <strong>fragmentation compounds with
            adoption</strong>. Every credit blowup of the last cycle was the same failure: not fraud
            we could not punish, but leverage we could not <em>see</em>.
          </p>
        </Reveal>
      </section>

      {/* ── why the earlier attempts died ──────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">Every previous attempt was attacked with better models</h2>
          <p className="lp-body">None of them was attacked with better evidence.</p>
        </Reveal>

        <div className="lp-list">
          {FAILURES.map(([name, why], i) => (
            <Reveal key={name} delay={i * 60}>
              <div className="lp-list-row">
                <div className="lp-list-k">{name}</div>
                <div className="lp-list-v">{why}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── why here ──────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">Why this could not have been built anywhere else</h2>
          <p className="lp-body">
            Two things changed recently enough that this was not buildable before. Loans began
            settling in stablecoins, so a repayment stopped being something a borrower{' '}
            <em>reports</em> and became something that provably <em>happened</em> at a specific
            block height. And a contract gained the ability to check that for itself.
          </p>
          <p className="lp-body">
            Three conditions had to hold at once. Remove any one and this does not work.
          </p>
        </Reveal>

        <div className="lp-steps">
          {WHY_HERE.map(([n, title, body], i) => (
            <Reveal key={n} delay={i * 90}>
              <div className="lp-step">
                <div className="rail-idx">{n}</div>
                <h3 className="lp-step-title">{title}</h3>
                <p className="lp-step-body">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={280}>
          <div className="lp-pull">
            <p className="lp-pull-b">
              Creditcoin knows how to record credit. Attestcoin lets it see across chains. Covenant
              turns what it can see into a shared, verifiable record of obligations.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── the inversion ─────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <div className="lp-pull">
            <p className="lp-pull-a">
              Every other cross-chain project proves that something happened.
            </p>
            <p className="lp-pull-b">Covenant proves that nothing did.</p>
          </div>
        </Reveal>

        <Reveal delay={60}>
          <p className="lp-body">
            An obligation does not stay healthy by inertia. It degrades unless proof of payment
            arrives, so nobody has to volunteer bad news and nobody can suppress it.
          </p>
          <p className="lp-body lp-caveat">
            To be exact, because it matters: you cannot prove a negative with an inclusion proof, and
            Covenant does not claim to. It proves an on-chain fact — that no admissible proof of
            payment was presented before the deadline. That is equivalent to non-payment in practice
            because submission is permissionless, costs a fraction of a cent, and the borrower is the
            party most motivated to submit. And if it is ever wrong, a late proof of an in-window
            payment still cures it.
          </p>
        </Reveal>
      </section>

      {/* ── specimen: the instrument itself ───────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">The clock is a block height</h2>
          <p className="lp-body">
            No timestamp exists in anything an ASC proof binds, so every deadline is denominated in
            attested source-chain height. It is also what makes stall protection structural: a
            frozen attested head expires nothing.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="lp-specimen">
            <div className="row wrap" style={{ gap: 10, marginBottom: 16 }}>
              <span className="eyebrow">Obligation 3</span>
              <StatusPill status="Delinquent" />
            </div>

            <HeightRuler
              windowEnd={23_100_000n}
              cureEnd={23_150_400n}
              head={23_100_000n}
              headIsLowerBound
            />

            <p className="lp-specimen-cap">
              A live component from the console, not an illustration. The band is the cure window —
              the only stretch of height in which a late proof still restores this obligation. Once
              the attested head passes its right edge, the default is final and first-loss capital is
              slashed in the same transaction.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ── mechanism ─────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">How it works</h2>
        </Reveal>
        <div className="lp-steps">
          {STEPS.map(([n, title, body], i) => (
            <Reveal key={n} delay={i * 90}>
              <div className="lp-step">
                <div className="rail-idx">{n}</div>
                <h3 className="lp-step-title">{title}</h3>
                <p className="lp-step-body">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── the market ────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">Credit becomes a price, not a score</h2>
          <p className="lp-body">
            Underwriters stake first-loss capital against a <strong>named</strong> borrower — not a
            pool, not a rating. They earn a premium when the borrower pays and are slashed by proof
            when they do not.
          </p>
          <p className="lp-body">
            That puts the credit decision where the information actually is: the loan officer, the
            employer, the co-op, the merchant acquirer. What it costs to underwrite someone becomes
            their cost of credit — a live market number instead of a model’s guess.
          </p>
        </Reveal>
      </section>

      {/* ── the ecosystem play ────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">This console is not the product</h2>
          <p className="lp-body">
            It is how a person reads the register. The product is the record itself, and the fact
            that anything can query it.
          </p>
          <p className="lp-body">
            No lending protocol should have to build its own cross-chain payment verification,
            obligation state machine, default detection, encumbrance registry and evidence history.
            Those are not competitive advantages. They are plumbing that every credit venue rebuilds
            badly and in isolation — the same way no website implements its own DNS.{' '}
            <strong>It should be able to ask.</strong>
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="lp-list">
            <div className="lp-list-row">
              <div className="lp-list-k">A lender, before underwriting</div>
              <div className="lp-list-v">
                Query the subject’s proven record and what is already outstanding against them —
                then decide. The question that has no answer anywhere else in crypto today.
              </div>
            </div>
            <div className="lp-list-row">
              <div className="lp-list-k">An RWA platform, before accepting collateral</div>
              <div className="lp-list-v">
                Ask whether the asset being pledged is already encumbered. If it is, price the risk
                or decline it — rather than discovering the prior claim during a liquidation.
              </div>
            </div>
            <div className="lp-list-row">
              <div className="lp-list-k">Any protocol, on a repayment</div>
              <div className="lp-list-v">
                A payment settles on Ethereum, Attestcoin proves the event to Creditcoin, and the
                obligation advances — with no reporter anywhere in the path.
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={160}>
          <p className="lp-body">
            Every one of those queries is <strong>live, free and unauthenticated</strong> today, and
            it is the same read layer this console runs on. There is no private tier: the Lens is a
            pure projection over chain events, so anyone can recompute every figure it reports
            directly from the chain. A registry that asks you to trust its own reporting has already
            failed at the one job it exists to do.
          </p>
          <div className="lp-cta">
            <a className="lp-btn" href="#/developers">
              Read the API
            </a>
          </div>
        </Reveal>
      </section>

      {/* ── limitations ───────────────────────────────────────────────── */}
      <section className="page lp-section">
        <Reveal>
          <h2 className="lp-h2">What this does not do yet</h2>
          <p className="lp-body">
            A registry whose claim is that nobody can assert anything into it has to be first to say
            what it cannot prove.
          </p>
        </Reveal>

        <div className="lp-list">
          {LIMITS.map(([k, v], i) => (
            <Reveal key={k} delay={i * 50}>
              <div className="lp-list-row">
                <div className="lp-list-k">{k}</div>
                <div className="lp-list-v">{v}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── close ─────────────────────────────────────────────────────── */}
      <section className="page lp-close">
        <Reveal>
          <h2 className="lp-h2">Ask before you lend.</h2>
          <p className="lp-body">
            What does this counterparty already owe? Is this collateral already pledged? Those
            queries do not exist anywhere else in crypto.
          </p>
          <div className="lp-cta">
            <a className="lp-btn lp-btn-primary" href="#/solvency">
              Run a solvency check
            </a>
            <a className="lp-btn" href="#/encumbrance">
              Check an asset
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
                A register of obligations, built on Attestcoin Smart Contracts. Every status here was
                reached by evidence — never by a reporter, a committee, or an oracle operator.
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
              <a href={`${REPO}/blob/main/docs/ARCHITECTURE.md`} target="_blank" rel="noreferrer">
                Architecture
              </a>
              <a href={`${REPO}/blob/main/docs/THREAT-MODEL.md`} target="_blank" rel="noreferrer">
                Threat model
              </a>
              <a href={`${REPO}/blob/main/docs/ASC-INTEGRATION.md`} target="_blank" rel="noreferrer">
                ASC integration
              </a>
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
          <span>Covenant</span>
        </div>
      </footer>
    </div>
  );
}
