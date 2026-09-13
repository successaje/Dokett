#!/usr/bin/env node
'use strict';

const { readFileSync, writeFileSync } = require('node:fs');
const { ethers } = require('ethers');

const need = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`missing required env: ${name}`);
  return value;
};

async function main() {
  const version = need('RELEASE_VERSION');
  const sourceCommit = need('SOURCE_COMMIT');
  if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error('RELEASE_VERSION must be a semantic version such as v0.2.0');
  }
  if (!/^[0-9a-f]{40}$/i.test(sourceCommit)) throw new Error('SOURCE_COMMIT must be a full git commit');

  const chainId = 102031;
  const broadcastPath = `broadcast/Deploy.s.sol/${chainId}/run-latest.json`;
  const broadcast = JSON.parse(readFileSync(broadcastPath, 'utf8'));
  const provider = new ethers.JsonRpcProvider(need('CC3_RPC'));

  const names = {
    AscVerifier: 'ascVerifier',
    Register: 'register',
    Bond: 'bond',
    PaymentAdapter: 'paymentAdapter',
    SilenceAdapter: 'silenceAdapter',
    EncumbranceAdapter: 'encumbranceAdapter',
  };
  const contracts = {};
  const transactions = {};
  let deployBlock = null;

  for (const transaction of broadcast.transactions || []) {
    if (!transaction.hash) continue;
    const receipt = await provider.getTransactionReceipt(transaction.hash);
    if (!receipt || receipt.status !== 1) throw new Error(`transaction not successful: ${transaction.hash}`);
    deployBlock = deployBlock === null ? receipt.blockNumber : Math.min(deployBlock, receipt.blockNumber);

    const key = names[transaction.contractName];
    if (key && transaction.contractAddress) {
      contracts[key] = transaction.contractAddress;
      transactions[key] = transaction.hash;
    } else if (transaction.function?.startsWith('initialize(')) {
      transactions.initialize = transaction.hash;
    }
  }

  for (const key of Object.values(names)) {
    if (!contracts[key]) throw new Error(`successful broadcast is missing ${key}`);
  }
  if (!transactions.initialize) throw new Error('successful broadcast is missing verifier initialization');

  const deployment = {
    releaseVersion: version,
    sourceCommit,
    chainId,
    chainKey: Number(need('CHAIN_KEY')),
    expectedChainId: Number(process.env.EXPECTED_CHAIN_ID || 1),
    deployBlock,
    ...contracts,
    timelock: process.env.TIMELOCK || ethers.ZeroAddress,
    collateral: process.env.COLLATERAL || ethers.ZeroAddress,
    minConfirmations: Number(process.env.MIN_CONFIRMATIONS || 64),
    maxSampleGap: Number(process.env.MAX_SAMPLE_GAP || 900),
    recoveryGrace: Number(process.env.RECOVERY_GRACE || 3600),
    transactions,
  };
  const outPath = `deployments/${chainId}-${version}.json`;
  writeFileSync(outPath, `${JSON.stringify(deployment, null, 2)}\n`, { flag: 'wx' });
  console.log(`wrote immutable deployment manifest ${outPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
