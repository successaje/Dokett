import { useState } from 'react';
import { lens, useLens } from '../lib/lens';
import { big, bps, isAddress, units } from '../lib/format';
import { Empty, Failed, Figure, Figures, Loading, Section } from '../components/primitives';

function Book({ address }: { address: string }) {
  const res = useLens((s) => lens.underwriter(address, s), [address]);

  if (res.state === 'loading') return <Loading rows={5} />;
  if (res.state === 'error')
    return <Failed what="the underwriter book" detail={res.error.message} onRetry={res.reload} />;
  if (res.state !== 'ok') return null;

  const u = res.data;

  if (u.bondsWritten === 0) {
    return (
      <Empty title="No bonds written by this address">
        Nothing has been staked against a named obligor here.
      </Empty>
    );
  }

  const live = u.bonds.filter((b) => !b.released && big(b.slashed) === 0n).length;

  return (
    <>
      <Figures>
        <Figure label="Bonds written" value={u.bondsWritten} sub={`${live} live`} />
        <Figure label="Total posted" value={units(u.totalPosted)} sub="first-loss capital staked" />
        <Figure
          label="Total slashed"
          value={units(u.totalSlashed)}
          sub="paid to creditors on proven default"
        />
        <Figure
          label="Loss rate"
          value={bps(u.lossRateBps)}
          sub="slashed ÷ posted"
          title="Derived from bond events, never stored. There is no score here to lobby."
        />
      </Figures>

      <Section
        title="Positions"
        aside={
          <>
            Every figure above is derived from bond events rather than stored. Reputation as a view
            over history — not a mutable score — is the difference between this and every on-chain
            credit score that came before.
          </>
        }
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Bond</th>
                <th>Obligation</th>
                <th className="num">Posted</th>
                <th className="num">Slashed</th>
                <th className="num">Spread</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {u.bonds.map((b) => {
                const slashed = big(b.slashed) > 0n;
                return (
                  <tr key={b.bondId}>
                    <td className="mono">{b.bondId}</td>
                    <td>
                      <a className="mono" href={`#/obligation/${b.obligationId}`}>
                        {b.obligationId}
                      </a>
                    </td>
                    <td className="num">{units(b.amount)}</td>
                    <td className="num" style={{ color: slashed ? 'var(--st-default)' : undefined }}>
                      {units(b.slashed)}
                    </td>
                    <td className="num">{bps(b.spreadBps)}</td>
                    <td>
                      <span
                        className="status"
                        data-s={b.released ? 'Settled' : slashed ? 'Default' : 'Current'}
                      >
                        {b.released ? 'released' : slashed ? 'slashed' : 'live'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

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
  const active = address ?? null;

  const trimmed = input.trim();
  const valid = isAddress(trimmed);

  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">Named first-loss capital</div>
        <h1 className="page-title">Underwriters</h1>
        <p className="page-lede">
          Who stakes capital against named borrowers, and how have they done? Bonds are slashed by
          proof, so a track record here was paid for.
        </p>

        <form
          className="search"
          style={{ marginTop: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) window.location.hash = `#/underwriter/${trimmed}`;
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Underwriter address (0x…40)"
            aria-label="Underwriter address"
            spellCheck={false}
          />
          <button type="submit" disabled={!valid}>
            Look up
          </button>
        </form>

        {trimmed && !valid && (
          <p className="note" style={{ marginTop: 8, color: 'var(--st-delinquent)' }}>
            Not a 20-byte address.
          </p>
        )}
      </div>

      <div className="page">
        {active ? (
          <Book address={active} />
        ) : (
          <Section title="Why named, not pooled">
            <p className="note" style={{ marginTop: 0 }}>
              A bond backs one obligation against one obligor. Pooling is what let correlated risk
              hide inside a single APY, and it is why the delegate model died.
            </p>
            <p className="note">
              Staking against a name puts the credit decision where the information actually is —
              the loan officer, the employer, the co-op, the merchant acquirer — rather than with
              whoever happens to hold the deposits. The price of underwriting someone becomes their
              cost of credit: a live market number instead of a model's guess.
            </p>
          </Section>
        )}
      </div>
    </>
  );
}
