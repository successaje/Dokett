#!/usr/bin/env node
'use strict';

/**
 * Clear the evidence-layer gate: pull ONE real Ethereum mainnet transaction
 * through the proof builder and verify it on Creditcoin.
 *
 * Everything in the test suite runs against mocks installed at the precompile
 * addresses. That proves our logic, not our reading of the precompiles. This
 * script is the first thing that touches the real ones, and it is deliberately
 * the smallest possible program that can fail in an informative way.
 *
 *   PROBE=0x… ETH_MAINNET_RPC=… CC3_RPC=… CHAIN_KEY=3 KEEPER_PRIVATE_KEY=0x… \
 *   node demo/prove-one.js [txHash]
 *
 * With no txHash it finds a recent USDC transfer with exactly one log, which
 * keeps the first run unambiguous.
 */

const { ethers } = require('ethers');
const { encoding } = require('@gluwa/usc-sdk');
const { ProofSource, toContractProof } = require('../worker/src/proof');

const PROBE_ABI = [
  'function probe((uint64 chainKey, uint64 height, bytes encodedTransaction, (bytes32 root, (bytes32 hash, bool isLeft)[] siblings) merkleProof, (bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof, uint32 logIndex) p) returns ((uint64 height, uint8 txType, uint8 receiptStatus, uint256 logCount, address emitter, bytes32 topic0, uint256 topicCount, bytes data))',
  'function inspect(bytes encodedTransaction, uint32 logIndex) view returns (uint8 txType, uint8 receiptStatus, uint256 logCount, address emitter, bytes32 topic0)',
  'function chainReport(uint64 chainKey) view returns (bool exists, uint64 chainId, uint64 attestedHeight, bool penalties)',
  'function minConfirmations() view returns (uint64)',
  'event Probed(uint64 indexed chainKey, uint64 indexed height, address emitter, bytes32 topic0)',
];

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const erc20 = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
const TRANSFER_TOPIC = erc20.getEvent('Transfer').topicHash;

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

const step = (n, msg) => console.log(`\n[${n}] ${msg}`);
const ok = (msg) => console.log(`    ✓ ${msg}`);
const info = (k, v) => console.log(`      ${k.padEnd(18)} ${v}`);

/** A single-log USDC transfer keeps the first real proof unambiguous. */
async function findCandidate(src, head) {
  for (let n = head; n > head - 30; n--) {
    const logs = await src.getLogs({ address: USDC, topics: [TRANSFER_TOPIC], fromBlock: n, toBlock: n });
    for (const log of logs) {
      const rx = await src.getTransactionReceipt(log.transactionHash);
      if (rx && rx.status === 1 && rx.logs.length === 1) return log.transactionHash;
    }
  }
  throw new Error('no single-log USDC transfer found in the last 30 blocks; pass a txHash explicitly');
}

async function main() {
  const probeAddr = need('PROBE');
  const chainKey = Number(need('CHAIN_KEY'));
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const cc = new ethers.JsonRpcProvider(process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network');
  const wallet = new ethers.Wallet(need('KEEPER_PRIVATE_KEY'), cc);
  const probe = new ethers.Contract(probeAddr, PROBE_ABI, wallet);

  const builders = (process.env.PROOF_BUILDERS || 'https://proof-gen-api.cc3-testnet.creditcoin.network')
    .split(',').map((s) => s.trim()).filter(Boolean);
  const proofs = new ProofSource(chainKey, builders, console);

  // ── 1. what does this network actually think chainKey means? ──────────────
  step(1, 'chain report');
  const [exists, chainId, attestedHeight, penalties] = await probe.chainReport(chainKey);
  info('chainKey', chainKey);
  info('known', exists);
  info('chainId', chainId);
  info('attested head', attestedHeight);
  info('penaltiesEnabled', penalties);
  if (!exists) throw new Error(`chainKey ${chainKey} unknown on this network`);
  if (chainId !== 1n) {
    // Loud, because this is the failure that does not announce itself: a wrong
    // chainkey verifies proofs correctly, against the wrong chain.
    throw new Error(`chainKey ${chainKey} maps to chainId ${chainId}, expected 1 (Ethereum mainnet)`);
  }
  ok(`chainKey ${chainKey} is Ethereum mainnet on this network`);

  // ── 2. pick a transaction ─────────────────────────────────────────────────
  step(2, 'selecting a mainnet transaction');
  const head = await src.getBlockNumber();
  const txHash = process.argv[2] || (await findCandidate(src, head));
  const rx = await src.getTransactionReceipt(txHash);
  if (!rx) throw new Error(`no receipt for ${txHash}`);
  info('tx', txHash);
  info('block', rx.blockNumber);
  info('status', rx.status);
  info('logs', rx.logs.length);
  info('age (blocks)', head - rx.blockNumber);

  const minConf = Number(await probe.minConfirmations());
  if (head - rx.blockNumber < minConf) {
    // The contract would reject it; waiting here beats burning a builder request.
    const wait = minConf - (head - rx.blockNumber);
    throw new Error(`only ${head - rx.blockNumber} confirmations, need ${minConf} — wait ~${wait * 12}s`);
  }
  ok(`${head - rx.blockNumber} confirmations ≥ ${minConf}`);

  // ── 3. encode locally and decode on-chain, before spending a proof ────────
  step(3, 'encode locally, decode on-chain (no proof consumed)');
  const tx = await encoding.getTransactionWithRaw(src, txHash);
  const { abi } = encoding.abiEncode(tx, rx);
  info('encoded bytes', ethers.dataLength(abi));

  const [txType, receiptStatus, logCount, emitter, topic0] = await probe.inspect(abi, 0);
  info('txType', txType);
  info('receiptStatus', receiptStatus);
  info('logCount', logCount);
  info('emitter', emitter);
  info('topic0', topic0);

  if (Number(logCount) !== rx.logs.length) {
    throw new Error(`decoder saw ${logCount} logs, receipt has ${rx.logs.length} — encoding mismatch`);
  }
  if (emitter.toLowerCase() !== rx.logs[0].address.toLowerCase()) {
    throw new Error(`decoder emitter ${emitter} != receipt ${rx.logs[0].address}`);
  }
  ok('on-chain decoder agrees with the source receipt');

  // ── 4. attestation + proof ────────────────────────────────────────────────
  step(4, 'waiting for attestation, then fetching the proof');
  const servedBy = await proofs.waitUntilAttested(rx.blockNumber);
  ok(`height ${rx.blockNumber} attested (via ${servedBy})`);

  const t0 = Date.now();
  const data = await proofs.getProof(txHash);
  info('proof fetched in', `${Date.now() - t0}ms`);
  info('headerNumber', data.headerNumber);
  info('txIndex', data.txIndex);
  info('merkle siblings', data.merkleProof.siblings.length);
  info('continuity roots', data.continuityProof.roots.length);

  if (data.txBytes.toLowerCase() !== abi.toLowerCase()) {
    // Not necessarily fatal, but it means the builder and the SDK disagree about
    // encoding, and everything downstream assumes they don't.
    console.log('    ! builder txBytes differ from locally encoded bytes');
    info('  builder len', ethers.dataLength(data.txBytes));
    info('  local len', ethers.dataLength(abi));
  } else {
    ok('builder txBytes match our local encoding exactly');
  }

  // ── 5. the real thing ─────────────────────────────────────────────────────
  step(5, 'verifying on Creditcoin');
  const proof = toContractProof(data, 0);
  const sent = await probe.probe(proof);
  const receipt = await sent.wait();

  const gasPrice = receipt.gasPrice ?? sent.gasPrice ?? 0n;
  const cost = receipt.gasUsed * gasPrice;

  ok(`verified in ${sent.hash}`);
  info('gas used', receipt.gasUsed.toString());
  info('cost (CTC)', ethers.formatEther(cost));
  info('continuity hashes', data.continuityProof.roots.length);

  const parsed = receipt.logs
    .map((l) => { try { return probe.interface.parseLog(l); } catch { return null; } })
    .find((l) => l && l.name === 'Probed');
  if (parsed) {
    info('Probed.emitter', parsed.args.emitter);
    info('Probed.topic0', parsed.args.topic0);
  }

  console.log('\n────────────────────────────────────────────────────────');
  console.log(' EVIDENCE LAYER VERIFIED AGAINST A LIVE NETWORK');
  console.log(` tx ${txHash}`);
  console.log(` block ${rx.blockNumber} · ${data.continuityProof.roots.length} continuity hashes`);
  console.log(` ${receipt.gasUsed} gas · ${ethers.formatEther(cost)} CTC`);
  console.log('────────────────────────────────────────────────────────\n');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
