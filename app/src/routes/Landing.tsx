/**
 * The title page.
 *
 * Not a crypto hero. No gradient, no 3D render, no logo carousel, no "the future
 * of" — those sell a product, and Covenant is a record. This page is set as the
 * cover of a document: a statement of the gap, the mechanism, and the terms on
 * which it should be trusted.
 *
 * It states its own limitations above the fold-ish, which almost no protocol
 * does. That is not modesty; it is the argument. A registry whose entire claim
 * is that nobody can assert anything into it has to be the first to say what it
 * cannot prove — otherwise the claim is just marketing, and a technical reader
 * will assume the rest is too.
 */

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

const LIMITS: [string, string][] = [
  [
    'The attestor set is permissioned',
    'Covenant inherits the ASC trust model. That set is currently AuthorizedOnly with a 0 CTC minimum bond and no published slashing regime — stronger than a multisig bridge, weaker than a ZK light client. It is the protocol’s most important external dependency, and the evidence layer is abstracted so a second backend can replace it.',
  ],
  [
    'Privacy is version one',
    'Identity is a commitment, but payment addresses and amounts are public by construction. Do not put real borrower data in this registry today.',
  ],
  [
    'One source chain',
    'Ethereum mainnet only, because that is what ASC attests today.',
  ],
  [
    'Spam is priced, not adjudicated',
    'Anyone can register a fiction against anyone. Bonds and bucketing make it expensive and visible; v1 does not judge it.',
  ],
  [
    'Registration is not lien perfection',
    'On-chain registration carries no legal force in any jurisdiction on its own.',
  ],
];

export default function Landing() {
  return (
    <div className="landing">
      {/* ── cover ─────────────────────────────────────────────────────── */}
      <section className="page lp-cover">
        <div className="eyebrow">Covenant · a register of obligations</div>

        <h1 className="lp-title">
          Crypto has a credit market
          <br />
          and no credit bureau.
        </h1>

        <p className="lp-lede">
          Covenant is a registry where a promise to pay is a first-class on-chain object, and its
          state advances only on cryptographically verified evidence — never on anyone’s word.
        </p>

        <div className="lp-cta">
          <a className="lp-btn lp-btn-primary" href="#/registry">
            Enter the register
          </a>
          <a
            className="lp-btn"
            href="https://github.com/successaje/covenant"
            target="_blank"
            rel="noreferrer"
          >
            Read the source
          </a>
        </div>
      </section>

      {/* ── the gap, as a ledger rule ──────────────────────────────────── */}
      <section className="page">
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

        <p className="lp-body">
          A borrower — retail or institutional — can hold obligations at five protocols across four
          chains, and none of them can see the others. Every credit blowup of the last cycle was the
          same failure: not fraud we could not punish, but leverage we could not <em>see</em>.
        </p>
      </section>

      {/* ── why the earlier attempts died ──────────────────────────────── */}
      <section className="page lp-section">
        <h2 className="lp-h2">Every previous attempt was attacked with better models</h2>
        <p className="lp-body">None of them was attacked with better evidence.</p>

        <div className="lp-list">
          {FAILURES.map(([name, why]) => (
            <div className="lp-list-row" key={name}>
              <div className="lp-list-k">{name}</div>
              <div className="lp-list-v">{why}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── the inversion ─────────────────────────────────────────────── */}
      <section className="page lp-section">
        <div className="lp-pull">
          <p className="lp-pull-a">Every other cross-chain project proves that something happened.</p>
          <p className="lp-pull-b">Covenant proves that nothing did.</p>
        </div>

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
      </section>

      {/* ── mechanism ─────────────────────────────────────────────────── */}
      <section className="page lp-section">
        <h2 className="lp-h2">How it works</h2>
        <div className="lp-steps">
          {STEPS.map(([n, title, body]) => (
            <div className="lp-step" key={n}>
              <div className="rail-idx">{n}</div>
              <h3 className="lp-step-title">{title}</h3>
              <p className="lp-step-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── the market ────────────────────────────────────────────────── */}
      <section className="page lp-section">
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
      </section>

      {/* ── limitations, on the front page ────────────────────────────── */}
      <section className="page lp-section">
        <h2 className="lp-h2">What this does not do yet</h2>
        <p className="lp-body">
          A registry whose claim is that nobody can assert anything into it has to be first to say
          what it cannot prove.
        </p>

        <div className="lp-list">
          {LIMITS.map(([k, v]) => (
            <div className="lp-list-row" key={k}>
              <div className="lp-list-k">{k}</div>
              <div className="lp-list-v">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── close ─────────────────────────────────────────────────────── */}
      <section className="page lp-close">
        <h2 className="lp-h2">Ask before you lend.</h2>
        <p className="lp-body">
          What does this counterparty already owe? Is this collateral already pledged? Those queries
          do not exist anywhere else in crypto.
        </p>
        <div className="lp-cta">
          <a className="lp-btn lp-btn-primary" href="#/solvency">
            Run a solvency check
          </a>
          <a className="lp-btn" href="#/encumbrance">
            Check an asset
          </a>
        </div>
      </section>

      <footer className="page">
        <div className="colophon">
          <p>
            <strong>Covenant</strong> · built on Attestcoin Smart Contracts, Creditcoin CC3. Testnet
            and synthetic data throughout — no real borrower information appears anywhere in this
            system.
          </p>
        </div>
      </footer>
    </div>
  );
}
