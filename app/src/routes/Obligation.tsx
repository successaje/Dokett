import { lens, useLens } from '../lib/lens';
import { big, blocksToDuration, bps, units } from '../lib/format';
import {
  Addr,
  DL,
  Docket,
  Empty,
  Failed,
  Figure,
  Figures,
  HeightRuler,
  LifecycleRail,
  Loading,
  Row,
  Section,
  StatusPill,
  UnbondedFlag,
  type DocketEntry,
} from '../components/primitives';
import type { ObligationDetail } from '../lib/types';
import CureFlow from '../components/CureFlow';

/**
 * The obligation dossier.
 *
 * Laid out as a document rather than a dashboard, because the reader's question
 * is "what is this claim, and what backs each step of it".
 *
 * Two things this screen refuses to fudge:
 *
 *   1. Deadlines are shown in ATTESTED SOURCE-CHAIN HEIGHT, with any wall-clock
 *      figure explicitly marked an estimate. The protocol's clock is Ethereum's
 *      block height; a confident date would be precision the contract does not
 *      have and cannot enforce.
 *
 *   2. A delinquent obligation always shows the cure path, because a delinquency
 *      is reversible right up until the cure height passes — and the borrower is
 *      the person most likely to be reading this page.
 */

/** The lifecycle as a record of what evidence moved each step. */
function buildDocket(o: ObligationDetail): DocketEntry[] {
  const entries: DocketEntry[] = [
    {
      title: 'Registered',
      body: (
        <>
          Registered by <Addr value={o.registrar} /> against obligor commitment{' '}
          <Addr value={o.obligor} lead={10} tail={6} />.{' '}
          {o.bonded
            ? 'A registrar bond was posted, so the claim carries weight in the Lens.'
            : 'No registrar bond was posted, so this claim carries no weight and is never summed with bonded claims.'}
        </>
      ),
    },
  ];

  if (o.periodsSatisfied > 0) {
    entries.push({
      title: `${o.periodsSatisfied} of ${o.periodsTotal} periods proven`,
      height: o.lastProvenHeight,
      emphasis: true,
      body: (
        <>
          Each advance required an ASC proof that a qualifying transfer of at least{' '}
          {units(o.periodAmount)} was included on the source chain at a height inside the open
          window. Admissibility keys off the proven height, never the submission time.
        </>
      ),
    });
  }

  if (o.status === 'Delinquent' || o.status === 'Default') {
    entries.push({
      title: 'Window closed unproven',
      height: o.windowEndHeight,
      emphasis: true,
      body: (
        <>
          No admissible proof of payment reached the registry before the attested head passed the
          window. This records an absence of evidence — it does not assert that no payment occurred.
        </>
      ),
    });
  }

  if (o.status === 'Default') {
    // The bond outcome must be read from actual state, not asserted. An
    // obligation can default with zero bonds posted — nothing to slash, the
    // creditor was simply unprotected — and claiming a slash that did not
    // happen is exactly the kind of overclaim this registry exists to refuse.
    const live = o.bonds.filter((b) => !b.released);
    const totalSlashed = live.reduce((sum, b) => sum + big(b.slashed), 0n);

    entries.push({
      title: 'Cure expired — default finalised',
      height: o.cureEndHeight,
      emphasis: true,
      body:
        totalSlashed > 0n ? (
          <>
            First-loss capital was slashed to the creditor in the same transaction:{' '}
            {units(totalSlashed.toString())} across {live.length} bond{live.length === 1 ? '' : 's'}.
          </>
        ) : (
          <>
            No first-loss capital was posted against this obligation, so nothing was slashed. The
            creditor carried the loss directly.
          </>
        ),
    });
  }

  if (o.status === 'Settled') {
    entries.push({
      title: 'Settled',
      height: o.lastProvenHeight,
      emphasis: true,
      body: <>Schedule satisfied in full. Underwriters may reclaim principal and premium.</>,
    });
  }

  return entries;
}

export default function Obligation({ id }: { id: string }) {
  const res = useLens((s) => lens.obligation(id, s), [id]);

  if (res.state === 'loading')
    return (
      <div className="page page-head">
        <Loading rows={6} />
      </div>
    );

  if (res.state === 'error')
    return (
      <div className="page page-head">
        {res.error.status === 404 ? (
          <Empty title={`No obligation ${id} in the register`}>
            <a href="#/">Back to the register</a>
          </Empty>
        ) : (
          <Failed what={`obligation ${id}`} detail={res.error.message} onRetry={res.reload} />
        )}
      </div>
    );

  if (res.state !== 'ok') return null;
  const o = res.data;

  const repaid = big(o.principal) - big(o.outstanding);
  const cureBlocks = big(o.cureEndHeight) - big(o.windowEndHeight);
  const liveBonds = o.bonds.filter((b) => !b.released);

  const windowEnd = big(o.windowEndHeight);
  const cureEnd = big(o.cureEndHeight);
  const lastProven = big(o.lastProvenHeight);

  /*
   * The Lens projects Creditcoin events and never observes the source chain, so
   * it has no attested head to report. Rather than invent one, derive only what
   * the status logically guarantees:
   *
   *   Delinquent → the head passed windowEnd, or the mark could not have happened
   *   Default    → the head passed cureEnd, or the default could not have been finalised
   *   otherwise  → unknown, and shown as unknown
   *
   * These are lower bounds, labelled as such. A precise-looking marker on the one
   * screen whose entire subject is precision would be the worst possible lie.
   */
  const head =
    o.status === 'Default' ? cureEnd : o.status === 'Delinquent' ? windowEnd : undefined;

  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">Obligation</div>
        <div className="row wrap" style={{ gap: 14, alignItems: 'baseline' }}>
          <h1 className="page-title mono">{o.id}</h1>
          <StatusPill status={o.status} />
          {!o.bonded && <UnbondedFlag />}
        </div>
        <p className="page-lede">
          Source chainKey {o.chainKey} · {o.periodsSatisfied} of {o.periodsTotal} periods proven ·{' '}
          {liveBonds.length} live bond{liveBonds.length === 1 ? '' : 's'}
        </p>
      </div>

      <div className="page">
        <Figures>
          <Figure label="Outstanding" value={units(o.outstanding)} sub={`of ${units(o.principal)} principal`} />
          <Figure label="Repaid" value={units(repaid.toString())} sub="proven on the source chain" />
          <Figure
            label="First-loss coverage"
            value={units(o.coverage)}
            sub={liveBonds.length ? 'staked against this obligor' : 'creditor fully exposed'}
          />
          <Figure label="Period amount" value={units(o.periodAmount)} sub="minimum qualifying payment" />
        </Figures>

        <Section
          title="Lifecycle"
          aside={<>Status moves only on verified evidence or an attested-height comparison.</>}
        >
          <LifecycleRail status={o.status} />
        </Section>

        <Section
          title="Deadlines, in attested block height"
          aside={
            <>
              No timestamp exists in anything an ASC proof binds, so height is the only clock the
              contract can verify. It also makes stall protection structural: a frozen attested head
              expires nothing.
            </>
          }
        >
          <HeightRuler windowEnd={windowEnd} cureEnd={cureEnd} head={head} headIsLowerBound />

          <div style={{ marginTop: 20, maxWidth: 560 }}>
            <DL>
              <Row k="Window closes" v={o.windowEndHeight} />
              <Row k="Cure expires" v={o.cureEndHeight} />
              <Row
                k="Cure window"
                v={`${cureBlocks.toString()} blocks · ~${blocksToDuration(cureBlocks)} est.`}
                title="Estimated from a 12s source-chain block time. The contract enforces blocks, not time."
              />
              <Row k="Last proven payment" v={lastProven === 0n ? '— none' : o.lastProvenHeight} />
            </DL>
          </div>
        </Section>

        {o.status === 'Delinquent' && (
          <Section title="This delinquency is still curable">
            <p className="note" style={{ marginTop: 0 }}>
              A delinquency means no admissible proof of payment reached the registry before the
              window closed. It does <strong>not</strong> assert that no payment happened — that
              cannot be proven with an inclusion proof, and Covenant does not claim to.
            </p>
            <p className="note">
              If a qualifying payment was made on the source chain at a height inside the missed
              window, proving it now restores <strong>Current</strong> — however late the proof
              arrives — until the attested head passes{' '}
              <span className="mono">{o.cureEndHeight}</span>. Submission is permissionless and
              costs a fraction of a cent.
            </p>

            {/* T-04's mitigation, made operable rather than described. */}
            <CureFlow obligation={o} />
          </Section>
        )}

        <Section title="Record of transitions">
          <Docket entries={buildDocket(o)} />
        </Section>

        <Section title="Source-chain binding">
          <div style={{ maxWidth: 620 }}>
            <DL>
              <Row k="Token" v={<Addr value={o.sourceToken} />} />
              <Row k="Payer" v={<Addr value={o.sourcePayer} />} />
              <Row k="Payee" v={<Addr value={o.sourcePayee} />} />
              <Row
                k="Obligor"
                v={<Addr value={o.obligor} lead={10} tail={6} />}
                title="A commitment, not an identity. The chain never learns who this is."
              />
              <Row
                k="Registrar"
                v={
                  <span className="row" style={{ gap: 7 }}>
                    <Addr value={o.registrar} />
                    {!o.bonded && <UnbondedFlag />}
                  </span>
                }
              />
              <Row k="Collateral" v={<Addr value={o.collateralRef} lead={10} tail={6} />} />
            </DL>
          </div>
        </Section>

        <Section title="Underwriting" aside={<>Named first-loss capital, slashed by proof.</>}>
          {o.bonds.length === 0 ? (
            <Empty title="No bonds posted">
              This obligation carries no first-loss protection — a creditor here is fully exposed.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Bond</th>
                    <th>Underwriter</th>
                    <th className="num">Posted</th>
                    <th className="num">Slashed</th>
                    <th className="num">Spread</th>
                    <th>State</th>
                  </tr>
                </thead>
                <tbody>
                  {o.bonds.map((b) => {
                    const slashed = big(b.slashed) > 0n;
                    return (
                      <tr key={b.bondId}>
                        <td className="mono">{b.bondId}</td>
                        <td>
                          <a className="mono" href={`#/underwriter/${b.underwriter}`}>
                            {b.underwriter.slice(0, 6)}…{b.underwriter.slice(-4)}
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
          )}
        </Section>
      </div>
    </>
  );
}
