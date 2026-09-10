import { lens, useLens } from '../lib/lens';
import { big, height, units, compact, truncate, tokenDecimals, tokenSymbol } from '../lib/format';
import {
  Addr,
  Empty,
  Failed,
  Figure,
  Figures,
  Loading,
  Section,
  StatusPill,
  UnbondedFlag,
} from '../components/primitives';
import type { Obligation } from '../lib/types';

const ADVERSE = new Set(['Delinquent', 'Default', 'ChargedOff']);
const TERMINAL = new Set(['Settled', 'ChargedOff']);

function Head() {
  return (
    <div className="page page-head">
      <div className="eyebrow">The record</div>
      <h1 className="page-title">Register of obligations</h1>
      <p className="page-lede">
        Every promise to pay recorded on this chain, and the evidence that moved it. Registration is
        permissionless; weight comes from the registrar's bond.
      </p>
    </div>
  );
}

export default function Registry() {
  const res = useLens((s) => lens.obligations(s), []);

  if (res.state === 'loading')
    return (
      <>
        <Head />
        <div className="page">
          <Loading rows={6} />
        </div>
      </>
    );

  if (res.state === 'error')
    return (
      <>
        <Head />
        <div className="page">
          <Failed what="the register" detail={res.error.message} onRetry={res.reload} />
        </div>
      </>
    );

  if (res.state !== 'ok') return null;

  const all: Obligation[] = res.data.obligations;
  const live = all.filter((o) => !TERMINAL.has(o.status));
  const adverse = all.filter((o) => ADVERSE.has(o.status));

  /*
   * Bonded only, terminal states excluded, and — the part that matters —
   * grouped BY DENOMINATION rather than summed into one figure.
   *
   * This used to be a single reduce over raw integers. That was correct while
   * every obligation was USDC, and silently wrong the moment the register
   * carried real RWA collateral: it added 18-decimal PAXG to 6-decimal USDC,
   * producing 4.5 quadrillion for a book that is really ~86k USDC, 16 troy
   * ounces of gold, 4,494 USDY and 482 BUIDL.
   *
   * The honest fix is not a better sum, it is refusing to sum. Converting
   * troy ounces to dollars needs a price, Dokett has no price oracle, and
   * adding one to tidy a stat tile would trade away the entire argument this
   * registry makes. Same principle already applied one line up to bonded vs
   * unbonded: figures that are not commensurable are shown apart.
   */
  const byDenomination = all
    .filter((o) => o.bonded && !TERMINAL.has(o.status))
    .reduce<Record<string, { total: bigint; decimals: number }>>((acc, o) => {
      const sym = tokenSymbol(o.sourceToken) ?? 'other';
      const prev = acc[sym] ?? { total: 0n, decimals: tokenDecimals(o.sourceToken) };
      acc[sym] = { total: prev.total + big(o.outstanding), decimals: prev.decimals };
      return acc;
    }, {});

  const denominations = Object.entries(byDenomination).sort((a, b) =>
    a[0].localeCompare(b[0]),
  );

  const bondedLive = all.filter((o) => o.bonded && !TERMINAL.has(o.status));

  const coverage = all.reduce((a, o) => a + big(o.coverage), 0n);

  // A column that repeats the same value on every row carries no information —
  // at today's scale there is one registrar, and giving it equal visual rank
  // to Status and Outstanding (which do vary) draws the eye to the wrong place.
  const firstRegistrar = all[0]?.registrar;
  const uniformRegistrar =
    all.length > 1 && firstRegistrar !== undefined && all.every((o) => o.registrar === firstRegistrar);

  return (
    <>
      <Head />

      <div className="page">
        <Figures>
          <Figure label="Registered" value={all.length} sub={`${live.length} live`} />
          <Figure
            label="Bonded claims"
            value={bondedLive.length}
            sub="outstanding by denomination below"
            title="Claims whose registrar posted a bond. Unbonded claims are never counted here — registration is permissionless, so combining them would make defamation free."
          />
          <Figure
            label="First-loss coverage"
            value={compact(coverage.toString())}
            sub="staked against named obligors"
            title={`Exactly ${units(coverage.toString())}`}
          />
          <Figure
            label="Adverse"
            value={adverse.length}
            sub="delinquent, default or charged off"
          />
        </Figures>

        {denominations.length > 0 && (
          <div className="denom-strip">
            <span className="denom-strip-k">Bonded outstanding</span>
            <span className="denom-strip-list">
              {denominations.map(([sym, { total, decimals }]) => (
                <span
                  key={sym}
                  className="denom"
                  title={`${units(total.toString(), decimals)} ${sym}`}
                >
                  {compact(total.toString(), decimals)}
                  <span className="denom-sym">{sym}</span>
                </span>
              ))}
            </span>
            <span className="denom-strip-note">
              never summed — converting between them needs a price, and this registry has no
              price oracle
            </span>
          </div>
        )}

        <Section
          title="Obligations"
          aside={
            <>
              Every row reached its status through a verified ASC proof or an attested-height
              comparison. No party can assert a status into this table.
            </>
          }
        >
          {all.length === 0 ? (
            <Empty title="The register is empty">
              Register an obligation, or run <code className="mono">npm run keeper</code> to begin
              indexing.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Status</th>
                    <th>Registrar</th>
                    <th>Obligor</th>
                    <th className="num">Outstanding</th>
                    <th className="num">Periods</th>
                    <th className="num">Coverage</th>
                    <th className="num">Window ends</th>
                  </tr>
                </thead>
                <tbody>
                  {all.map((o) => (
                    <tr
                      key={o.id}
                      className="clickable"
                      onClick={() => {
                        window.location.hash = `#/obligation/${o.id}`;
                      }}
                    >
                      <td>
                        <a className="mono" href={`#/obligation/${o.id}`}>
                          {o.id}
                        </a>
                      </td>
                      <td>
                        <StatusPill status={o.status} />
                      </td>
                      <td style={uniformRegistrar ? { color: 'var(--ink-4)' } : undefined}>
                        <span className="row" style={{ gap: 7 }}>
                          <Addr value={o.registrar} />
                          {!o.bonded && <UnbondedFlag />}
                        </span>
                      </td>
                      <td>
                        {/* stopPropagation: the row navigates to the obligation,
                            but this cell is about the SUBJECT, not the claim. */}
                        <a
                          className="mono"
                          href={`#/profile/${o.obligor}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Open this subject's file"
                        >
                          {truncate(o.obligor, 8, 6)}
                        </a>
                      </td>
                      <td
                        className="num"
                        title={`${units(o.outstanding, tokenDecimals(o.sourceToken))} ${
                          tokenSymbol(o.sourceToken) ?? ''
                        }`.trim()}
                      >
                        {compact(o.outstanding, tokenDecimals(o.sourceToken))}
                      </td>
                      <td className="num" style={{ color: 'var(--ink-3)' }}>
                        {o.periodsSatisfied}/{o.periodsTotal}
                      </td>
                      <td className="num" title={units(o.coverage)}>
                        {compact(o.coverage)}
                      </td>
                      <td className="num" style={{ color: 'var(--ink-3)' }}>
                        {height(o.windowEndHeight)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
