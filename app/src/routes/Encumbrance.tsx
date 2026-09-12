import { useState } from 'react';
import { lens, useLens } from '../lib/lens';
import { isAddress, isBytes32 } from '../lib/format';
import {
  Addr,
  Amt,
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
                <td className="num"><Amt raw={c.outstanding} token={c.sourceToken} /></td>
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
  const query = window.location.hash.split('?')[1];
  const seeded = query ? new URLSearchParams(query).get('q')?.trim() ?? '' : '';
  const seededValid = isAddress(seeded) || isBytes32(seeded);
  const [input, setInput] = useState(seeded);
  const [asset, setAsset] = useState<string | null>(seededValid ? seeded : null);

  const trimmed = input.trim();
  const valid = isAddress(trimmed) || isBytes32(trimmed);

  const exampleAsset =
    '0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f';

  function loadExample() {
    setInput(exampleAsset);
    setAsset(exampleAsset);
    window.history.replaceState(null, '', `#/encumbrance?q=${exampleAsset}`);
  }

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

        <div className="query-example">
          <span>New here? Open a warehouse receipt with a live registered claim.</span>
          <button type="button" className="query-example-btn" onClick={loadExample}>
            Load judge example →
          </button>
        </div>
      </div>

      <div className="page">
        {asset ? (
          <Result asset={asset} />
        ) : (
          <Section title="What the result will show">
            <p className="note" style={{ marginTop: 0 }}>
              The result lists every live obligation that names this asset reference as collateral,
              with its status, outstanding amount and registrar.
            </p>
            <p className="note">
              An empty result means that Dokett has no live claim for the asset. It is not proof of
              clean legal title, because registry coverage is incomplete and permissionless.
            </p>
          </Section>
        )}
      </div>
    </>
  );
}
