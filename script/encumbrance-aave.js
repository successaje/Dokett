#!/usr/bin/env node
'use strict';

/**
 * Govern and prove the first external encumbrance venue.
 *
 *   npm run encumbrance:aave -- inspect
 *   npm run encumbrance:aave -- queue
 *   npm run encumbrance:aave -- activate
 *   npm run encumbrance:aave -- prove
 *
 * Venue 0 is the canonical Aave V3 Ethereum Pool. The selected event is not a
 * generic deposit: Aave emits it only when a user's reserve is enabled for use
 * as collateral. The asset and user are both indexed and therefore committed
 * inside the USC-proven receipt.
 */

const fs = require('node:fs');
const path = require('node:path');
const { ethers } = require('ethers');
const { ProofSource, toContractProof } = require('../worker/src/proof');

const deployment = require('../deployments/102031-v0.2.0.json');
const evidence = require('../deployments/encumbrance-aave-v3-102031.json');

const ABI = [
  'function timelock() view returns (address)',
  'function VENUE_TIMELOCK() view returns (uint64)',
  'function queueVenue(uint256 venueId,(address emitter,bytes32 topic0,uint8 assetTopic,uint8 holderTopic,bool enabled) venue)',
  'function setVenue(uint256 venueId)',
  'function venues(uint256 venueId) view returns (address emitter,bytes32 topic0,uint8 assetTopic,uint8 holderTopic,bool enabled)',
  'function venuePending(uint256 venueId) view returns (address emitter,bytes32 topic0,uint8 assetTopic,uint8 holderTopic,bool enabled)',
  'function venueEta(uint256 venueId) view returns (uint64)',
  'function witnessPledge(uint256 venueId,(uint64 chainKey,uint64 height,bytes encodedTransaction,(bytes32 root,(bytes32 hash,bool isLeft)[] siblings) merkleProof,(bytes32 lowerEndpointDigest,bytes32[] roots) continuityProof,uint32 logIndex) proof) returns (bytes32 collateralRef)',
  'event LienWitnessed(bytes32 indexed collateralRef,uint256 indexed venueId,bytes32 indexed holder,uint64 chainKey,uint64 height)',
];

const DATA_PROVIDER_ABI = [
  'function getUserReserveData(address asset,address user) view returns (uint256 currentATokenBalance,uint256 currentStableDebt,uint256 currentVariableDebt,uint256 principalStableDebt,uint256 scaledVariableDebt,uint256 stableBorrowRate,uint256 liquidityRate,uint40 stableRateLastUpdated,bool usageAsCollateralEnabled)',
];

const file = path.join(__dirname, '..', 'deployments', 'encumbrance-aave-v3-102031.json');
const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env: ${name}`);
  return value;
};

function write(update) {
  fs.writeFileSync(file, `${JSON.stringify({ ...evidence, ...update }, null, 2)}\n`);
}

async function verifySourceEvidence(source) {
  const receipt = await source.getTransactionReceipt(evidence.sourceEvidence.transactionHash);
  if (!receipt || receipt.status !== 1) throw new Error('source transaction is missing or reverted');
  const matches = receipt.logs
    .map((log, receiptLogIndex) => ({ log, receiptLogIndex }))
    .filter(({ log }) =>
      log.address.toLowerCase() === evidence.venue.emitter.toLowerCase() &&
      log.topics[0] === evidence.venue.topic0,
    );
  const match = matches.find(({ receiptLogIndex }) => receiptLogIndex === evidence.sourceEvidence.receiptLogIndex);
  if (!match) throw new Error('configured Aave collateral event is not present at the recorded receipt index');
  if (receipt.blockNumber !== evidence.sourceEvidence.ethereumBlock) throw new Error('source block mismatch');
  if (match.log.topics[1].toLowerCase() !== ethers.zeroPadValue(evidence.sourceEvidence.asset, 32).toLowerCase()) {
    throw new Error('source asset topic mismatch');
  }
  if (match.log.topics[2].toLowerCase() !== ethers.zeroPadValue(evidence.sourceEvidence.holder, 32).toLowerCase()) {
    throw new Error('source holder topic mismatch');
  }
  return receipt;
}

async function main() {
  const action = process.argv[2] || 'inspect';
  const cc = new ethers.JsonRpcProvider(process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network');
  const source = new ethers.JsonRpcProvider(process.env.ETH_MAINNET_RPC || 'https://eth.drpc.org');
  const read = new ethers.Contract(deployment.encumbranceAdapter, ABI, cc);
  const receipt = await verifySourceEvidence(source);
  const [active, pending, eta, head] = await Promise.all([
    read.venues(evidence.venue.id),
    read.venuePending(evidence.venue.id),
    read.venueEta(evidence.venue.id),
    cc.getBlockNumber(),
  ]);

  const data = new ethers.Contract(evidence.sourceEvidence.dataProvider, DATA_PROVIDER_ABI, source);
  const position = await data.getUserReserveData(
    evidence.sourceEvidence.asset,
    evidence.sourceEvidence.holder,
    { blockTag: evidence.sourceEvidence.stateVerifiedAtEthereumBlock },
  );

  console.log(`Aave V3 collateral evidence ${evidence.sourceEvidence.transactionHash}`);
  console.log(`  Ethereum block ${receipt.blockNumber}, receipt log ${evidence.sourceEvidence.receiptLogIndex}`);
  console.log(`  aToken balance ${position.currentATokenBalance}`);
  console.log(`  enabled as collateral at attested head: ${position.usageAsCollateralEnabled}`);
  console.log(`  CC3 head ${head}; venue ${active.enabled ? 'active' : eta > 0n ? 'queued' : 'not queued'}`);

  if (action === 'inspect') return;

  const wallet = new ethers.Wallet(process.env.TIMELOCK_PRIVATE_KEY || need('PRIVATE_KEY'), cc);
  const adapter = read.connect(wallet);
  const timelock = await read.timelock();
  if (wallet.address.toLowerCase() !== timelock.toLowerCase()) {
    throw new Error(`signer ${wallet.address} is not adapter timelock ${timelock}`);
  }

  if (action === 'queue') {
    if (active.enabled) throw new Error('venue is already active');
    if (eta > 0n) throw new Error(`venue is already queued for ${new Date(Number(eta) * 1000).toISOString()}`);
    const tx = await adapter.queueVenue(evidence.venue.id, evidence.venue, { gasLimit: 350_000 });
    const mined = await tx.wait();
    const newEta = await read.venueEta(evidence.venue.id);
    write({
      governance: {
        status: 'queued',
        queueTransaction: tx.hash,
        queueBlock: mined.blockNumber,
        activationEta: new Date(Number(newEta) * 1000).toISOString(),
      },
    });
    console.log(`  queued on CC3 ${tx.hash}`);
    console.log(`  activation available ${new Date(Number(newEta) * 1000).toISOString()}`);
    return;
  }

  if (action === 'activate') {
    if (active.enabled) throw new Error('venue is already active');
    if (eta === 0n) throw new Error('venue has not been queued');
    if (BigInt(Math.floor(Date.now() / 1000)) < eta) {
      throw new Error(`48-hour venue timelock ends ${new Date(Number(eta) * 1000).toISOString()}`);
    }
    const tx = await adapter.setVenue(evidence.venue.id, { gasLimit: 350_000 });
    const mined = await tx.wait();
    write({ governance: { ...evidence.governance, status: 'active', activationTransaction: tx.hash, activationBlock: mined.blockNumber } });
    console.log(`  activated on CC3 ${tx.hash}`);
    return;
  }

  if (action === 'prove') {
    if (!active.enabled) throw new Error('venue is not active; run activate after the timelock');
    const proofs = new ProofSource(
      evidence.chainKey,
      (process.env.PROOF_BUILDERS || 'https://proof-gen-api.cc3-testnet.creditcoin.network')
        .split(',')
        .map((value) => value.trim()),
    );
    await proofs.waitUntilAttested(receipt.blockNumber);
    const built = await proofs.getProof(receipt.hash);
    const proof = toContractProof(built, evidence.sourceEvidence.receiptLogIndex);
    const tx = await adapter.witnessPledge(evidence.venue.id, proof, { gasLimit: 1_500_000 });
    const mined = await tx.wait();
    const parsed = mined.logs
      .map((log) => { try { return adapter.interface.parseLog(log); } catch (_) { return null; } })
      .find((event) => event?.name === 'LienWitnessed');
    if (!parsed || parsed.args.collateralRef.toLowerCase() !== evidence.collateralRef.toLowerCase()) {
      throw new Error('witness transaction did not emit the expected collateral reference');
    }
    write({ proof: { status: 'witnessed', cc3Transaction: tx.hash, cc3Block: mined.blockNumber } });
    console.log(`  witnessed on CC3 ${tx.hash}`);
    console.log(`  collateralRef ${parsed.args.collateralRef}`);
    return;
  }

  throw new Error('action must be inspect, queue, activate or prove');
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}\n`);
  process.exit(1);
});
