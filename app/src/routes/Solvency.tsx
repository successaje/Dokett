import { useState } from 'react';
import { lens, useLens } from '../lib/lens';
import { isAddress, isBytes32, units, compact, big, tokenSymbol, tokenDecimals } from '../lib/format';
import {
  Addr,
  Empty,
  Failed,
  Loading,
  Section,
  StatusPill,
  UnbondedFlag,
  Amt,
} from '../components/primitives';
import type { Bucket } from '../lib/types';

function BucketColumn({
  bucket,
  kind,
  caption,
}: {
  bucket: Bucket;
  kind: 'bonded' | 'unbonded';
  caption: string;
}) {
  /*
   * Per denomination, derived from the bucket's own obligations rather than
   * from bucket.outstanding.
   *
   * The Lens sums outstanding across a subject's claims, which is a single
   * correct number only while they are all in one asset — and it arrives with
   * no indication of which. Rendered at a fixed 6 decimals it read 16 troy
   * ounces of gold as 16,000,000,000,000. Grouping here also means a subject
   * who later holds both USDC and PAXG is shown two figures instead of one
   * meaningless total.
   */
  const byDenom = (bucket.obligations ?? []).reduce<
    Record<string, { total: bigint; decimals: number }>
  >((acc, o) => {
    const sym = tokenSymbol(o.sourceToken) ?? 'other';
    const prev = acc[sym] ?? { total: 0n, decimals: tokenDecimals(o.sourceToken) };
    acc[sym] = { total: prev.total + big(o.outstanding), decimals: prev.decimals };
    return acc;
  }, {});
  const denoms = Object.entries(byDenom).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <div className="row between" style={{ alignItems: 'baseline', marginBottom: 4 }}>
        <span className="eyebrow">{kind}</span>
        <span className="eyebrow">
          {bucket.count} claim{bucket.count === 1 ? '' : 's'}
        </span>
      </div>

      <div
        className="mono"
        style={{
          fontSize: 26,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {denoms.length === 0 ? (
          units('0')
        ) : (
          denoms.map(([sym, { total, decimals }]) => (
            <span key={sym} className="denom" style={{ display: 'block' }} title={`${units(total.toString(), decimals)} ${sym}`}>
              {compact(total.toString(), decimals)}
              <span className="denom-sym">{sym}</span>
            </span>
          ))
        )}
      </div>
      <p className="note" style={{ marginTop: 6 }}>
        {caption}
      </p>

      {bucket.count === 0 ? (
        <p className="note" style={{ marginTop: 14, color: 'var(--ink-4)' }}>
          No {kind} claims registered against this entity.
        </p>
      ) : (
        <div className="table-wrap" style={{ marginTop: 14 }}>
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th className="num">Outstanding</th>
                <th>Registrar</th>
              </tr>
            </thead>
            <tbody>
              {bucket.obligations.map((o) => (
                <tr key={o.id}>
                  <td>
                    <a className="mono" href={`#/obligation/${o.id}`}>
                      {o.id}
                    </a>
                  </td>
                  <td>
                    <StatusPill status={o.status} />
                  </td>
                  <td className="num"><Amt raw={o.outstanding} token={o.sourceToken} /></td>
                  <td>
                    <span className="row" style={{ gap: 7 }}>
                      <Addr value={o.registrar} lead={6} tail={4} />
                      {kind === 'unbonded' && <UnbondedFlag />}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Result({ entity }: { entity: string }) {
  const res = useLens((s) => lens.solvency(entity, s), [entity]);

  if (res.state === 'loading') return <Loading rows={6} />;
  if (res.state === 'error')
    return <Failed what="solvency" detail={res.error.message} onRetry={res.reload} />;
  if (res.state !== 'ok') return null;

  const s = res.data;

  if (s.bonded.count === 0 && s.unbonded.count === 0) {
    return (
      <Empty title="No claims registered against this entity">
        That is not the same as “this entity owes nothing”. Coverage is partial by construction — the
        register only knows what someone chose to record.
      </Empty>
    );
  }

  return (
    <>
      <Section
        title="Registered claims"
        aside={
          <>
            Reported in two buckets and never summed. Registration is permissionless, so anyone can
            record a claim against anyone — a combined total would make defamation-by-registration
            free. There is deliberately no figure for “total owed”.
          </>
        }
      >
        <div className="split">
          <BucketColumn
            bucket={s.bonded}
            kind="bonded"
            caption="Registrar posted a bond. Spam here has a price, so these claims carry weight."
          />
          <div className="split-rule" aria-hidden />
          <BucketColumn
            bucket={s.unbonded}
            kind="unbonded"
            caption="No bond posted. Free to register, therefore free to fabricate. Read with suspicion."
          />
        </div>
      </Section>

      {s.adverse.count > 0 && (
        <Section title="Adverse history">
          <div className="row wrap" style={{ gap: 14 }}>
            {s.adverse.statuses.map((a) => (
              <a
                key={a.id}
                href={`#/obligation/${a.id}`}
                className="row"
                style={{ gap: 8, textDecoration: 'none' }}
              >
                <span className="mono" style={{ fontSize: 12.5 }}>
                  {a.id}
                </span>
                <StatusPill status={a.status} />
              </a>
            ))}
          </div>
          <p className="note" style={{ marginTop: 14 }}>
            Each follows the protocol rules — a window closed with no admissible proof, or a cure
            expired. A caller triggered evaluation but could not choose the result.
          </p>
        </Section>
      )}
    </>
  );
}

/**
 * The hero query.
 *
 * A lender asks what a counterparty already owes, across venues that have never
 * spoken to each other, BEFORE extending credit. This is the query that does not
 * exist anywhere else in crypto, and the reason every credit blowup of the last
 * cycle stayed invisible until it broke.
 *
 * The screen renders bonded and unbonded claims as two columns with a literal
 * gutter and no combined figure anywhere. Reintroducing a total in the UI would
 * undo the exact property the protocol refuses to give up.
 */
/** Reads `?q=` off the hash query string — used only to arrive pre-searched from a deep link. */
function seededEntity(): string {
  const q = window.location.hash.split('?')[1];
  if (!q) return '';
  return new URLSearchParams(q).get('q')?.trim() ?? '';
}

const EXAMPLE_ENTITY =
  '0x986a7f70b1677d3c4ea6c16116f2b47b53eebc59ae822d4ed18030c008aa928a';

export default function Solvency() {
  const seeded = seededEntity();
  const seededValid = isAddress(seeded) || isBytes32(seeded);
  const [input, setInput] = useState(seeded);
  const [entity, setEntity] = useState<string | null>(seededValid ? seeded : null);

  const trimmed = input.trim();
  const valid = isAddress(trimmed) || isBytes32(trimmed);

  function loadExample() {
    setInput(EXAMPLE_ENTITY);
    setEntity(EXAMPLE_ENTITY);
    window.history.replaceState(null, '', `#/solvency?q=${EXAMPLE_ENTITY}`);
  }

  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">The query that does not exist</div>
        <h1 className="page-title">Solvency</h1>
        <p className="page-lede">
          What does this counterparty already owe? Ask before you lend — across venues that have
          never spoken to each other.
        </p>

        <form
          className="search"
          style={{ marginTop: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) setEntity(trimmed);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Address (0x…40) or obligor commitment (0x…64)"
            aria-label="Entity address or obligor commitment"
            spellCheck={false}
          />
          <button type="submit" disabled={!valid}>
            Search
          </button>
        </form>

        {trimmed && !valid && (
          <p className="note" style={{ marginTop: 8, color: 'var(--st-delinquent)' }}>
            Not a 20-byte address or 32-byte commitment.
          </p>
        )}

        <div className="query-example">
          <span>New here? Open a borrower with bonded claims and adverse history.</span>
          <button type="button" className="query-example-btn" onClick={loadExample}>
            Load judge example →
          </button>
        </div>
      </div>

      <div className="page">
        {entity ? (
          <Result entity={entity} />
        ) : (
          <Section title="What the result will show">
            <p className="note" style={{ marginTop: 0 }}>
              The result separates bonded claims from unbonded claims and shows adverse history.
              Bonding makes a registrar's assertion costly, but it does not prove that the original
              debt was validly agreed.
            </p>
            <p className="note">
              Registration is permissionless, so Dokett never combines both buckets into a single
              “total owed” that a bad actor could poison for free.
            </p>
          </Section>
        )}
      </div>
    </>
  );
}
