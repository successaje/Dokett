#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const { ethers } = require('ethers');

const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env: ${name}`);
  return value;
};

const version = process.env.RELEASE_VERSION || 'v0.2.0';
const manifestPath = process.env.DEPLOYMENT_FILE || `deployments/102031-${version}.json`;
const deployment = JSON.parse(readFileSync(manifestPath, 'utf8'));
const provider = new ethers.JsonRpcProvider(need('CC3_RPC'));
const registrar = new ethers.Wallet(need('PRIVATE_KEY'), provider);

const REGISTER_ABI = [
  'function nextId() view returns (uint256)',
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
  'function hashTerms((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init) view returns (bytes32)',
  'function registerAuthorized((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init,uint64 expectedChainId,address signer,uint256 nonce,uint256 deadline,bytes signature) payable returns (uint256)',
  'function disputeBySig(uint256 id,bytes32 reasonCode,bytes32 evidenceHash,uint256 nonce,uint256 deadline,bytes signature)',
  'function provenanceOf(uint256 id) view returns (uint8 kind,address signer,bytes32 committedTerms,uint128 registrationBond)',
  'function disputeOf(uint256 id) view returns (address signer,bytes32 reasonCode,bytes32 evidenceHash,uint64 filedAt)',
];
const VERIFIER_ABI = ['function attestedHead(uint64 chainKey) view returns (uint64)'];

const register = new ethers.Contract(deployment.register, REGISTER_ABI, registrar);
const verifier = new ethers.Contract(deployment.ascVerifier, VERIFIER_ABI, provider);

const obligationTypes = {
  ObligationAuthorization: [
    { name: 'termsHash', type: 'bytes32' },
    { name: 'registrar', type: 'address' },
    { name: 'subjectSigner', type: 'address' },
    { name: 'expectedChainId', type: 'uint64' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};
const disputeTypes = {
  DisputeAuthorization: [
    { name: 'obligationId', type: 'uint256' },
    { name: 'reasonCode', type: 'bytes32' },
    { name: 'evidenceHash', type: 'bytes32' },
    { name: 'nonce', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
  ],
};

async function syntheticSubject(label) {
  const signature = await registrar.signMessage(`Dokett ${version} synthetic subject: ${label}`);
  return new ethers.Wallet(ethers.keccak256(signature));
}

async function makeTerms(label, subject, head) {
  return {
    obligor: ethers.keccak256(ethers.solidityPacked(['string', 'address'], [label, subject.address])),
    creditor: ethers.keccak256(ethers.toUtf8Bytes('Dokett v0.2 synthetic creditor')),
    creditorPayout: registrar.address,
    chainKey: 3,
    sourceToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    sourcePayer: subject.address,
    sourcePayee: registrar.address,
    principal: 10_000n * 1_000_000n,
    periodAmount: 2_500n * 1_000_000n,
    aprBps: 725,
    startHeight: head,
    periodBlocks: 216_000,
    cureBlocks: 50_400,
    periodsTotal: 4,
    seniority: 0,
    collateralRef: ethers.ZeroHash,
  };
}

async function registerSubject(label, nonce, head, domain, value) {
  const subject = await syntheticSubject(label);
  const terms = await makeTerms(label, subject, head);
  const termsHash = await register.hashTerms(terms);
  const latest = await provider.getBlock('latest');
  const deadline = BigInt(latest.timestamp + 3600);
  const authorization = {
    termsHash,
    registrar: registrar.address,
    subjectSigner: subject.address,
    expectedChainId: 1,
    nonce,
    deadline,
  };
  const signature = await subject.signTypedData(domain, obligationTypes, authorization);
  const id = await register.nextId();
  const tx = await register.registerAuthorized(terms, 1, subject.address, nonce, deadline, signature, {
    value,
    gasLimit: 1_500_000n,
  });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error(`registration ${id} reverted`);
  return { id, subject, termsHash, tx: tx.hash, block: receipt.blockNumber };
}

async function main() {
  const network = await provider.getNetwork();
  if (network.chainId !== 102031n) throw new Error(`wrong settlement chain: ${network.chainId}`);
  const head = await verifier.attestedHead(3);
  if (head === 0n) throw new Error('Ethereum attested head is unavailable');

  const value = (await register.MIN_REGISTRAR_BOND()) + (await register.MIN_KEEPER_FUND());
  const domain = {
    name: 'Dokett Register',
    version: '1',
    chainId: network.chainId,
    verifyingContract: deployment.register,
  };

  const admitted = await registerSubject('authorized-active', 1n, head, domain, value);
  const disputed = await registerSubject('authorized-disputed', 2n, head, domain, value);

  const reasonCode = ethers.encodeBytes32String('TERMS_CONTESTED');
  const evidenceHash = ethers.keccak256(ethers.toUtf8Bytes('Dokett v0.2 synthetic dispute evidence'));
  const latest = await provider.getBlock('latest');
  const deadline = BigInt(latest.timestamp + 3600);
  const disputeNonce = 3n;
  const signature = await disputed.subject.signTypedData(domain, disputeTypes, {
    obligationId: disputed.id,
    reasonCode,
    evidenceHash,
    nonce: disputeNonce,
    deadline,
  });
  const disputeTx = await register.disputeBySig(
    disputed.id,
    reasonCode,
    evidenceHash,
    disputeNonce,
    deadline,
    signature,
    { gasLimit: 750_000n },
  );
  const disputeReceipt = await disputeTx.wait();
  if (disputeReceipt.status !== 1) throw new Error('dispute reverted');

  const admittedProvenance = await register.provenanceOf(admitted.id);
  const disputedState = await register.disputeOf(disputed.id);
  if (Number(admittedProvenance.kind) !== 1 || admittedProvenance.signer !== admitted.subject.address) {
    throw new Error('authorized provenance did not persist');
  }
  if (disputedState.signer !== disputed.subject.address || disputedState.reasonCode !== reasonCode) {
    throw new Error('authenticated dispute did not persist');
  }

  const out = {
    releaseVersion: version,
    register: deployment.register,
    attestedEthereumHead: head.toString(),
    active: {
      id: admitted.id.toString(),
      obligor: (await makeTerms('authorized-active', admitted.subject, head)).obligor,
      subjectSigner: admitted.subject.address,
      termsHash: admitted.termsHash,
      registrationTransaction: admitted.tx,
      block: admitted.block,
    },
    disputed: {
      id: disputed.id.toString(),
      obligor: (await makeTerms('authorized-disputed', disputed.subject, head)).obligor,
      subjectSigner: disputed.subject.address,
      termsHash: disputed.termsHash,
      registrationTransaction: disputed.tx,
      registrationBlock: disputed.block,
      reasonCode,
      evidenceHash,
      disputeTransaction: disputeTx.hash,
      disputeBlock: disputeReceipt.blockNumber,
    },
  };
  const outPath = `deployments/seed-provenance-${version}-102031.json`;
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);
  console.log(`registered authorized obligation ${out.active.id}: ${out.active.registrationTransaction}`);
  console.log(`registered and disputed obligation ${out.disputed.id}: ${out.disputed.disputeTransaction}`);
  console.log(`wrote ${outPath}`);
}

main().catch((error) => {
  console.error(error.shortMessage || error.message);
  process.exit(1);
});
