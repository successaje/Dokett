#!/usr/bin/env node
'use strict';

/**
 * Prove a real mainnet payment against a live obligation.
 *
 *   npm run prove:payment <obligationId> <txHash>
 *
 * The whole thesis in one command: an obligation on Creditcoin advances because
 * a transaction on Ethereum is cryptographically proven to have happened, with
 * nobody reporting anything.
 */

const { ethers } = require('ethers');
const { ProofSource, toContractProof } = require('../worker/src/proof');

const STATUS = ['None', 'Active', 'Current', 'Delinquent', 'Default', 'Settled', 'ChargedOff'];
const erc20 = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

async function main() {
  const id = process.argv[2];
  const txHash = process.argv[3];
  if (!id || !txHash) throw new Error('usage: npm run prove:payment <obligationId> <txHash>');

  const d = require('../deployments/102031.json');
  const chainKey = Number(need('CHAIN_KEY'));
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const cc = new ethers.JsonRpcProvider(process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network');
  const w = new ethers.Wallet(need('PRIVATE_KEY'), cc);

  const reg = new ethers.Contract(d.register, [
    'function getObligation(uint256) view returns ((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 outstanding,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 windowEndHeight,uint64 cureBlocks,uint64 lastProvenHeight,uint8 periodsTotal,uint8 periodsSatisfied,uint8 status,address registrar,uint128 registrarBond,uint128 keeperFund,uint8 seniority,bytes32 collateralRef))',
    'function statusOf(uint256) view returns (uint8)',
    'function windowBounds(uint256) view returns (uint64,uint64)',
  ], cc);

  const pay = new ethers.Contract(d.paymentAdapter, [
    'function provePayment(uint256 id, (uint64 chainKey,uint64 height,bytes encodedTransaction,(bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof,(bytes32 lowerEndpointDigest,bytes32[] roots) continuityProof,uint32 logIndex) p)',
  ], w);

  const o = await reg.getObligation(id);
  const [ws, we] = await reg.windowBounds(id);
  console.log(`obligation #${id}`);
  console.log(`  status   ${STATUS[Number(o.status)]}`);
  console.log(`  window   (${ws}, ${we}]`);
  console.log(`  expects  >= ${o.periodAmount} of ${o.sourceToken}`);
  console.log(`           ${o.sourcePayer} -> ${o.sourcePayee}`);

  const rx = await src.getTransactionReceipt(txHash);
  if (!rx) throw new Error('no such transaction');
  const logIndex = rx.logs.findIndex((l) => {
    if (l.address.toLowerCase() !== o.sourceToken.toLowerCase()) return false;
    try {
      const p = erc20.parseLog({ topics: [...l.topics], data: l.data });
      return (
        p.args.from.toLowerCase() === o.sourcePayer.toLowerCase() &&
        p.args.to.toLowerCase() === o.sourcePayee.toLowerCase() &&
        p.args.value >= o.periodAmount
      );
    } catch { return false; }
  });
  if (logIndex < 0) throw new Error('that transaction contains no transfer matching this obligation');
  console.log(`\n  matched log index ${logIndex} at height ${rx.blockNumber}`);

  const proofs = new ProofSource(chainKey, (process.env.PROOF_BUILDERS ||
    'https://proof-gen-api.cc3-testnet.creditcoin.network').split(',').map((s) => s.trim()), console);

  await proofs.waitUntilAttested(rx.blockNumber);
  const data = await proofs.getProof(txHash);
  const proof = toContractProof(data, logIndex);

  const tx = await pay.provePayment(id, proof, { gasLimit: 1_200_000 });
  const receipt = await tx.wait();

  const after = await reg.getObligation(id);
  console.log(`\n  proved in ${tx.hash}`);
  console.log(`  gas      ${receipt.gasUsed}`);
  console.log(`  status   ${STATUS[Number(o.status)]} -> ${STATUS[Number(after.status)]}`);
  console.log(`  periods  ${after.periodsSatisfied}/${after.periodsTotal}`);
  console.log(`  outstanding ${after.outstanding}`);
  console.log(`\n  Nobody reported this. An Ethereum transaction was proven, and the record moved.\n`);
}

main().catch((e) => { console.error(`\n✗ ${e.message}\n`); process.exit(1); });
