#!/usr/bin/env node
'use strict';

const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');

const version = process.env.RELEASE_VERSION;
const manifestPath = process.env.DEPLOYMENT_FILE || (version ? `deployments/102031-${version}.json` : '');
if (!manifestPath) throw new Error('set DEPLOYMENT_FILE or RELEASE_VERSION');

const deployment = JSON.parse(readFileSync(manifestPath, 'utf8'));
const contracts = [
  ['ascVerifier', 'src/AscVerifier.sol:AscVerifier'],
  ['register', 'src/Register.sol:Register'],
  ['bond', 'src/Bond.sol:Bond'],
  ['paymentAdapter', 'src/adapters/PaymentAdapter.sol:PaymentAdapter'],
  ['silenceAdapter', 'src/adapters/SilenceAdapter.sol:SilenceAdapter'],
  ['encumbranceAdapter', 'src/adapters/EncumbranceAdapter.sol:EncumbranceAdapter'],
];

for (const [key, contract] of contracts) {
  const address = deployment[key];
  if (!address) throw new Error(`${manifestPath} is missing ${key}`);
  const result = spawnSync('bash', ['script/verify.sh', address, contract], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
