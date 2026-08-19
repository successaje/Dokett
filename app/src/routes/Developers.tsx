import { Section } from '../components/primitives';

const REPO = 'https://github.com/successaje/covenant';

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
    <div className="docket-entry">
      <div className="docket-head">
        <span className="docket-title mono">
          <span style={{ color: 'var(--ink-3)' }}>{method}</span> {path}
        </span>
      </div>
      <div className="docket-body">
        <p style={{ margin: '0 0 8px' }}>{desc}</p>
        <div className="table-wrap">
          <pre className="mono" style={{ margin: 0, fontSize: 12, overflowX: 'auto' }}>
            {example}
          </pre>
        </div>
      </div>
    </div>
  );
}

function DocLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a className="mono" href={href} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
      <div className="docket-entry" style={{ cursor: 'pointer' }}>
        <div className="docket-head">
          <span className="docket-title">{title}</span>
        </div>
        <div className="docket-body">
          <p style={{ margin: 0, fontFamily: 'var(--sans)' }}>{desc}</p>
        </div>
      </div>
    </a>
  );
}

export default function Developers() {
  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">Build on the record</div>
        <h1 className="page-title">Developers</h1>
        <p className="page-lede">
          Covenant has no private API. Everything the Console renders comes from the same free,
          public read layer documented below — a venue, an underwriter, or a curious stranger can
          query the exact same facts.
        </p>
      </div>

      <div className="page">
        <Section
          title="Read API"
          aside={
            <>
              Served by the Lens — a pure projection over on-chain events. It holds no privileged
              state and asserts nothing that isn't derivable from the chain.
            </>
          }
        >
          <div className="docket">
            <Endpoint
              method="GET"
              path="/solvency/:entity"
              desc="Bonded first-loss capital posted by an underwriter, net of what's already encumbered. Never sums unbonded claims."
              example={'curl https://covenant-lens.fly.dev/solvency/0x9BAC...5a032'}
            />
            <Endpoint
              method="GET"
              path="/encumbrance/:asset"
              desc="Every live claim currently secured against a given collateral reference."
              example={'curl https://covenant-lens.fly.dev/encumbrance/0x...'}
            />
            <Endpoint
              method="GET"
              path="/obligation/:id"
              desc="Full record for one obligation: schedule, status, docket of verified transitions, and bond state."
              example={'curl https://covenant-lens.fly.dev/obligation/5'}
            />
            <Endpoint
              method="GET"
              path="/profile/:subject"
              desc="Everything proven about a commitment (obligor or address), split explicitly from anything merely attested by an off-chain directory. Never rendered as one list."
              example={'curl https://covenant-lens.fly.dev/profile/0xbb27...050d1'}
            />
          </div>
        </Section>

        <Section
          title="Design and threat model"
          aside={<>The actual specification, not a summary of it — corrected in the open when we got it wrong.</>}
        >
          <div className="docket">
            <DocLink
              href={`${REPO}/blob/main/docs/ARCHITECTURE.md`}
              title="Architecture"
              desc="System diagram, data model, contract responsibilities, ASC reference, build order. Carries its own corrections log (C1–C4) for where the first draft was wrong."
            />
            <DocLink
              href={`${REPO}/blob/main/docs/THREAT-MODEL.md`}
              title="Threat model"
              desc="T-01 through T-15, and the protocol invariants (INV-1–INV-10) the test suite exists to defend."
            />
            <DocLink
              href={`${REPO}/blob/main/docs/ASC-INTEGRATION.md`}
              title="ASC integration"
              desc="Exactly how Covenant uses Attestcoin Smart Contracts — measured gas costs, batching, the liveness gate, and the guarded path around BlockProver."
            />
            <DocLink
              href={`${REPO}/blob/main/docs/USE-CASES.md`}
              title="Use cases"
              desc="A full end-to-end walkthrough, the audience this actually serves, and an explicit section on what isn't load-bearing yet."
            />
          </div>
        </Section>

        <Section title="Run it yourself">
          <div className="table-wrap">
            <pre className="mono" style={{ fontSize: 12.5, lineHeight: 1.7, overflowX: 'auto' }}>
{`git clone ${REPO} && cd covenant
npm install
npm test            # 66 contract tests + 7 lens projection tests
npm run demo        # seeded Lens + Console on :5173 — no chain required`}
            </pre>
          </div>
          <p className="note" style={{ marginTop: 10 }}>
            <code className="mono">npm run demo</code> serves a fixture projection covering every
            state in the lifecycle, including a defaulted obligation with a slashed bond. Against
            a real deployment, see the quickstart in the repo README for <code className="mono">npm run prove:one</code>,{' '}
            <code className="mono">npm run lens</code>, and <code className="mono">npm run keeper</code>.
          </p>
        </Section>

        <Section title="Contracts">
          <div className="docket">
            <DocLink
              href={`${REPO}/blob/main/src/lib/AscVerify.sol`}
              title="AscVerify.sol — MIT, standalone"
              desc="The single door to the outside world in this codebase: receipt-status assertion, replay guards, confirmation depth, liveness gate, chainkey resolution. Built to be reused by any project verifying ASC evidence, not just this one."
            />
          </div>
        </Section>
      </div>
    </>
  );
}
