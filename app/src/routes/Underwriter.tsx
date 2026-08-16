import { useState } from 'react';
import { lens, useLens } from '../lib/lens';
import { big, bps, isAddress, units } from '../lib/format';
import { Card, ErrorMsg, Loading, Metric, Pill } from '../components/primitives';

/**
 * An underwriter's book.
 *
 * Every figure here is DERIVED from bond events, never stored. Reputation as a
 * view over history rather than a mutable score is the difference between this
 * and every on-chain credit score that came before: there is no number anyone
 * can be lobbied into adjusting, because there is no number — only what happened.
 */
export default function Underwriter({ address }: { address?: string }) {
  const [input, setInput] = useState(address ?? '');
  const [query, setQuery] = useState(address ?? '');
  const valid = isAddress(input);
  const res = useLens((s) => lens.underwriter(query, s), [query], isAddress(query));

  return (
    <div className="stack">
      <Card title="Underwriter book">
        <div className="card-body stack" style={{ gap: 12 }}>
          <p style={{ margin: 0, color: 'var(--text-dim)' }}>
            Who stakes first-loss capital against named borrowers, and how have they done?
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
              placeholder="0x… underwriter address"
              spellCheck={false}
              aria-label="Underwriter address"
            />
            <button className="btn btn-primary" type="submit" disabled={!valid}>
              Look up
            </button>
          </form>
        </div>
      </Card>

      {res.state === 'loading' && (
        <Card title="Loading book"><Loading rows={3} /></Card>
      )}
      {res.state === 'error' && (
        <Card title="Lookup failed">
          <ErrorMsg onRetry={res.reload}>{res.error.message}</ErrorMsg>
        </Card>
      )}

      {res.state === 'ok' && (
        <>
          <div className="metrics">
            <Metric label="Bonds written" value={res.data.bondsWritten} />
            <Metric label="Total posted" value={units(res.data.totalPosted)} sub="capital put at risk" />
            <Metric
              label="Total slashed"
              value={units(res.data.totalSlashed)}
              tone={big(res.data.totalSlashed) > 0n ? 'bad' : 'good'}
              sub="paid out to creditors on proven default"
            />
            <Metric
              label="Loss rate"
              value={bps(res.data.lossRateBps)}
              tone={res.data.lossRateBps > 500 ? 'bad' : res.data.lossRateBps > 0 ? 'warn' : 'good'}
              sub="slashed / posted"
            />
          </div>

          <Card
            title="Positions"
            note="A loss rate is not a verdict. An underwriter writing thin-file credit in a frontier market should carry losses; one showing zero across a large book is either exceptional or not taking real risk. The number is an input to a price, not a score."
          >
            {res.data.bonds.length === 0 ? (
              <div className="msg">No bonds written by this address.</div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Bond</th>
                      <th>Obligation</th>
                      <th className="right">Posted</th>
                      <th className="right">Slashed</th>
                      <th className="right">Spread</th>
                      <th>State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.data.bonds.map((b) => (
                      <tr key={b.bondId}>
                        <td className="mono">#{b.bondId}</td>
                        <td>
                          <a className="mono" href={`#/obligation/${b.obligationId}`}>#{b.obligationId}</a>
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
        </>
      )}
    </div>
  );
}
