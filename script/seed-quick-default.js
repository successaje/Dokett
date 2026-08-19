#!/usr/bin/env node
'use strict';

/**
 * Register one obligation whose window is ALREADY CLOSED, with a short cure,
 * so the live keeper can carry it Active -> Delinquent -> Default entirely on
 * its own within minutes rather than the ~30-day + 7-day real schedule every
 * other seeded obligation uses.
 *
 * Why this is honest and not a shortcut around the protocol: nothing here is
 * simulated or fast-forwarded. windowEndHeight and cureBlocks are ordinary
 * fields — this obligation just has small ones, the same way a real 24-hour
 * payday-loan-style product would. The keeper's sweep, the liveness gate, and
 * the on-chain proof of absence are all the exact same code path as the
 * 30-day obligations; only the schedule differs.
 *
 * Precondition: penaltiesEnabled must already be true for this chainKey (I7's
 * hour-long observation record), or markDelinquent will legitimately refuse —
 * which is correct, not a bug.
 *
 *   npm run seed:quick-default
 */

const { ethers } = require('ethers');

const REGISTER_ABI = [
  'function register((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init, uint64 expectedChainId) payable returns (uint256)',
  'function nextId() view returns (uint256)',
  'function statusOf(uint256) view returns (uint8)',
  'function windowBounds(uint256) view returns (uint64,uint64)',
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
];
const VERIFIER_ABI = ['function penaltiesEnabled(uint64) view returns (bool)', 'function attestedHead(uint64) view returns (uint64)'];
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

async function main() {
  const d = require('../deployments/102031.json');
  const chainKey = Number(need('CHAIN_KEY'));
  const cc = new ethers.JsonRpcProvider(process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network');
  const w = new ethers.Wallet(need('PRIVATE_KEY'), cc);
  const reg = new ethers.Contract(d.register, REGISTER_ABI, w);
  const verifier = new ethers.Contract(d.ascVerifier, VERIFIER_ABI, cc);

  const enabled = await verifier.penaltiesEnabled(chainKey);
  console.log(`penaltiesEnabled for chainKey ${chainKey}: ${enabled}`);
  if (!enabled) {
    throw new Error(
      'penaltiesEnabled is false — the keeper has not yet built a continuous hour of ' +
        'observation. markDelinquent would correctly refuse. Wait for I7, do not route around it.',
    );
  }

  const attested = await verifier.attestedHead(chainKey);
  const bond = await reg.MIN_REGISTRAR_BOND();
  const fund = await reg.MIN_KEEPER_FUND();

  // Already 300 blocks behind the attested head — comfortably past
  // minConfirmations (64) so markDelinquent is callable immediately. cureBlocks
  // is 100 (~20 min of real Ethereum block production) rather than the ~7 days
  // every other seeded obligation uses, so finalizeDefault becomes callable
  // within this session purely by waiting for real blocks to be attested.
  const windowEnd = attested - 300n;
  const periodBlocks = 1000n;
  const cureBlocks = 100n;
  const periodAmount = 1_000_000n; // 1 USDC, 6dp

  const init = {
    obligor: ethers.keccak256(ethers.toUtf8Bytes(`quick-default-${Date.now()}`)),
    creditor: ethers.keccak256(ethers.toUtf8Bytes('demo-creditor')),
    creditorPayout: w.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(USDC),
    sourcePayer: ethers.getAddress('0x' + '11'.repeat(20)), // never paid this payee — see seed.js SILENT
    sourcePayee: ethers.getAddress('0x' + '99'.repeat(20)),
    principal: periodAmount,
    periodAmount,
    aprBps: 340,
    startHeight: windowEnd - periodBlocks,
    periodBlocks,
    cureBlocks,
    periodsTotal: 1,
    seniority: 0,
    collateralRef: ethers.ZeroHash,
  };

  console.log(`attested head ${attested}, window already closed at ${windowEnd}, cure closes at ${windowEnd + cureBlocks}`);

  const tx = await reg.register(init, 1n, { value: bond + fund, gasLimit: 900_000 });
  await tx.wait();
  const id = (await reg.nextId()) - 1n;

  console.log(`\nregistered #${id} — ${tx.hash}`);
  console.log(`the live keeper should mark it Delinquent on its next sweep (<=60s),`);
  console.log(`then Default once the attested head passes ${windowEnd + cureBlocks} (~20 min of real Ethereum blocks).`);
  console.log(`\nwatch: curl -s https://covenant-lens.fly.dev/obligation/${id} | jq .status`);
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
