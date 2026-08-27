import { useState } from 'react';
import { createPublicClient, http, parseUnits, formatUnits } from 'viem';
import {
  ADDRESSES,
  BOND_ABI,
  CC3,
  ERC20_ABI,
  EXPLORER_TX,
  FAUCET_URL,
  explainRevert,
} from '../lib/chain';
import { units } from '../lib/format';
import { useSession } from '../lib/auth';
import type { ObligationDetail } from '../lib/types';

/**
 * Underwriting — the half of the protocol that makes this a market.
 *
 * ─── WHY THIS ONE CANNOT BE SPONSORED ──────────────────────────────────────
 *
 * Curing is relayed: `provePayment` admits a proof on the height it binds to,
 * so a stranger can pay the gas and it changes nothing about who is protected.
 * Underwriting is the opposite. The whole point is that the underwriter's OWN
 * capital stands behind a named borrower — sponsor that and the sponsor is the
 * underwriter, and the position means nothing.
 *
 * So this is the first screen in the Console that genuinely needs a wallet.
 * The faucet exists so that requirement does not become a wall: testnet CTC for
 * gas, testnet mUSDC to stake.
 *
 * ─── WHAT IT REFUSES TO PRETEND ────────────────────────────────────────────
 *
 * Two transactions are required — an ERC-20 approval, then the bond — and they
 * are shown as two, because a spinner that hides a second wallet prompt is how
 * people end up approving something they did not read. The projection is also
 * eventually consistent, so the success state says the Lens will catch up
 * rather than silently rendering stale figures as if they were fresh.
 */

const publicClient = createPublicClient({ chain: CC3, transport: http() });

type Stage = 'idle' | 'faucet' | 'approving' | 'posting' | 'done' | 'error';

export default function UnderwriteFlow({ obligation }: { obligation: ObligationDetail }) {
  const s = useSession();
  const [amount, setAmount] = useState('250');
  const [spread, setSpread] = useState('275');
  const [stage, setStage] = useState<Stage>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Bond.post refuses anything that is not Active or Current.
  const bondable = obligation.status === 'Active' || obligation.status === 'Current';
  if (!bondable) return null;

  const amountNum = Number(amount);
  const spreadNum = Number(spread);
  const valid =
    Number.isFinite(amountNum) && amountNum >= 1 &&
    Number.isFinite(spreadNum) && spreadNum >= 0 && spreadNum <= 10_000;

  const busy = stage === 'faucet' || stage === 'approving' || stage === 'posting';

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
      setMessage(
        `Funded: ${body.ctcSent} CTC for gas and ${body.musdcMinted} mUSDC to stake. You can underwrite now.`,
      );
    } catch (err) {
      setStage('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;

    setMessage(null);
    setTxHash(null);

    try {
      const wallet = await s.getWalletClient();
      if (!wallet || !wallet.account) throw new Error('No wallet available. Sign in first.');
      const account = wallet.account;

      const stake = parseUnits(amount, 6);

      // Check the balance before asking for a signature — a wallet prompt that
      // was always going to revert wastes the reader's attention and their gas.
      const held = await publicClient.readContract({
        address: ADDRESSES.collateral,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [account.address],
      });
      if (held < stake) {
        throw new Error(
          `You hold ${formatUnits(held, 6)} mUSDC but tried to stake ${amount}. Use the faucet above.`,
        );
      }

      const allowance = await publicClient.readContract({
        address: ADDRESSES.collateral,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [account.address, ADDRESSES.bond],
      });

      // Approve only when the existing allowance is short, so a second bond
      // does not demand a redundant signature.
      if (allowance < stake) {
        setStage('approving');
        const approveHash = await wallet.writeContract({
          address: ADDRESSES.collateral,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [ADDRESSES.bond, stake],
          account,
          chain: CC3,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStage('posting');
      const postHash = await wallet.writeContract({
        address: ADDRESSES.bond,
        abi: BOND_ABI,
        functionName: 'post',
        args: [BigInt(obligation.id), ADDRESSES.collateral, stake, Number(spread)],
        account,
        chain: CC3,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash: postHash });
      if (receipt.status !== 'success') throw new Error('The bond transaction reverted on-chain.');

      setTxHash(postHash);
      setStage('done');
    } catch (err) {
      setStage('error');
      setMessage(explainRevert(err));
    }
  }

  return (
    <div className="uw">
      <div className="row wrap" style={{ gap: 10, alignItems: 'baseline' }}>
        <span className="eyebrow">Underwrite this obligation</span>
      </div>

      <p className="note" style={{ marginTop: 8 }}>
        Stake first-loss capital against <strong>this named borrower</strong> — not a pool, not a
        rating. You earn the spread if they pay, and are slashed to the creditor by proof if they
        do not. Your track record here is derived from bond events, so it is recomputable by anyone
        and editable by nobody.
      </p>

      {obligation.coverage && obligation.coverage !== '0' ? (
        <p className="note">
          Already covered: <strong>{units(obligation.coverage)}</strong> across{' '}
          {obligation.bonds.filter((b) => !b.released).length} live bond(s). Slashing is pro-rata,
          so additional capital shares the loss rather than subordinating to it.
        </p>
      ) : (
        <p className="note">
          Nothing is staked against this obligation yet — its creditor is currently fully exposed.
        </p>
      )}

      {!s.configured || !s.signedIn ? (
        <p className="note" style={{ marginTop: 12 }}>
          <strong>Signing in is required for this one.</strong> Unlike curing, underwriting stakes
          your own capital, so it needs a signature from you — sponsoring it would make the sponsor
          the underwriter. Use the control in the masthead.
        </p>
      ) : (
        <>
          <form className="uw-form" onSubmit={submit} style={{ marginTop: 14 }}>
            <label className="uw-field">
              <span>Stake (mUSDC)</span>
              <input
                className="mono"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                disabled={busy}
                aria-label="First-loss stake in mUSDC"
              />
            </label>

            <label className="uw-field">
              <span>Spread (bps)</span>
              <input
                className="mono"
                value={spread}
                onChange={(e) => setSpread(e.target.value)}
                inputMode="numeric"
                disabled={busy}
                aria-label="Quoted spread in basis points"
              />
            </label>

            <button className="btn" type="submit" disabled={!valid || busy}>
              {stage === 'approving'
                ? 'Approving…'
                : stage === 'posting'
                  ? 'Posting bond…'
                  : 'Underwrite'}
            </button>

            <button className="btn" type="button" onClick={fund} disabled={busy}>
              {stage === 'faucet' ? 'Funding…' : 'Get testnet funds'}
            </button>
          </form>

          <p className="note" style={{ marginTop: 10 }}>
            Two wallet prompts: an ERC-20 approval, then the bond itself. They are shown separately
            rather than behind one spinner, because an approval you did not read is worth more than
            a saved click.
          </p>
        </>
      )}

      {stage === 'done' && txHash && (
        <p className="note" style={{ marginTop: 12 }}>
          <strong>Bond posted.</strong>{' '}
          <a className="mono" href={`${EXPLORER_TX}${txHash}`} target="_blank" rel="noreferrer">
            {txHash.slice(0, 10)}…{txHash.slice(-6)}
          </a>{' '}
          — your capital now stands behind this obligation. The register above is a projection and
          will catch up within a block or two.
        </p>
      )}

      {stage === 'error' && message && (
        <p className="note" style={{ marginTop: 12, color: 'var(--st-default)' }}>
          {message}
        </p>
      )}

      {stage !== 'error' && stage !== 'done' && message && (
        <p className="note" style={{ marginTop: 12 }}>
          {message}
        </p>
      )}
    </div>
  );
}
