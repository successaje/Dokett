import { useState } from 'react';
import { lens, useLens } from '../lib/lens';
import { isAddress, isBytes32, units } from '../lib/format';
import { Addr, Card, ErrorMsg, Loading, Metric, StatusPill } from '../components/primitives';
import type { Bucket } from '../lib/types';

function BucketTable({ bucket, kind }: { bucket: Bucket; kind: 'bonded' | 'unbonded' }) {
  if (bucket.count === 0) {
    return (
      <div className="msg">
        No {kind} claims registered against this entity.
      </div>
    );
  }
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Payer</th>
            <th className="right">Outstanding</th>
            <th className="right">Periods</th>
            <th>Registrar</th>
          </tr>
        </thead>
        <tbody>
          {bucket.obligations.map((o) => (
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
                <Addr value={o.sourcePayer} />
              </td>
              <td className="right num">{units(o.outstanding)}</td>
              <td className="right num">
                {o.periodsSatisfied}/{o.periodsTotal}
              </td>
              <td>
                <Addr value={o.registrar} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The hero query.
 *
 * A lender asks what a counterparty already owes — across venues that have never
 * spoken to each other — BEFORE extending credit. This is the query that does
 * not exist anywhere else in crypto, and the reason every credit blowup of the
 * last cycle was invisible until it broke.
 *
 * The screen deliberately renders bonded and unbonded claims as two separate
 * panels with no combined figure anywhere. Reintroducing a total in the UI would
 * undo the exact property the protocol refuses to give up: registration is
 * permissionless, so anyone can register fictional debts against a competitor,
 * and only the registrar's bond makes a claim mean anything.
 */
export default function Solvency() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');

  const valid = isAddress(input) || isBytes32(input);
  const res = useLens((s) => lens.solvency(query, s), [query], query !== '');

  return (
    <div className="stack">
      <Card
        title="Counterparty solvency"
        note="Bonded and unbonded claims are reported separately and are never summed. Registration is permissionless by design — a registry that gatekeeps registration is a private database — so a registrar's bond is what gives a claim weight."
      >
        <div className="card-body stack" style={{ gap: 12 }}>
          <p style={{ margin: 0, color: 'var(--text-dim)' }}>
            What does this counterparty already owe? Enter a payer address or an obligor commitment.
          </p>
          <form
            className="field"
            onSubmit={(e) => {
              e.preventDefault();
              if (valid) setQuery(input.trim());
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="0x… address or 32-byte commitment"
              spellCheck={false}
              aria-label="Entity address or commitment"
            />
            <button className="btn btn-primary" type="submit" disabled={!valid}>
              Query
            </button>
          </form>
          {input !== '' && !valid && (
            <div style={{ color: 'var(--warn)', fontSize: 12 }}>
              Expecting a 20-byte address or a 32-byte commitment.
            </div>
          )}
        </div>
      </Card>

      {res.state === 'loading' && (
        <Card title="Querying">
          <Loading />
        </Card>
      )}

      {res.state === 'error' && (
        <Card title="Query failed">
          <ErrorMsg onRetry={res.reload}>{res.error.message}</ErrorMsg>
        </Card>
      )}

      {res.state === 'ok' && (
        <>
          <div className="metrics">
            <Metric
              label="Bonded claims"
              value={res.data.bonded.count}
              sub={`${units(res.data.bonded.outstanding)} outstanding`}
            />
            <Metric
              label="Unbonded claims"
              value={res.data.unbonded.count}
              sub={`${units(res.data.unbonded.outstanding)} — unweighted`}
              tone={res.data.unbonded.count > 0 ? 'warn' : 'neutral'}
            />
            <Metric
              label="Adverse history"
              value={res.data.adverse.count}
              sub={res.data.adverse.count > 0 ? 'delinquent, default or charged off' : 'none on record'}
              tone={res.data.adverse.count > 0 ? 'bad' : 'good'}
            />
            <Metric label="As of block" value={res.data.asOfBlock} sub="Creditcoin height" />
          </div>

          <Card
            title="Bonded claims"
            actions={<span className="eyebrow">Registrar posted a bond</span>}
          >
            <BucketTable bucket={res.data.bonded} kind="bonded" />
          </Card>

          <Card
            title="Unbonded claims"
            actions={<span className="eyebrow">Unweighted — treat with suspicion</span>}
            note="These claims carry no registrar bond. Anyone may register an obligation against any address, so an unbonded claim is an assertion, not evidence. They are shown because hiding them would be its own distortion — but they must never be added to the bonded figure."
          >
            <BucketTable bucket={res.data.unbonded} kind="unbonded" />
          </Card>
        </>
      )}
    </div>
  );
}
