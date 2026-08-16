import { useState } from 'react';
import { lens, useLens } from '../lib/lens';
import { isAddress, isBytes32, units } from '../lib/format';
import { Addr, Card, ErrorMsg, Loading, Pill, StatusPill } from '../components/primitives';

/**
 * The wedge query.
 *
 * "Is this collateral already pledged?" is the one question an RWA vault is
 * actively frightened of today, it costs nothing to answer, and answering it is
 * what gets creditors to register in the first place — they file a claim to
 * protect their own priority, not to be helpful. Coverage follows from
 * self-interest, which is the only way a registry has ever bootstrapped.
 */
export default function Encumbrance() {
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const valid = isAddress(input) || isBytes32(input);
  const res = useLens((s) => lens.encumbrance(query, s), [query], query !== '');

  return (
    <div className="stack">
      <Card
        title="Encumbrance check"
        note="A claim is dropped from this view once it settles or is charged off — a discharged obligation no longer encumbers the asset. Unbonded claims are flagged inline rather than filtered out: an unbonded lien is weak evidence, but it is not nothing."
      >
        <div className="card-body stack" style={{ gap: 12 }}>
          <p style={{ margin: 0, color: 'var(--text-dim)' }}>
            Is this collateral already pledged somewhere else? Check before you lend against it.
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
              placeholder="0x… asset address or collateral reference"
              spellCheck={false}
              aria-label="Asset address or collateral reference"
            />
            <button className="btn btn-primary" type="submit" disabled={!valid}>
              Check
            </button>
          </form>
        </div>
      </Card>

      {res.state === 'loading' && (
        <Card title="Checking">
          <Loading rows={2} />
        </Card>
      )}
      {res.state === 'error' && (
        <Card title="Check failed">
          <ErrorMsg onRetry={res.reload}>{res.error.message}</ErrorMsg>
        </Card>
      )}

      {res.state === 'ok' && (
        <Card
          title={
            <span className="row">
              Result
              <Pill tone={res.data.encumbered ? 'bad' : 'good'} dot>
                {res.data.encumbered ? 'Encumbered' : 'No active claims'}
              </Pill>
            </span>
          }
          actions={<span className="eyebrow">as of block {res.data.asOfBlock}</span>}
        >
          {!res.data.encumbered ? (
            <div className="msg">
              No active obligation in this registry references{' '}
              <span className="mono">{res.data.asset.slice(0, 10)}…</span> as collateral.
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-faint)' }}>
                Absence of a claim here is not proof the asset is unencumbered elsewhere. It means nothing
                has been registered — which is exactly why coverage is the metric that matters.
              </div>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Obligation</th>
                    <th>Status</th>
                    <th className="right">Outstanding</th>
                    <th>Registrar</th>
                    <th>Weight</th>
                  </tr>
                </thead>
                <tbody>
                  {res.data.claims.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <a className="mono" href={`#/obligation/${c.id}`}>#{c.id}</a>
                      </td>
                      <td><StatusPill status={c.status} /></td>
                      <td className="right num">{units(c.outstanding)}</td>
                      <td><Addr value={c.registrar} /></td>
                      <td>
                        <Pill tone={c.bonded ? 'good' : 'warn'}>{c.bonded ? 'bonded' : 'unbonded'}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
