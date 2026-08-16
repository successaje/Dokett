import { lens, useLens } from '../lib/lens';
import { big, units } from '../lib/format';
import {
  Addr,
  Empty,
  Failed,
  Figure,
  Figures,
  Loading,
  Section,
  StatusPill,
  UnbondedFlag,
} from '../components/primitives';
import type { Obligation } from '../lib/types';

const ADVERSE = new Set(['Delinquent', 'Default', 'ChargedOff']);
const TERMINAL = new Set(['Settled', 'ChargedOff']);

function Head() {
  return (
    <div className="page page-head">
      <div className="eyebrow">The record</div>
      <h1 className="page-title">Register of obligations</h1>
      <p className="page-lede">
        Every promise to pay recorded on this chain, and the evidence that moved it. Registration is
        permissionless; weight comes from the registrar's bond.
      </p>
    </div>
  );
}

export default function Registry() {
  const res = useLens((s) => lens.obligations(s), []);

  if (res.state === 'loading')
    return (
      <>
        <Head />
        <div className="page">
          <Loading rows={6} />
        </div>
      </>
    );

  if (res.state === 'error')
    return (
      <>
        <Head />
        <div className="page">
          <Failed what="the register" detail={res.error.message} onRetry={res.reload} />
        </div>
      </>
    );

  if (res.state !== 'ok') return null;

  const all: Obligation[] = res.data.obligations;
  const live = all.filter((o) => !TERMINAL.has(o.status));
  const adverse = all.filter((o) => ADVERSE.has(o.status));

  // Bonded only, and terminal states excluded. The unbonded figure is
  // deliberately absent rather than shown alongside: registration is
  // permissionless, so a combined outstanding would make defamation free.
  const outstandingBonded = all
    .filter((o) => o.bonded && !TERMINAL.has(o.status))
    .reduce((a, o) => a + big(o.outstanding), 0n);

  const coverage = all.reduce((a, o) => a + big(o.coverage), 0n);

  return (
    <>
      <Head />

      <div className="page">
        <Figures>
          <Figure label="Registered" value={all.length} sub={`${live.length} live`} />
          <Figure
            label="Bonded outstanding"
            value={units(outstandingBonded.toString())}
            sub="unbonded claims excluded"
            title="Only claims whose registrar posted a bond. Unbonded claims are never summed into this figure."
          />
          <Figure
            label="First-loss coverage"
            value={units(coverage.toString())}
            sub="staked against named obligors"
          />
          <Figure
            label="Adverse"
            value={adverse.length}
            sub="delinquent, default or charged off"
          />
        </Figures>

        <Section
          title="Obligations"
          aside={
            <>
              Every row reached its status through a verified ASC proof or an attested-height
              comparison. No party can assert a status into this table.
            </>
          }
        >
          {all.length === 0 ? (
            <Empty title="The register is empty">
              Register an obligation, or run <code className="mono">npm run keeper</code> to begin
              indexing.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Registrar</th>
                    <th>Payer</th>
                    <th className="num">Outstanding</th>
                    <th className="num">Periods</th>
                    <th className="num">Coverage</th>
                    <th className="num">Window ends</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((o) => (
                    <tr
                      key={o.id}
                      className="clickable"
                      onClick={() => {
                        window.location.hash = `#/obligation/${o.id}`;
                      }}
                    >
                      <td>
                        <a className="mono" href={`#/obligation/${o.id}`}>
                          {o.id}
                        </a>
                      </td>
                      <td>
                        <StatusPill status={o.status} />
                      </td>
                      <td>
                        <span className="row" style={{ gap: 7 }}>
                          <Addr value={o.registrar} />
                          {!o.bonded && <UnbondedFlag />}
                        </span>
                      </td>
                      <td>
                        <Addr value={o.sourcePayer} />
                      </td>
                      <td className="num">{units(o.outstanding)}</td>
                      <td className="num" style={{ color: 'var(--ink-3)' }}>
                        {o.periodsSatisfied}/{o.periodsTotal}
                      </td>
                      <td className="num">{units(o.coverage)}</td>
                      <td className="num" style={{ color: 'var(--ink-3)' }}>
                        {o.windowEndHeight}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
