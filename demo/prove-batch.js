#!/usr/bin/env node
'use strict';

/**
 * Measure what batching actually saves.
 *
 * The continuity proof is the part of a proof that grows with a transaction's
 * age, and `verifyBatch` pays for it once across up to ten transactions. If the
 * economics of a permanent registry rest on that, it should be measured rather
 * than asserted — a registry sweeping thousands of obligations does not verify
 * them one at a time.
 *
 *   PROBE=0x… node demo/prove-batch.js [sizes]     e.g. 1,5,10
 *
 * Picks its own transactions from a recent attested block, since a shared
 * continuity proof requires the batch to sit in a narrow height range.
 */

const { ethers } = require('ethers');
const { encoding, proofProvider } = require('@gluwa/usc-sdk');

const PROBE_ABI = [
  'function probeBatch((uint64 chainKey, uint64[] heights, bytes[] encodedTransactions, (bytes32 root, (bytes32 hash, bool isLeft)[] siblings)[] merkleProofs, (bytes32 lowerEndpointDigest, bytes32[] roots) sharedContinuityProof, uint32[] logIndexes) p) returns (uint256)',
  'function minConfirmations() view returns (uint64)',
];
const CHAIN_INFO = '0x0000000000000000000000000000000000000fD3';
const CI_ABI = [
  'function get_latest_attestation_height_and_hash(uint64) view returns ((uint64 height,bytes32 hash,bool isAttestation,bool exists))',
];
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};
const info = (k, v) => console.log(`      ${String(k).padEnd(20)} ${v}`);

async function main() {
  const chainKey = Number(need('CHAIN_KEY'));
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const cc = new ethers.JsonRpcProvider(process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network');
  const wallet = new ethers.Wallet(need('KEEPER_PRIVATE_KEY'), cc);
  const probe = new ethers.Contract(need('PROBE'), PROBE_ABI, wallet);

  const sizes = (process.argv[2] || '1,5,10').split(',').map(Number);
  // Each batch needs its OWN transactions. Reusing them across batches trips the
  // replay guard — proof keys are global and single-use, which is the point.
  const maxSize = sizes.reduce((a, b) => a + b, 0);

  const builder = new proofProvider.service.ProofBuilder(
    chainKey,
    (process.env.PROOF_BUILDERS || 'https://proof-gen-api.cc3-testnet.creditcoin.network').split(',')[0].trim(),
  );

  // A shared continuity proof spans a height range, so candidates must come from
  // a block that is already attested and deep enough to be admissible.
  const ci = new ethers.Contract(CHAIN_INFO, CI_ABI, cc);
  const attested = Number((await ci.get_latest_attestation_height_and_hash(chainKey)).height);
  const minConf = Number(await probe.minConfirmations());
  const target = attested - minConf - 10;

  console.log(`\n[1] collecting ${maxSize} USDC transfers at/below height ${target}`);
  const picks = [];
  for (let b = target; b > target - 12 && picks.length < maxSize; b--) {
    let blk;
    try {
      blk = await src.getBlock(b, true);
    } catch {
      continue;
    }
    if (!blk) continue;
    for (const tx of blk.prefetchedTransactions || []) {
      if (picks.length >= maxSize) break;
      if (!tx.to || tx.to.toLowerCase() !== USDC) continue;
      const rx = await src.getTransactionReceipt(tx.hash);
      if (rx && rx.status === 1 && rx.logs.length === 1) picks.push({ hash: tx.hash, block: b, rx });
    }
  }
  if (picks.length < maxSize) throw new Error(`only found ${picks.length} candidates, need ${maxSize}`);
  info('heights', `${Math.min(...picks.map((p) => p.block))}–${Math.max(...picks.map((p) => p.block))}`);

  console.log(`\n[2] batching`);
  const results = [];

  let cursor = 0;
  for (const size of sizes) {
    const chosen = picks.slice(cursor, cursor + size);
    cursor += size;
    const res = await builder.getBatchProof(chosen.map((p) => p.hash));
    if (!res.success) throw new Error(`batch proof failed: ${res.error}`);
    const d = res.data;

    // merkleProofs arrives as Map<height, Map<txIndex, entry>>; flatten it back
    // into the order we requested, since the precompile matches by position.
    const flat = [];
    for (const [, byIndex] of d.merkleProofs) for (const [, entry] of byIndex) flat.push(entry);

    const byHash = new Map(flat.map((e) => [e.txHash.toLowerCase(), e]));
    const ordered = chosen.map((p) => {
      const e = byHash.get(p.hash.toLowerCase());
      if (!e) throw new Error(`builder omitted ${p.hash}`);
      return e;
    });

    const bp = {
      chainKey: BigInt(chainKey),
      heights: chosen.map((p) => BigInt(p.block)),
      encodedTransactions: ordered.map((e) => e.txBytes),
      merkleProofs: ordered.map((e) => ({
        root: e.merkleProof.root,
        siblings: e.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
      })),
      sharedContinuityProof: {
        lowerEndpointDigest: d.continuityProof.lowerEndpointDigest,
        roots: d.continuityProof.roots,
      },
      logIndexes: chosen.map(() => 0),
    };

    const tx = await probe.probeBatch(bp);
    const receipt = await tx.wait();
    const gas = receipt.gasUsed;
    const perQuery = gas / BigInt(size);

    results.push({ size, gas, perQuery, roots: d.continuityProof.roots.length, hash: tx.hash });
    console.log(`    ✓ ${String(size).padStart(2)} queries  ${String(gas).padStart(8)} gas  ${String(perQuery).padStart(7)} per query  (${d.continuityProof.roots.length} shared roots)`);
  }

  const base = results[0];
  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' BATCH AMORTISATION');
  console.log(' queries |      gas | per query | saving vs 1');
  for (const r of results) {
    const saving = base ? (1 - Number(r.perQuery) / Number(base.perQuery)) * 100 : 0;
    console.log(
      ` ${String(r.size).padStart(7)} | ${String(r.gas).padStart(8)} | ${String(r.perQuery).padStart(9)} | ${saving.toFixed(1).padStart(6)}%`,
    );
  }
  console.log('──────────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
