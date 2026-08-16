import { lens, useLens } from '../lib/lens';
import { big, units } from '../lib/format';
import { Addr, Card, ErrorMsg, Loading, Metric, Pill, StatusPill } from '../components/primitives';
import type { Obligation } from '../lib/types';

const ADVERSE = new Set(['Delinquent', 'Default', 'ChargedOff']);

export default function Registry() {
  const res = useLens((s) => lens.obligations(s), []);

  if (res.state === 'loading')
    return (
      <Card title="Registry">
        <Loading rows={5} />
      </Card>
    );

  if (res.state === 'error')
    return (
      <Card title="Registry">
        <ErrorMsg onRetry={res.reload}>{res.error.message}</ErrorMsg>
      </Card>
    );

  if (res.state !== 'ok') return null;

  const all: Obligation[] = res.data.obligations;
  const live = all.filter((o) => ['Active', 'Current', 'Delinquent'].includes(o.status));
  const adverse = all.filter((o) => ADVERSE.has(o.status));
  const bonded = all.filter((o) => o.bonded);

  const outstandingBonded = bonded
    .filter((o) => !['Settled', 'ChargedOff'].includes(o.status))
    .reduce((a, o) => a + big(o.outstanding), 0n);

  const coverage = all.reduce((a, o) => a + big(o.coverage), 0n);

  return (
    <div className="stack">
      <div className="metrics">
        <Metric label="Registered" value={all.length} sub={`${live.length} live`} />
        <Metric
          label="Bonded outstanding"
          value={units(outstandingBonded.toString())}
          sub="unbonded excluded, never summed in"
        />
        <Metric
          label="First-loss coverage"
          value={units(coverage.toString())}
          sub="staked against named obligors"
          tone={coverage > 0n ? 'good' : 'neutral'}
        />
        <Metric
          label="Adverse"
          value={adverse.length}
          sub="delinquent, default or charged off"
          tone={adverse.length > 0 ? 'bad' : 'good'}
        />
      </div>

      <Card
        title="Obligations"
        actions={<span className="eyebrow">as of block {res.data.asOfBlock}</span>}
        note="Every row here advanced to its current status through a verified ASC proof or an attested-height comparison. No party can assert a status into this table."
      >
        {all.length === 0 ? (
          <div className="msg">
            The registry is empty. Register an obligation, or run <code>npm run keeper</code> to begin
            indexing.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Status</th>
                  <th>Registrar</th>
                  <th>Payer</th>
                  <th className="right">Outstanding</th>
                  <th className="right">Periods</th>
                  <th className="right">Coverage</th>
                  <th className="right">Window ends</th>
                </tr>
              </thead>
              <tbody>
                {all.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <a className="mono" href={`#/obligation/${o.id}`}>
                        #{o.id}
                      </a>
                    </td>
                    <td>
                      <StatusPill status={o.status} />
                    </td>
                    <td>
                      <span className="row" style={{ gap: 6 }}>
                        <Addr value={o.registrar} />
                        {!o.bonded && <Pill tone="warn">unbonded</Pill>}
                      </span>
                    </td>
                    <td>
                      <Addr value={o.sourcePayer} />
                    </td>
                    <td className="right num">{units(o.outstanding)}</td>
                    <td className="right num">
                      {o.periodsSatisfied}/{o.periodsTotal}
                    </td>
                    <td className="right num">{units(o.coverage)}</td>
                    <td className="right num" style={{ color: 'var(--text-dim)' }}>
                      {o.windowEndHeight}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
