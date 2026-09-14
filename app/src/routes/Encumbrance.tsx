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
import { selectedReleaseId } from '../lib/releases';

function Result({ asset }: { asset: string }) {
  const res = useLens((s) => lens.encumbrance(asset, s), [asset]);

  if (res.state === 'loading') return <Loading rows={3} />;
  if (res.state === 'error')
    return <Failed what="the encumbrance record" detail={res.error.message} onRetry={res.reload} />;
  if (res.state !== 'ok') return null;

  const e = res.data;

  const witnessed = e.witnessedLiens ?? [];

  if (!e.encumbered) {
    return (
      <Empty title="No recorded encumbrance for this reference">
        No live obligation or USC-witnessed external collateral event currently matches it. That is
        an absence of records, not proof of clean title — coverage remains incomplete.
      </Empty>
    );
  }

  return (
    <>
    {witnessed.length > 0 && (
      <Section
        title={`USC-witnessed external collateral — ${witnessed.length} event${witnessed.length === 1 ? '' : 's'}`}
        aside="Each row comes from a successful Ethereum transaction proven on CC3. It is evidence of the venue event, not a complete legal-title opinion."
      >
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Venue</th><th>Holder</th><th className="num">Ethereum height</th><th>Evidence</th></tr></thead>
            <tbody>{witnessed.map((l) => (
              <tr key={`${l.cc3Transaction}:${l.venueId}`}>
                <td><Addr value={l.emitter} /></td>
                <td><span className="mono">{l.holder}</span></td>
                <td className="num">{Number(l.height).toLocaleString()}</td>
                <td><a href={`https://creditcoin-testnet.blockscout.com/tx/${l.cc3Transaction}`} target="_blank" rel="noreferrer">CC3 witness ↗</a></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Section>
    )}
    {e.claims.length > 0 && (
      <Section
      title={`Registered claims — ${e.claims.length} live claim${e.claims.length === 1 ? '' : 's'}`}
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
    )}
    </>
  );
}

function VenueStatus() {
  const current = selectedReleaseId() === 'v2';
  const res = useLens((s) => lens.encumbranceVenues(s), [], current);
  if (!current || res.state !== 'ok' || res.data.venues.length === 0) return null;

  return (
    <Section title="External evidence venues" aside="Venue schemas are governed and delayed for 48 hours before activation so emitter or topic mistakes are visible before they affect the record.">
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Venue</th><th>Event</th><th>State</th><th>Activates</th></tr></thead>
          <tbody>{res.data.venues.map((v) => (
            <tr key={v.venueId}>
              <td>Aave V3 Ethereum</td>
              <td><span className="mono" title={v.topic0}>ReserveUsedAsCollateralEnabled</span></td>
              <td><span className="record-flag" data-kind={v.status === 'active' ? 'authorized' : undefined}>{v.status}</span></td>
              <td>{v.eta ? new Date(Number(v.eta) * 1000).toLocaleString() : 'Active now'}</td>
            </tr>
          ))}</tbody>
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
    selectedReleaseId() === 'v2'
      ? '0xd0ee30c2dbc93ad826004a05279b63f16891b009472dc8072a684d0a28c19be6'
      : '0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f';

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
          <span>{selectedReleaseId() === 'v2' ? 'Open the Aave V3 USDC collateral reference.' : 'Open a warehouse receipt with a live registered claim.'}</span>
          <button type="button" className="query-example-btn" onClick={loadExample}>
            Open evidence →
          </button>
        </div>
      </div>

      <div className="page">
        <VenueStatus />
        {asset ? (
          <Result asset={asset} />
        ) : (
          <Section title="What the result will show">
            <p className="note" style={{ marginTop: 0 }}>
              The result separates live obligations from external collateral events proven through
              USC, with their source venue, indexed holder and Ethereum height.
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
