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

function Result({ asset }: { asset: string }) {
  const res = useLens((s) => lens.encumbrance(asset, s), [asset]);

  if (res.state === 'loading') return <Loading rows={3} />;
  if (res.state === 'error')
    return <Failed what="the encumbrance record" detail={res.error.message} onRetry={res.reload} />;
  if (res.state !== 'ok') return null;

  const e = res.data;

  if (!e.encumbered) {
    return (
      <Empty title="No live claims against this asset">
        No registered obligation currently pledges it. That is an absence of records, not proof of
        clean title — the register only knows what someone chose to record.
      </Empty>
    );
  }

  return (
    <Section
      title={`Encumbered — ${e.claims.length} live claim${e.claims.length === 1 ? '' : 's'}`}
      aside={
        <>
          A claim leaves this view once it settles or is charged off: a discharged obligation no
          longer encumbers the asset. Unbonded claims are flagged inline rather than filtered out —
          an unbonded lien is weak evidence, but it is not nothing.
        </>
      }
    >
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Obligation</th>
              <th>Status</th>
              <th className="num">Outstanding</th>
              <th>Registrar</th>
            </tr>
          </thead>
          <tbody>
            {e.claims.map((c) => (
              <tr key={c.id}>
                <td>
                  <a className="mono" href={`#/obligation/${c.id}`}>
                    {c.id}
                  </a>
                </td>
                <td>
                  <StatusPill status={c.status} />
                </td>
                <td className="num">{units(c.outstanding)}</td>
                <td>
                  <span className="row" style={{ gap: 7 }}>
                    <Addr value={c.registrar} />
                    {!c.bonded && <UnbondedFlag />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/**
 * The wedge query.
 *
 * "Is this collateral already pledged?" is the one question an RWA vault is
 * actively frightened of today. It costs nothing to answer, and answering it is
 * what gets creditors to register in the first place — they file a claim to
 * protect their own priority, not to be helpful. Coverage follows from
 * self-interest, which is the only way a registry has ever bootstrapped.
 */
export default function Encumbrance() {
  const [input, setInput] = useState('');
  const [asset, setAsset] = useState<string | null>(null);

  const trimmed = input.trim();
  const valid = isAddress(trimmed) || isBytes32(trimmed);

  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">The wedge</div>
        <h1 className="page-title">Encumbrance</h1>
        <p className="page-lede">
          Is this collateral already pledged somewhere else? Check before you lend against it.
        </p>

        <form
          className="search"
          style={{ marginTop: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) setAsset(trimmed);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Asset address (0x…40) or collateral reference (0x…64)"
            aria-label="Asset address or collateral reference"
            spellCheck={false}
          />
          <button type="submit" disabled={!valid}>
            Check
          </button>
        </form>

        {trimmed && !valid && (
          <p className="note" style={{ marginTop: 8, color: 'var(--st-delinquent)' }}>
            Not a 20-byte address or 32-byte reference.
          </p>
        )}
      </div>

      <div className="page">
        {asset ? (
          <Result asset={asset} />
        ) : (
          <Section title="Why this query first">
            <p className="note" style={{ marginTop: 0 }}>
              A registry is worth what its coverage is worth, and coverage has to come from
              somewhere. Asking lenders to file claims for the good of the commons does not work.
            </p>
            <p className="note">
              Asking them to file a claim so that nobody else lends against their collateral does.
              The encumbrance check is free, and it makes registering an act of self-interest — the
              only way a registry has ever bootstrapped.
            </p>
          </Section>
        )}
      </div>
    </>
  );
}
