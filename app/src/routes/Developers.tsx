import type { ReactNode } from 'react';

const REPO = 'https://github.com/successaje/Dokett';

const TOC = [
  ['read-api', 'Read API'],
  ['write-path', 'Write path'],
  ['design-docs', 'Design & threat model'],
  ['run-it', 'Run it yourself'],
  ['contracts', 'Contracts'],
] as const;

function Endpoint({
  method,
  path,
  desc,
  example,
}: {
  method: string;
  path: string;
  desc: string;
  example: string;
}) {
  return (
    <div className="doc-item">
      <div className="doc-item-head">
        <span className="doc-item-title mono">
          <span className="doc-method">{method}</span> {path}
        </span>
      </div>
      <p className="doc-item-desc">{desc}</p>
      <div className="table-wrap">
        <pre className="mono doc-example">{example}</pre>
      </div>
    </div>
  );
}

function DocLink({
  href,
  title,
  desc,
  external,
}: {
  href: string;
  title: string;
  desc: string;
  external?: boolean;
}) {
  return (
    <a
      className="doc-item doc-item-link"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
    >
      <div className="doc-item-head">
        <span className="doc-item-title">{title}</span>
        <span className="doc-item-arrow" aria-hidden="true">
          {external ? '↗' : '→'}
        </span>
      </div>
      <p className="doc-item-desc">{desc}</p>
    </a>
  );
}

/**
 * A deployed, callable state-changing function.
 *
 * `ui` records whether the Console currently puts a form in front of it. That
 * distinction is worth being explicit about rather than quietly omitting: the
 * protocol's write surface is complete and live, and the Console simply has not
 * grown a form for every part of it yet. Listing only what has a button would
 * misrepresent the protocol as read-only.
 */
function WriteCall({
  contract,
  sig,
  desc,
  ui,
}: {
  contract: string;
  sig: string;
  desc: ReactNode;
  ui: string;
}) {
  return (
    <div className="doc-item">
      <div className="doc-item-head">
        <span className="doc-item-title mono">
          <span className="doc-method">{contract}</span> {sig}
        </span>
      </div>
      <p className="doc-item-desc">{desc}</p>
      <p className="doc-item-desc" style={{ color: 'var(--ink-4)', marginTop: 6 }}>
        Console: {ui}
      </p>
    </div>
  );
}

function DocSection({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="doc-section">
      <h2 className="doc-section-title">{title}</h2>
      {aside ? <p className="doc-section-aside">{aside}</p> : null}
      {children}
    </section>
  );
}

export default function Developers() {
  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">Build on the record</div>
        <h1 className="page-title">Developers</h1>
        <p className="page-lede">
          Dokett has no private API. Everything the Console renders comes from the same free,
          public read layer documented here — a venue, an underwriter, or a curious stranger can
          query the exact same facts.
        </p>
      </div>

      <div className="page docs-layout">
        <nav className="docs-toc" aria-label="On this page">
          <div className="docs-toc-label">On this page</div>
          {TOC.map(([id, label]) => (
            <a
              key={id}
              href={`#/developers`}
              className="docs-toc-link"
              onClick={(e) => {
                // A real hash-fragment link would collide with the hash router,
                // which treats the whole hash as one route. Scroll manually
                // instead, leaving #/developers as the URL.
                e.preventDefault();
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              {label}
            </a>
          ))}
          <div className="docs-toc-divider" />
          <a href={REPO} target="_blank" rel="noreferrer" className="docs-toc-link">
            Source on GitHub ↗
          </a>
        </nav>

        <div className="docs-content">
          <DocSection
            id="read-api"
            title="Read API"
            aside="Served by the Lens — a pure projection over on-chain events. It holds no privileged state and asserts nothing that isn't derivable from the chain."
          >
            <Endpoint
              method="GET"
              path="/solvency/:entity"
              desc="Bonded first-loss capital posted by an underwriter, net of what's already encumbered. Never sums unbonded claims."
              example={'curl https://dokett-lens.fly.dev/solvency/0x9BAC...5a032'}
            />
            <Endpoint
              method="GET"
              path="/encumbrance/:asset"
              desc="Every live claim currently secured against a given collateral reference."
              example={'curl https://dokett-lens.fly.dev/encumbrance/0x...'}
            />
            <Endpoint
              method="GET"
              path="/obligation/:id"
              desc="Full record for one obligation: schedule, status, docket of verified transitions, and bond state."
              example={'curl https://dokett-lens.fly.dev/obligation/5'}
            />
            <Endpoint
              method="GET"
              path="/profile/:subject"
              desc="Everything proven about a commitment (obligor or address), split explicitly from anything merely attested by an off-chain directory. Never rendered as one list."
              example={'curl https://dokett-lens.fly.dev/profile/0xbb27...050d1'}
            />
          </DocSection>

          <DocSection
            id="write-path"
            title="Write path"
            aside="Dokett is a protocol, not a viewer over one. Every state-changing call below is deployed and callable on CC3 today — including obligation creation. Where the Console has no form for one yet, that is a gap in this interface, not in the protocol, and it is named rather than hidden."
          >
            <WriteCall
              contract="Register"
              sig="register(ObligationInit, uint64 expectedChainId) payable"
              desc={
                <>
                  The creation primitive. One struct carries the whole instrument: obligor and
                  creditor commitments, principal, payment asset, source chain, payer and payee
                  binding, schedule (start height, period length, period count, period amount),
                  cure window, seniority and collateral reference — with the registrar bond and
                  keeper fund sent as value. Registration is permissionless; the bond is what gives
                  the claim weight.
                </>
              }
              ui="form in progress. The blocker was that registration posts a CTC registrar bond, which a visitor arriving with an empty wallet cannot pay — the faucet below now solves that. Callable today via the ABI, and used by every seed script in the repo."
            />
            <WriteCall
              contract="PaymentAdapter"
              sig="provePayment(uint256 id, AscVerify.Proof p)"
              desc={
                <>
                  Submit an ASC proof of a qualifying source-chain transfer. Admissibility keys off
                  the height the proof binds to, never on who sent it — so anyone may submit for
                  anyone.
                </>
              }
              ui="yes — the cure form on any delinquent obligation, with a relay paying the gas."
            />
            <WriteCall
              contract="Bond"
              sig="post(uint256 obligationId, address collateral, uint128 amount, uint16 spreadBps)"
              desc={
                <>
                  Stake first-loss capital against one named obligation. Slashed to the creditor by
                  proof if it defaults; released with premium if it settles.
                </>
              }
              ui="form in progress. Underwriting stakes the underwriter's own capital, so unlike a cure it cannot be gas-sponsored without taking custody — the faucet hands you testnet capital to stake instead. Demonstrated on-chain: see the first slash in Posts."
            />
            <WriteCall
              contract="POST"
              sig="https://dokett-relay.fly.dev/faucet"
              desc={
                <>
                  Testnet capital, so the write paths are reachable by someone arriving with an
                  empty wallet: <code className="mono">{'{ "address": "0x…" }'}</code> returns CTC
                  for gas and bonds, plus mUSDC to underwrite with. Runs on its own key, separate
                  from the cure relay's — draining the faucet must never stop a borrower curing.
                </>
              }
              ui="used by the flows above. Six-hour cooldown per address; testnet play money only."
            />
            <WriteCall
              contract="SilenceAdapter"
              sig="markDelinquent(uint256) · finalizeDefault(uint256)"
              desc={
                <>
                  Drive degradation when no admissible proof arrived before the attested deadline.
                  Permissionless and bounty-paying, so a keeper is an optimisation rather than a
                  trusted party.
                </>
              }
              ui="no form — and deliberately so. These are called continuously by an unattended keeper; a button would imply a human decides when someone defaults."
            />
          </DocSection>

          <DocSection
            id="design-docs"
            title="Design & threat model"
            aside="The actual specification, not a summary of it — corrected in the open when we got it wrong."
          >
            <DocLink
              href="#/developers/architecture"
              title="Architecture"
              desc="System diagram, data model, contract responsibilities, ASC reference, build order. Carries its own corrections log (C1–C4) for where the first draft was wrong."
            />
            <DocLink
              href="#/developers/threat-model"
              title="Threat model"
              desc="T-01 through T-15, and the protocol invariants (INV-1–INV-10) the test suite exists to defend."
            />
            <DocLink
              href="#/developers/asc-integration"
              title="ASC integration"
              desc="Exactly how Dokett uses Attestcoin Smart Contracts — measured gas costs, batching, the liveness gate, and the guarded path around BlockProver."
            />
            <DocLink
              href="#/developers/use-cases"
              title="Use cases"
              desc="A full end-to-end walkthrough, the audience this actually serves, and an explicit section on what isn't load-bearing yet."
            />
          </DocSection>

          <DocSection id="run-it" title="Run it yourself">
            <div className="table-wrap">
              <pre className="mono doc-example" style={{ fontSize: 12.5, lineHeight: 1.7 }}>
{`git clone ${REPO} && cd dokett
npm install
npm test            # 66 contract tests + 7 lens projection tests
npm run demo        # seeded Lens + Console on :5173 — no chain required`}
              </pre>
            </div>
            <p className="doc-section-aside" style={{ marginTop: 12 }}>
              <code className="mono">npm run demo</code> serves a fixture projection covering every
              state in the lifecycle, including a defaulted obligation with a slashed bond. Against
              a real deployment, see the quickstart in the repo README for{' '}
              <code className="mono">npm run prove:one</code>, <code className="mono">npm run lens</code>, and{' '}
              <code className="mono">npm run keeper</code>.
            </p>
          </DocSection>

          <DocSection id="contracts" title="Contracts">
            <DocLink
              href={`${REPO}/blob/main/src/lib/AscVerify.sol`}
              title="AscVerify.sol — MIT, standalone"
              desc="The single door to the outside world in this codebase: receipt-status assertion, replay guards, confirmation depth, liveness gate, chainkey resolution. Built to be reused by any project verifying ASC evidence, not just this one."
              external
            />
          </DocSection>
        </div>
      </div>
    </>
  );
}
