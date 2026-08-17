#!/usr/bin/env node
'use strict';

/**
 * Pre-deployment checks that forge cannot perform.
 *
 * `forge script` runs against a fork, and a fork carries no code for a native
 * precompile — so the one assertion that matters most, that CHAIN_KEY really
 * means the chain we think it does, is unverifiable from inside the deployment.
 * A wrong chainkey does not error; it verifies proofs correctly against the
 * wrong chain, forever.
 *
 * So it is checked here, over a real eth_call, before anything is broadcast.
 */

const { ethers } = require('ethers');

const CHAIN_INFO = '0x0000000000000000000000000000000000000fD3';
const ABI = [
  'function get_chain_by_key(uint64) view returns (((uint64 chainKey,uint64 chainId,bytes chainName,uint8 chainEncoding) info,bool exists))',
  'function get_latest_attestation_height_and_hash(uint64) view returns ((uint64 height,bytes32 hash,bool isAttestation,bool exists))',
];

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

async function main() {
  const chainKey = Number(need('CHAIN_KEY'));
  const expected = Number(process.env.EXPECTED_CHAIN_ID || 1);
  const rpc = process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network';

  const p = new ethers.JsonRpcProvider(rpc);
  const net = await p.getNetwork();
  const ci = new ethers.Contract(CHAIN_INFO, ABI, p);

  const r = await ci.get_chain_by_key(chainKey);
  const head = await ci.get_latest_attestation_height_and_hash(chainKey);

  console.log('preflight');
  console.log(`  creditcoin chainId  ${net.chainId}`);
  console.log(`  CHAIN_KEY           ${chainKey}`);
  console.log(`  resolves to         ${ethers.toUtf8String(r.info.chainName)} (chainId ${r.info.chainId})`);
  console.log(`  attested head       ${head.height}`);

  if (!r.exists) throw new Error(`chainKey ${chainKey} is unknown on this network`);
  if (Number(r.info.chainId) !== expected) {
    throw new Error(
      `chainKey ${chainKey} maps to chainId ${r.info.chainId}, expected ${expected}. ` +
        `Deploying now would bind every obligation to the wrong chain.`,
    );
  }
  if (!head.exists || head.height === 0n) throw new Error(`chainKey ${chainKey} has no attestations`);

  // Deploying a registry nobody is watching means penalties can never fire (I7).
  console.log(`\n  ✓ safe to deploy`);
  console.log(`  note: run the keeper after deploying — without an observation`);
  console.log(`        record, penaltiesEnabled stays false and no default can finalise.`);
}

main().catch((err) => {
  console.error(`\n✗ preflight failed: ${err.message}\n`);
  process.exit(1);
});
