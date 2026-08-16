import { lens, useLens } from '../lib/lens';
import { big, blocksToDuration, bps, units, STATUS_MEANING } from '../lib/format';
import { Addr, Card, ErrorMsg, Loading, Meter, Metric, Pill, StatusPill } from '../components/primitives';
import type { Status } from '../lib/types';

const LIFECYCLE: Status[] = ['Active', 'Current', 'Delinquent', 'Default'];

function Lifecycle({ status }: { status: Status }) {
  // Settled and ChargedOff are terminal and sit off the degradation path.
  const terminal = status === 'Settled' || status === 'ChargedOff';
  const idx = LIFECYCLE.indexOf(status);

  return (
    <div className="card-body">
      <div className="row" style={{ gap: 0, flexWrap: 'wrap' }}>
        {LIFECYCLE.map((s, i) => {
          const reached = !terminal && idx >= i;
          const isNow = !terminal && idx === i;
          return (
            <div key={s} className="row" style={{ gap: 0 }}>
              <div
                title={STATUS_MEANING[s]}
                style={{
                  padding: '4px 11px',
                  borderRadius: 100,
                  fontSize: 12,
                  fontWeight: isNow ? 650 : 500,
                  background: isNow ? 'var(--accent-dim)' : reached ? 'var(--surface-2)' : 'transparent',
                  color: isNow ? 'var(--accent)' : reached ? 'var(--text)' : 'var(--text-faint)',
                  border: `1px solid ${isNow ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {s}
              </div>
              {i < LIFECYCLE.length - 1 && (
                <div
                  aria-hidden
                  style={{
                    width: 22,
                    height: 1,
                    background: reached && idx > i ? 'var(--border-strong)' : 'var(--border)',
                  }}
                />
              )}
            </div>
          );
        })}
        {terminal && (
          <>
            <div aria-hidden style={{ width: 22, height: 1, background: 'var(--border)' }} />
            <StatusPill status={status} />
          </>
        )}
      </div>
      <p style={{ margin: '14px 0 0', color: 'var(--text-dim)', fontSize: 13 }}>
        {STATUS_MEANING[status]}
      </p>
    </div>
  );
}

/**
 * Obligation detail.
 *
 * Two things this screen refuses to fudge:
 *
 *   1. Deadlines are shown in ATTESTED SOURCE-CHAIN HEIGHT, with the wall-clock
 *      estimate clearly marked as an estimate. The protocol's clock is Ethereum's
 *      block height; presenting a confident date would be inventing precision the
 *      contract does not have.
 *
 *   2. A delinquent obligation always shows the cure path, because a delinquency
 *      is reversible right up until the cure height passes — and the borrower is
 *      the person most likely to be reading this.
 */
export default function Obligation({ id }: { id: string }) {
  const res = useLens((s) => lens.obligation(id, s), [id]);

  if (res.state === 'loading')
    return (
      <Card title={`Obligation #${id}`}>
        <Loading rows={5} />
      </Card>
    );

  if (res.state === 'error')
    return (
      <Card title={`Obligation #${id}`}>
        <ErrorMsg onRetry={res.reload}>
          {res.error.status === 404 ? `No obligation #${id} in the registry.` : res.error.message}
        </ErrorMsg>
      </Card>
    );

  if (res.state !== 'ok') return null;
  const o = res.data;

  const paidPct = o.periodsTotal === 0 ? 0 : o.periodsSatisfied / o.periodsTotal;
  const repaid = big(o.principal) - big(o.outstanding);
  const cureBlocks = big(o.cureEndHeight) - big(o.windowEndHeight);
  const liveBonds = o.bonds.filter((b) => !b.released);
  const coverage = big(o.coverage);

  return (
    <div className="stack">
      <Card
        title={
          <span className="row">
            Obligation <span className="mono">#{o.id}</span> <StatusPill status={o.status} />
          </span>
        }
        actions={<span className="eyebrow">source chainKey {o.chainKey}</span>}
      >
        <Lifecycle status={o.status} />
      </Card>

      <div className="metrics">
        <Metric
          label="Outstanding"
          value={units(o.outstanding)}
          sub={`of ${units(o.principal)} principal`}
        />
        <Metric
          label="Repaid"
          value={units(repaid.toString())}
          sub={`${o.periodsSatisfied} of ${o.periodsTotal} periods proven`}
          tone={paidPct === 1 ? 'good' : undefined}
        />
        <Metric
          label="First-loss coverage"
          value={units(o.coverage)}
          sub={`${liveBonds.length} live bond${liveBonds.length === 1 ? '' : 's'}`}
          tone={coverage > 0n ? 'good' : 'warn'}
        />
        <Metric label="Period amount" value={units(o.periodAmount)} sub="minimum qualifying payment" />
      </div>

      <div className="grid-2">
        <Card
          title="Schedule"
          note="Deadlines are denominated in attested source-chain block height, not wall time. No timestamp exists in anything an ASC proof binds, so height is the only clock the contract can actually verify — and it makes stall protection structural: a frozen attested head expires nothing."
        >
          <div className="card-body stack" style={{ gap: 14 }}>
            <div>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="eyebrow">Periods proven</span>
                <span className="num">
                  {o.periodsSatisfied}/{o.periodsTotal}
                </span>
              </div>
              <Meter
                value={o.periodsSatisfied}
                max={o.periodsTotal}
                tone={o.status === 'Default' ? 'bad' : o.status === 'Delinquent' ? 'warn' : 'good'}
              />
            </div>

            <hr className="rule" />

            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Window closes at height</span>
              <span className="num">{o.windowEndHeight}</span>
            </div>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Cure expires at height</span>
              <span className="num">{o.cureEndHeight}</span>
            </div>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Cure window</span>
              <span className="num" style={{ color: 'var(--text-faint)' }}>
                {cureBlocks.toString()} blocks · ~{blocksToDuration(cureBlocks)} est.
              </span>
            </div>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Last proven payment</span>
              <span className="num">
                {big(o.lastProvenHeight) === 0n ? '— none' : o.lastProvenHeight}
              </span>
            </div>
          </div>
        </Card>

        <Card title="Source-chain binding">
          <div className="card-body stack" style={{ gap: 12 }}>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Token</span>
              <Addr value={o.sourceToken} />
            </div>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Payer</span>
              <Addr value={o.sourcePayer} />
            </div>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Payee</span>
              <Addr value={o.sourcePayee} />
            </div>
            <hr className="rule" />
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Obligor commitment</span>
              <Addr value={o.obligor} lead={10} tail={6} />
            </div>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Registrar</span>
              <span className="row">
                <Addr value={o.registrar} />
                <Pill tone={o.bonded ? 'good' : 'warn'}>{o.bonded ? 'bonded' : 'unbonded'}</Pill>
              </span>
            </div>
            <div className="spread">
              <span style={{ color: 'var(--text-dim)' }}>Collateral</span>
              <Addr value={o.collateralRef} lead={10} tail={6} />
            </div>
          </div>
        </Card>
      </div>

      {o.status === 'Delinquent' && (
        <Card title="This delinquency is still curable">
          <div className="card-body" style={{ color: 'var(--text-dim)' }}>
            <p style={{ marginTop: 0 }}>
              A delinquency means no admissible proof of payment reached the registry before the window
              closed. It does <strong>not</strong> assert that no payment happened — that cannot be proven
              with an inclusion proof, and Covenant does not claim to.
            </p>
            <p style={{ marginBottom: 0 }}>
              If a qualifying payment was made on the source chain at a height inside the missed window,
              proving it now restores <strong>Current</strong> — however late the proof arrives — until the
              attested head passes <span className="mono">{o.cureEndHeight}</span>. Submission is
              permissionless and costs a fraction of a cent.
            </p>
          </div>
        </Card>
      )}

      <Card title="Underwriting" actions={<span className="eyebrow">Named first-loss capital</span>}>
        {o.bonds.length === 0 ? (
          <div className="msg">
            No bonds posted. This obligation carries no first-loss protection — a creditor here is fully
            exposed.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Bond</th>
                  <th>Underwriter</th>
                  <th className="right">Posted</th>
                  <th className="right">Slashed</th>
                  <th className="right">Spread</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {o.bonds.map((b) => (
                  <tr key={b.bondId}>
                    <td className="mono">#{b.bondId}</td>
                    <td>
                      <a className="mono" href={`#/underwriter/${b.underwriter}`}>
                        {b.underwriter.slice(0, 6)}…{b.underwriter.slice(-4)}
                      </a>
                    </td>
                    <td className="right num">{units(b.amount)}</td>
                    <td className="right num" style={{ color: big(b.slashed) > 0n ? 'var(--bad)' : undefined }}>
                      {units(b.slashed)}
                    </td>
                    <td className="right num">{bps(b.spreadBps)}</td>
                    <td>
                      <Pill tone={b.released ? 'done' : big(b.slashed) > 0n ? 'bad' : 'good'}>
                        {b.released ? 'released' : big(b.slashed) > 0n ? 'slashed' : 'live'}
                      </Pill>
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
