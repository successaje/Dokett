#!/usr/bin/env node
'use strict';

/**
 * Find an unproven Ethereum transaction and prove it.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Every proof is replay-guarded on (chainKey, height, txIndex, logIndex) and
 * can be consumed exactly once. That is the correct behaviour — without it, one
 * real payment could be replayed to satisfy an unlimited number of obligations.
 *
 * But it means any transaction hash written down in a script, a README or a
 * research post is single-use, and reusing it fails with an opaque custom
 * error. The demo script hardcoded such a hash, which would have reverted on
 * camera during the one live command in the video.
 *
 * So: never type a hash from the docs. Run this, which finds a transaction
 * nobody has proven yet and proves that instead.
 *
 *   npm run prove:fresh
 */

const { execFileSync } = require('node:child_process');
const { ethers } = require('ethers');

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

async function main() {
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const head = await src.getBlockNumber();

  /*
   * Start ~250 blocks back. Deep enough to clear minConfirmations (64) and the
   * attestation lag comfortably, recent enough that the continuity walk is
   * short — which is also the cheapest, best-looking gas figure to show.
   */
  const start = head - 250;
  console.log(`Ethereum head ${head}, searching from ${start} for a single-log USDC transfer\n`);

  for (let b = start; b > start - 40; b--) {
    let blk;
    try {
      blk = await src.getBlock(b, true);
    } catch {
      continue;
    }
    if (!blk) continue;

    for (const tx of blk.prefetchedTransactions || []) {
      if (!tx.to || tx.to.toLowerCase() !== USDC) continue;
      const rx = await src.getTransactionReceipt(tx.hash);
      // One log keeps the proof unambiguous — multi-log receipts need a
      // logIndex the demo would otherwise have to explain.
      if (!rx || rx.status !== 1 || rx.logs.length !== 1) continue;

      console.log(`found ${tx.hash} in block ${b}\n`);
      // Hand off to the real prover so there is exactly one code path that
      // proves anything, and this script cannot drift from it.
      execFileSync('node', ['--env-file-if-exists=.env', 'demo/prove-one.js', tx.hash], {
        stdio: 'inherit',
      });
      return;
    }
  }

  throw new Error('no suitable single-log USDC transfer found in the scanned range');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
