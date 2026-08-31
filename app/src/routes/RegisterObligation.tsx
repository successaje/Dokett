import { useEffect, useState } from 'react';
import {
  createPublicClient,
  encodePacked,
  http,
  isAddress,
  keccak256,
  parseUnits,
  toHex,
  zeroHash,
} from 'viem';
import {
  ADDRESSES,
  CC3,
  CHAIN_KEY,
  EXPECTED_CHAIN_ID,
  EXPLORER_TX,
  FAUCET_URL,
  REGISTER_ABI,
  SOURCE_TOKEN,
  VERIFIER_ABI,
  explainRevert,
} from '../lib/chain';
import { ether, height as fmtHeight } from '../lib/format';
import { useSession } from '../lib/auth';

/**
 * Creating an obligation.
 *
 * ─── THE PROBLEM THIS SCREEN HAS ───────────────────────────────────────────
 *
 * `Register.register` takes a sixteen-field struct. Rendering sixteen inputs
 * would be honest and useless — nobody fills in `periodBlocks` correctly on
 * their first try, and every mistake costs a reverted transaction and real gas.
 *
 * So the form asks for the seven things only a human can decide, derives the
 * rest, and shows what it derived. Nothing is hidden: the derived schedule is
 * displayed in the same units the contract stores, so anyone who wants to check
 * the arithmetic can.
 *
 * ─── VALIDATED BEFORE SIGNING, NOT AFTER ───────────────────────────────────
 *
 * Every condition `register` reverts on is checked here first:
 *
 *   · no schedule field may be zero
 *   · periodAmount × periodsTotal ≥ principal, or the promise is unsatisfiable
 *     by construction and the contract refuses it
 *   · msg.value ≥ MIN_REGISTRAR_BOND + MIN_KEEPER_FUND
 *
 * A wallet prompt that was always going to fail is worse than an error message.
 *
 * ─── THE SALT IS THE PART THAT MATTERS ─────────────────────────────────────
 *
 * Identity here is a commitment, never a name. The salt is generated in this
 * browser and never sent anywhere — which means if it is lost, nobody can ever
 * prove which subject this obligation refers to, including us. That is the
 * privacy guarantee working as designed, and it is stated plainly rather than
 * buried, because a user who loses it has lost something unrecoverable.
 */

const publicClient = createPublicClient({ chain: CC3, transport: http() });

type Stage = 'idle' | 'faucet' | 'submitting' | 'done' | 'error';

/** ~12s Ethereum blocks. The contract counts blocks; people think in days. */
const BLOCKS_PER_DAY = 7200n;

function commit(name: string, salt: `0x${string}`): `0x${string}` {
  return keccak256(encodePacked(['string', 'bytes16'], [name, salt]));
}

function newSalt(): `0x${string}` {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return toHex(b) as `0x${string}`;
}

export default function RegisterObligation() {
  const s = useSession();

  const [borrower, setBorrower] = useState('');
  const [creditor, setCreditor] = useState('');
  const [principal, setPrincipal] = useState('5000');
  const [periods, setPeriods] = useState('3');
  const [periodDays, setPeriodDays] = useState('30');
  const [cureDays, setCureDays] = useState('7');
  const [payer, setPayer] = useState('');
  const [payee, setPayee] = useState('');
  const [collateral, setCollateral] = useState('');
  const [apr, setApr] = useState('340');

  const [salt] = useState<`0x${string}`>(newSalt);
  const [head, setHead] = useState<bigint | null>(null);
  const [escrow, setEscrow] = useState<bigint | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ id: string; tx: string } | null>(null);

  // The chain's own numbers, not assumptions about them.
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const [h, bond, fund] = await Promise.all([
          publicClient.readContract({
            address: ADDRESSES.verifier,
            abi: VERIFIER_ABI,
            functionName: 'attestedHead',
            args: [CHAIN_KEY],
          }),
          publicClient.readContract({
            address: ADDRESSES.register,
            abi: REGISTER_ABI,
            functionName: 'MIN_REGISTRAR_BOND',
          }),
          publicClient.readContract({
            address: ADDRESSES.register,
            abi: REGISTER_ABI,
            functionName: 'MIN_KEEPER_FUND',
          }),
        ]);
        if (dead) return;
        setHead(h as bigint);
        setEscrow((bond as bigint) + (fund as bigint));
      } catch {
        /* the form still renders; submission will surface the real failure */
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  // ── derived schedule ───────────────────────────────────────────────────
  const periodsN = Number(periods);
  const principalUnits = /^\d+(\.\d+)?$/.test(principal) ? parseUnits(principal, 6) : 0n;
  const periodBlocks = /^\d+$/.test(periodDays) ? BigInt(periodDays) * BLOCKS_PER_DAY : 0n;
  const cureBlocks = /^\d+$/.test(cureDays) ? BigInt(cureDays) * BLOCKS_PER_DAY : 0n;

  /*
   * Round UP. `periodAmount × periodsTotal` must be at least the principal or
   * the contract rejects the schedule — flooring here is how a seed script once
   * ended up two USDC short and burned a transaction finding out.
   */
  const periodAmount =
    principalUnits > 0n && periodsN > 0
      ? (principalUnits + BigInt(periodsN) - 1n) / BigInt(periodsN)
      : 0n;

  const startHeight = head ?? 0n;
  const windowEnd = startHeight + periodBlocks;

  const problems: string[] = [];
  if (!borrower.trim()) problems.push('Borrower name is required — it becomes the commitment.');
  if (!creditor.trim()) problems.push('Creditor name is required.');
  if (principalUnits <= 0n) problems.push('Principal must be greater than zero.');
  if (!Number.isInteger(periodsN) || periodsN < 1 || periodsN > 255)
    problems.push('Periods must be a whole number between 1 and 255.');
  if (periodBlocks <= 0n) problems.push('Period length must be at least one day.');
  if (cureBlocks <= 0n) problems.push('Cure window must be at least one day.');
  if (payer && !isAddress(payer)) problems.push('Payer must be a valid Ethereum address.');
  if (payee && !isAddress(payee)) problems.push('Payee must be a valid Ethereum address.');
  if (!payer || !payee) problems.push('Payer and payee bind which payment counts. Both are required.');
  if (periodAmount * BigInt(Math.max(periodsN, 0)) < principalUnits)
    problems.push('This schedule cannot clear the principal.');
  if (head === null) problems.push('Waiting for the attested source-chain head.');

  const ready = problems.length === 0 && s.signedIn;
  const busy = stage === 'submitting' || stage === 'faucet';

  async function fund() {
    setStage('faucet');
    setMessage(null);
    try {
      const addr = s.addresses[0];
      if (!addr) throw new Error('No wallet address on this session.');
      const res = await fetch(FAUCET_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ address: addr }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) throw new Error(body.error ?? `faucet returned ${res.status}`);
      setStage('idle');
      setMessage(`Funded with ${body.ctcSent} CTC. You can register now.`);
    } catch (err) {
      setStage('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || escrow === null || head === null) return;

    setStage('submitting');
    setMessage(null);
    setResult(null);

    try {
      const wallet = await s.getWalletClient();
      if (!wallet?.account) throw new Error('No wallet available. Sign in first.');
      const account = wallet.account;

      const init = {
        obligor: commit(borrower.trim(), salt),
        creditor: keccak256(encodePacked(['string'], [creditor.trim()])),
        creditorPayout: account.address,
        chainKey: CHAIN_KEY,
        sourceToken: SOURCE_TOKEN,
        sourcePayer: payer as `0x${string}`,
        sourcePayee: payee as `0x${string}`,
        principal: principalUnits,
        periodAmount,
        aprBps: Number(apr) || 0,
        startHeight,
        periodBlocks,
        cureBlocks,
        periodsTotal: periodsN,
        seniority: 0,
        collateralRef: collateral.trim()
          ? keccak256(encodePacked(['string'], [collateral.trim()]))
          : zeroHash,
      };

      const before = (await publicClient.readContract({
        address: ADDRESSES.register,
        abi: REGISTER_ABI,
        functionName: 'nextId',
      })) as bigint;

      const hash = await wallet.writeContract({
        address: ADDRESSES.register,
        abi: REGISTER_ABI,
        functionName: 'register',
        args: [init, EXPECTED_CHAIN_ID],
        value: escrow,
        account,
        chain: CC3,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('The registration reverted on-chain.');

      setResult({ id: before.toString(), tx: hash });
      setStage('done');
    } catch (err) {
      setStage('error');
      setMessage(explainRevert(err, 'register'));
    }
  }

  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">Record a promise to pay</div>
        <h1 className="page-title">Register an obligation</h1>
        <p className="page-lede">
          Registration is permissionless — anyone may record a claim against anyone. That is
          deliberate, and it is why a registrar posts a bond: it makes a fabricated claim cost
          something, and the Lens never sums unbonded claims into a total.
        </p>
      </div>

      <div className="page">
        {!s.configured || !s.signedIn ? (
          <div className="uw">
            <span className="eyebrow">Sign in to register</span>
            <p className="note" style={{ marginTop: 8 }}>
              Registering posts a bond from your own wallet, so it needs a signature from you.
              Reading the register needs nothing, and neither does curing a delinquency.
            </p>
          </div>
        ) : null}

        <form className="reg" onSubmit={submit}>
          <fieldset className="reg-group" disabled={busy}>
            <legend>Who</legend>
            <p className="note" style={{ marginTop: 0 }}>
              Names never reach the chain. Each becomes a commitment — a hash — computed in this
              browser.
            </p>

            <label className="reg-field">
              <span>Borrower</span>
              <input value={borrower} onChange={(e) => setBorrower(e.target.value)} placeholder="Daehyun Trading" />
            </label>

            <label className="reg-field">
              <span>Creditor</span>
              <input value={creditor} onChange={(e) => setCreditor(e.target.value)} placeholder="Hangang Finance" />
            </label>
          </fieldset>

          <fieldset className="reg-group" disabled={busy}>
            <legend>What counts as payment</legend>
            <p className="note" style={{ marginTop: 0 }}>
              Only a transfer of USDC on Ethereum mainnet between these two addresses can advance
              this obligation. Anything else is not admissible, however large.
            </p>

            <label className="reg-field">
              <span>Payer (Ethereum)</span>
              <input className="mono" value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="0x…" />
            </label>

            <label className="reg-field">
              <span>Payee (Ethereum)</span>
              <input className="mono" value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="0x…" />
            </label>
          </fieldset>

          <fieldset className="reg-group" disabled={busy}>
            <legend>Terms</legend>

            <div className="reg-row">
              <label className="reg-field">
                <span>Principal (USDC)</span>
                <input className="mono" value={principal} onChange={(e) => setPrincipal(e.target.value)} inputMode="decimal" />
              </label>
              <label className="reg-field">
                <span>Periods</span>
                <input className="mono" value={periods} onChange={(e) => setPeriods(e.target.value)} inputMode="numeric" />
              </label>
              <label className="reg-field">
                <span>Period length (days)</span>
                <input className="mono" value={periodDays} onChange={(e) => setPeriodDays(e.target.value)} inputMode="numeric" />
              </label>
              <label className="reg-field">
                <span>Cure window (days)</span>
                <input className="mono" value={cureDays} onChange={(e) => setCureDays(e.target.value)} inputMode="numeric" />
              </label>
              <label className="reg-field">
                <span>APR (bps)</span>
                <input className="mono" value={apr} onChange={(e) => setApr(e.target.value)} inputMode="numeric" />
              </label>
              <label className="reg-field reg-field-wide">
                <span>Collateral reference (optional)</span>
                <input value={collateral} onChange={(e) => setCollateral(e.target.value)} placeholder="warehouse-receipt:BUSAN-WR-88214" />
              </label>
            </div>
          </fieldset>

          {/* What the contract will actually store, in its own units. */}
          <div className="reg-derived">
            <div className="eyebrow">What gets written</div>
            <dl className="dl">
              <dt>Period amount</dt>
              <dd className="mono">
                {periodAmount ? `${(Number(periodAmount) / 1e6).toFixed(2)} USDC` : '—'}{' '}
                <span className="note">· principal ÷ periods, rounded up</span>
              </dd>
              <dt>Starts at height</dt>
              <dd className="mono">{head === null ? '—' : fmtHeight(startHeight)}</dd>
              <dt>First window closes</dt>
              <dd className="mono">
                {head === null ? '—' : fmtHeight(windowEnd)}{' '}
                <span className="note">· {periodDays} days of Ethereum blocks</span>
              </dd>
              <dt>Cure expires</dt>
              <dd className="mono">{head === null ? '—' : fmtHeight(windowEnd + cureBlocks)}</dd>
              <dt>Registrar bond</dt>
              <dd className="mono">{escrow === null ? '—' : `${ether(escrow.toString())} CTC`}</dd>
              <dt>Obligor commitment</dt>
              <dd className="mono">{borrower.trim() ? commit(borrower.trim(), salt) : '—'}</dd>
            </dl>
          </div>

          {borrower.trim() && (
            <div className="reg-salt">
              <div className="eyebrow">Save this salt</div>
              <p className="note" style={{ marginTop: 6 }}>
                It was generated in your browser and sent nowhere. Without it nobody can ever
                demonstrate which subject this commitment refers to — not a court, not a
                counterparty, and not us. That is the privacy model working, and it is also
                unrecoverable.
              </p>
              <code className="mono reg-salt-value">{salt}</code>
            </div>
          )}

          {problems.length > 0 && s.signedIn && (
            <ul className="reg-problems">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}

          <div className="uw-form">
            <button className="btn" type="submit" disabled={!ready || busy}>
              {stage === 'submitting' ? 'Registering…' : 'Register obligation'}
            </button>
            {s.signedIn && (
              <button className="btn" type="button" onClick={fund} disabled={busy}>
                {stage === 'faucet' ? 'Funding…' : 'Get testnet CTC'}
              </button>
            )}
          </div>
        </form>

        {stage === 'done' && result && (
          <p className="note" style={{ marginTop: 16 }}>
            <strong>Registered as obligation #{result.id}.</strong>{' '}
            <a className="mono" href={`${EXPLORER_TX}${result.tx}`} target="_blank" rel="noreferrer">
              {result.tx.slice(0, 10)}…{result.tx.slice(-6)}
            </a>{' '}
            — <a href={`#/obligation/${result.id}`}>open it in the register</a>. The projection
            catches up within a block or two.
          </p>
        )}

        {stage === 'error' && message && (
          <p className="note" style={{ marginTop: 16, color: 'var(--st-default)' }}>
            {message}
          </p>
        )}

        {stage !== 'error' && stage !== 'done' && message && (
          <p className="note" style={{ marginTop: 16 }}>
            {message}
          </p>
        )}
      </div>
    </>
  );
}
