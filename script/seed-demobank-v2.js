#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const { ethers } = require('ethers');
const { REGISTER } = require('../worker/src/abi');

const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env: ${name}`);
  return value;
};

const deployment = JSON.parse(readFileSync('deployments/102031-v0.2.0.json', 'utf8'));
const provider = new ethers.JsonRpcProvider(need('CC3_RPC'));
const registrar = new ethers.Wallet(need('PRIVATE_KEY'), provider);
const ABI = [
  ...REGISTER,
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
  'function register((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init,uint64 expectedChainId) payable returns (uint256)',
];
const VERIFIER_ABI = ['function attestedHead(uint64 chainKey) view returns (uint64)'];
const register = new ethers.Contract(deployment.register, ABI, registrar);
const verifier = new ethers.Contract(deployment.ascVerifier, VERIFIER_ABI, provider);
const label = 'Dokett v0.2 DemoBank registrar assertion';
const obligor = ethers.keccak256(ethers.toUtf8Bytes(label));
const outputPath = 'deployments/seed-demobank-v0.2.0-102031.json';

async function main() {
  const network = await provider.getNetwork();
  if (network.chainId !== 102031n) throw new Error(`wrong settlement chain: ${network.chainId}`);

  const nextId = await register.nextId();
  for (let id = 1n; id < nextId; id++) {
    const existing = await register.getObligation(id);
    if (existing.obligor === obligor) {
      console.log(`registrar-asserted DemoBank obligation already exists as ${id}`);
      return;
    }
  }

  const head = await verifier.attestedHead(3);
  if (head === 0n) throw new Error('Ethereum attested head is unavailable');
  const sourcePayer = ethers.getAddress(`0x${ethers.keccak256(ethers.toUtf8Bytes(`${label}:payer`)).slice(-40)}`);
  const terms = {
    obligor,
    creditor: ethers.keccak256(ethers.toUtf8Bytes('Dokett v0.2 synthetic creditor')),
    creditorPayout: registrar.address,
    chainKey: 3,
    sourceToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    sourcePayer,
    sourcePayee: registrar.address,
    principal: 6_000n * 1_000_000n,
    periodAmount: 1_500n * 1_000_000n,
    aprBps: 825,
    startHeight: head,
    periodBlocks: 216_000,
    cureBlocks: 50_400,
    periodsTotal: 4,
    seniority: 0,
    collateralRef: ethers.ZeroHash,
  };
  const value = (await register.MIN_REGISTRAR_BOND()) + (await register.MIN_KEEPER_FUND());
  const id = await register.nextId();
  const tx = await register.register(terms, 1, { value, gasLimit: 900_000n });
  const receipt = await tx.wait();
  if (receipt.status !== 1) throw new Error('registrar assertion reverted');

  const output = {
    releaseVersion: 'v0.2.0',
    description: 'Synthetic registrar-asserted record used by the DemoBank provenance policy demonstration',
    register: deployment.register,
    id: id.toString(),
    obligor,
    sourcePayer,
    attestedEthereumHead: head.toString(),
    registrationTransaction: tx.hash,
    registrationBlock: receipt.blockNumber,
  };
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`registered DemoBank assertion ${id}: ${tx.hash}`);
  console.log(`wrote ${outputPath}`);
}

main().catch((error) => {
  console.error(error.shortMessage || error.message);
  process.exit(1);
});
