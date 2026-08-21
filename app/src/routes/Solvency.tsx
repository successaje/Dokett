import { useState } from 'react';
import { lens, useLens } from '../lib/lens';
import { isAddress, isBytes32, units } from '../lib/format';
import {
  Addr,
  Empty,
  Failed,
  Loading,
  Section,
  StatusPill,
  UnbondedFlag,
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
        {units(bucket.outstanding)}
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
                  <td className="num">{units(o.outstanding)}</td>
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
            Each of these was reached by evidence — a window that closed with no admissible proof, or
            a cure that expired. None was reported by a person.
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

export default function Solvency() {
  const seeded = seededEntity();
  const seededValid = isAddress(seeded) || isBytes32(seeded);
  const [input, setInput] = useState(seeded);
  const [entity, setEntity] = useState<string | null>(seededValid ? seeded : null);

  const trimmed = input.trim();
  const valid = isAddress(trimmed) || isBytes32(trimmed);

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
      </div>

      <div className="page">
        {entity ? (
          <Result entity={entity} />
        ) : (
          <Section title="Why two buckets">
            <p className="note" style={{ marginTop: 0 }}>
              Anyone may register an obligation against any address. That is deliberate — a registry
              that gatekeeps registration is just a private database. The cost is that anyone can
              also register a fiction.
            </p>
            <p className="note">
              So the Lens reports bonded and unbonded claims separately and refuses to add them
              together. Weighting by registrar bond is what makes the number mean anything; a single
              “total owed” would throw that away and hand an adversary a free way to poison a
              competitor's record.
            </p>
          </Section>
        )}
      </div>
    </>
  );
}
