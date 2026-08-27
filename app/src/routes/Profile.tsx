import { lens, useLens } from '../lib/lens';
import { units, truncate } from '../lib/format';
import { Figures, Figure, Section, Loading, Failed, Empty } from '../components/primitives';
import type { Attestation } from '../lib/types';

/**
 * A subject's file.
 *
 * The page is built around one distinction and would be actively harmful
 * without it:
 *
 *   PROVEN   — derived from the register. Recomputable by any stranger with an
 *              RPC endpoint, adjustable by nobody, including us.
 *   ATTESTED — somebody said it. Shown with who said it and what they staked.
 *
 * Rendering those as the same kind of bullet is precisely how a credit file
 * starts lying. Goldfinch's PDFs looked authoritative too. So the two live in
 * separate sections, in different visual registers, and the attested block
 * names its issuer on every single row.
 */

function bondedCtc(a: Attestation): number {
  try {
    return Number(BigInt(a.bondedCtc) / 10n ** 18n);
  } catch {
    return 0;
  }
}

function AttestationRow({ a }: { a: Attestation }) {
  const staked = bondedCtc(a);
  const isSelf = a.issuer === 'self';

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{a.claim}</div>
        <div style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 2 }}>
          {a.kind} · checked by {a.method}
        </div>
      </td>
      <td>{isSelf ? <span style={{ color: 'var(--ink-3)' }}>self-attested</span> : a.issuerName}</td>
      <td className="num">
        {staked > 0 ? (
          <span title="CTC the issuer staked against being wrong.">{staked.toLocaleString()} CTC</span>
        ) : (
          /*
           * An unbonded attestation is a bare assertion — the issuer loses
           * nothing by being wrong. It must never look like the bonded kind, so
           * it is labelled rather than left blank.
           */
          <span className="flag-unbonded" title="The issuer staked nothing against this claim.">
            unbonded
          </span>
        )}
      </td>
      <td className="num" style={{ color: 'var(--ink-3)' }}>
        {a.at}
      </td>
    </tr>
  );
}

export default function Profile({ subject }: { subject: string }) {
  const res = useLens((s) => lens.profile(subject, s), [subject]);

  if (res.state === 'loading')
    return (
      <div className="page page-head">
        <Loading rows={6} />
      </div>
    );

  if (res.state === 'error')
    return (
      <div className="page page-head">
        <Failed what="this profile" detail={res.error.message} onRetry={res.reload} />
      </div>
    );

  if (res.state !== 'ok') return null;

  const { identity, proven, attested, unbondedClaims, notIndexed } = res.data;
  const onTime =
    proven.paymentsScheduled > 0
      ? Math.round((proven.paymentsProven / proven.paymentsScheduled) * 100)
      : null;

  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">
          {identity ? `${identity.kind} · ${identity.jurisdiction}` : 'undisclosed subject'}
        </div>

        <h1 className="page-title">
          {identity ? identity.displayName : truncate(subject, 10, 8)}
        </h1>

        {identity?.latinName ? (
          <div style={{ color: 'var(--ink-3)', fontSize: 15, marginTop: 2 }}>{identity.latinName}</div>
        ) : null}

        <p className="page-lede">
          {identity ? (
            <>
              {identity.sector}. Name disclosed by the subject and held off-chain — the register
              itself stores only a commitment and cannot reverse it.
            </>
          ) : (
            <>
              This subject has not disclosed an identity. The record below stands on its own; a name
              would add nothing to what the register proves.
            </>
          )}
        </p>

        <div className="mono" style={{ fontSize: 11.5, color: 'var(--ink-4)', marginTop: 8 }}>
          {subject}
        </div>
      </div>

      {/* Everything below shares the page grid — without this wrapper the
          figures and sections render full-bleed, ignoring the max-width and
          side padding every other route gets from `.page`. */}
      <div className="page">
        {/* ── PROVEN ───────────────────────────────────────────────────── */}
        <Figures>
        <Figure
          label="Obligations"
          value={proven.obligationsRegistered}
          sub={`${proven.openNow} open`}
          title="Bonded registrations only. Unbonded claims are excluded — anyone can register one."
        />
        <Figure
          label="Payments proven"
          value={`${proven.paymentsProven}/${proven.paymentsScheduled}`}
          sub={onTime === null ? 'no schedule yet' : `${onTime}% of schedule`}
          title="Each one verified by an ASC proof of a real source-chain transfer."
        />
        <Figure
          label="Defaults"
          value={proven.defaults}
          sub={proven.delinquentNow > 0 ? `${proven.delinquentNow} delinquent now` : 'none open'}
        />
        <Figure
          label="Outstanding"
          value={units(proven.outstanding)}
          sub={`${units(proven.lifetimePrincipal)} lifetime`}
        />
      </Figures>

      <Section
        title="Proven"
        aside="Derived from the register. Recomputable by anyone with an RPC endpoint, and adjustable by nobody — including the operator of this Console."
      >
        <dl className="dl">
          <dt>First recorded</dt>
          <dd>{proven.firstSeenHeight ? `height ${proven.firstSeenHeight}` : '—'}</dd>
          <dt>Obligations registered</dt>
          <dd>{proven.obligationsRegistered}</dd>
          <dt>Payments proven on-chain</dt>
          <dd>
            {proven.paymentsProven} of {proven.paymentsScheduled} scheduled
          </dd>
          <dt>Defaults</dt>
          <dd>{proven.defaults}</dd>
          <dt>Lifetime principal</dt>
          <dd>{units(proven.lifetimePrincipal)}</dd>
        </dl>

        {unbondedClaims > 0 ? (
          <p className="note" style={{ marginTop: 16 }}>
            <strong>{unbondedClaims} unbonded claim{unbondedClaims === 1 ? '' : 's'}</strong>{' '}
            {unbondedClaims === 1 ? 'is' : 'are'} registered against this subject and excluded from
            every figure above. Registration is permissionless, so anyone may assert a debt against
            anyone; only claims carrying a registrar bond count toward a record.{' '}
            <a href={`#/solvency?q=${subject}`}>See them in solvency →</a>
          </p>
        ) : null}
      </Section>

      {/* ── ATTESTED ───────────────────────────────────────────────────── */}
      <Section
        title="Attested"
        aside="Statements by named issuers. Not proof — each row shows who said it and what they staked against being wrong."
      >
        {attested.length === 0 ? (
          <Empty title="Nothing attested">
            No issuer has vouched for this subject. That is not a negative signal; the proven record
            above is independent of it.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Claim</th>
                  <th>Issuer</th>
                  <th className="num">Staked</th>
                  <th className="num">Issued</th>
                </tr>
              </thead>
              <tbody>
                {attested.map((a, i) => (
                  <AttestationRow a={a} key={i} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="note" style={{ marginTop: 14 }}>
          Bonded issuance is not yet enforced on-chain, so the staked column is currently a claim
          about a stake rather than a slashable one. It is shown because an attestation without an
          accountable issuer is decoration, and hiding the distinction would be the more misleading
          choice.
        </p>
      </Section>

      {/* ── WHAT WE DO NOT KNOW ────────────────────────────────────────── */}
      {notIndexed.length > 0 ? (
        <Section
          title="Not indexed"
          aside="Facts a credit file would normally carry that this projection cannot yet derive."
        >
          <ul className="note" style={{ paddingLeft: 18, margin: 0 }}>
            {notIndexed.map((n) => (
              <li key={n} style={{ marginBottom: 4 }}>
                {n}
              </li>
            ))}
          </ul>
          <p className="note" style={{ marginTop: 12 }}>
            Listed rather than omitted. Reporting <span className="mono">curedLate: 0</span> would be
            indistinguishable from a clean record, and a file that only shows flattering facts is not
            a record.
          </p>
        </Section>
        ) : null}
      </div>
    </>
  );
}
