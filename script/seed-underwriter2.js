#!/usr/bin/env node
'use strict';

/**
 * A second, independent underwriter.
 *
 * ─── THE PROBLEM THIS FIXES ────────────────────────────────────────────────
 *
 * On obligations 6 and 7 the registrar and the underwriter were the same
 * address. Economically that is incoherent: staking first-loss capital against
 * a claim you recorded yourself protects nobody, because the party bearing the
 * loss and the party that asserted the debt are one. It reads as self-dealing,
 * and it quietly contradicts the thing this protocol is for — a market where
 * someone *else* prices your borrower.
 *
 * This posts bonds from a second wallet against obligations registered by the
 * first, which is the shape a real book has: one party records the claim,
 * another decides what covering it is worth.
 *
 * ─── SIZING ────────────────────────────────────────────────────────────────
 *
 * Each bond is deliberately a fraction of the debt, and the fractions differ.
 * First-loss capital absorbs the first tranche of a loss, not the loss — a bond
 * that covered the whole outstanding would imply a guarantee this protocol does
 * not offer. Varying the spread across the three also makes the obvious point
 * that this is a price, not a rate card.
 *
 *   npm run seed:underwriter2
 */

const { ethers } = require('ethers');

const BOND_ABI = [
  'function post(uint256 obligationId, address collateral, uint128 amount, uint16 spreadBps) returns (uint256)',
  'function allowedCollateral(address) view returns (bool)',
  'event BondPosted(uint256 indexed bondId, uint256 indexed obligationId, address indexed underwriter, address collateral, uint128 amount, uint16 spreadBps)',
];
const TOKEN_ABI = [
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];
const REGISTER_ABI = ['function statusOf(uint256) view returns (uint8)'];

/** obligation → [stake in mUSDC, spread in bps]. Spreads differ on purpose. */
const BOOK = [
  [1n, 1_000_000_000n, 310],
  [4n, 400_000_000n, 265],
  [12n, 1_200_000_000n, 420],
];

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

async function main() {
  const d = require('../deployments/102031.json');
  const seedBond = require('../deployments/seed-bond-102031.json');
  const cc = new ethers.JsonRpcProvider(
    process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network',
  );
  const w = new ethers.Wallet(need('PRIVATE_KEY_2'), cc);

  const bond = new ethers.Contract(d.bond, BOND_ABI, w);
  const token = new ethers.Contract(seedBond.mockUsdc, TOKEN_ABI, w);
  const reg = new ethers.Contract(d.register, REGISTER_ABI, cc);

  console.log(`underwriter  ${w.address}`);
  console.log(`balance      ${ethers.formatEther(await cc.getBalance(w.address))} CTC\n`);

  if (!(await bond.allowedCollateral(seedBond.mockUsdc))) {
    throw new Error(`collateral ${seedBond.mockUsdc} is not allowlisted on Bond`);
  }

  // Refuse anything not currently bondable rather than discovering it in a revert.
  const STATUS = ['None', 'Active', 'Current', 'Delinquent', 'Default', 'Settled', 'ChargedOff'];
  const live = [];
  for (const [id, amount, spread] of BOOK) {
    const st = Number(await reg.statusOf(id));
    if (st !== 1 && st !== 2) {
      console.log(`  skipping #${id}: ${STATUS[st]} is not bondable`);
      continue;
    }
    live.push([id, amount, spread]);
  }
  if (!live.length) throw new Error('nothing bondable in the book');

  const total = live.reduce((a, [, amt]) => a + amt, 0n);
  const held = await token.balanceOf(w.address);
  if (held < total) {
    const tx = await token.mint(w.address, total - held);
    await tx.wait();
    console.log(`minted ${ethers.formatUnits(total - held, 6)} mUSDC — ${tx.hash}`);
  }

  const approve = await token.approve(d.bond, total);
  await approve.wait();
  console.log(`approved ${ethers.formatUnits(total, 6)} mUSDC to Bond\n`);

  const written = [];
  for (const [id, amount, spread] of live) {
    const tx = await bond.post(id, seedBond.mockUsdc, amount, spread);
    const rx = await tx.wait();
    const ev = rx.logs
      .map((l) => {
        try {
          return bond.interface.parseLog(l);
        } catch {
          return null;
        }
      })
      .find((l) => l && l.name === 'BondPosted');

    written.push({ obligationId: id.toString(), bondId: ev.args.bondId.toString(), tx: tx.hash });
    console.log(
      `  #${id}  bond #${ev.args.bondId}  ${ethers.formatUnits(amount, 6)} mUSDC @ ${(spread / 100).toFixed(2)}%  ${tx.hash}`,
    );
  }

  require('node:fs').writeFileSync(
    'deployments/seed-underwriter2-102031.json',
    JSON.stringify({ underwriter: w.address, bonds: written }, null, 2) + '\n',
  );

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' AN INDEPENDENT UNDERWRITER');
  console.log(` ${w.address}`);
  console.log(` ${written.length} bond(s) against obligations it did not register`);
  console.log('');
  console.log(` watch: https://dokett-console.vercel.app/#/underwriter/${w.address}`);
  console.log('──────────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
