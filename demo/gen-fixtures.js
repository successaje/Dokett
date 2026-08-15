#!/usr/bin/env node
/**
 * Generates real Ethereum mainnet fixtures for the Foundry test suite.
 *
 * Why real transactions: AscVerify's whole job is to decode a foreign chain's
 * transaction and refuse it when the receipt says it failed. Testing that against
 * hand-rolled bytes would only prove our encoder agrees with our decoder. These
 * fixtures come off mainnet and are encoded with the same SDK the keeper uses.
 *
 * Produces:
 *   fixtures/erc20-transfer-success.json  a successful ERC-20 Transfer
 *   fixtures/tx-reverted.json             a REVERTED transaction (receiptStatus 0)
 *
 * The second one is the regression fixture for the footgun: the BlockProver
 * precompile verifies inclusion, not success, so a reverted transfer is validly
 * included and will verify. If AscVerify ever stops checking receiptStatus, the
 * test using this fixture is what catches it.
 *
 * Usage:  ETH_MAINNET_RPC=https://... node demo/gen-fixtures.js
 */

const fs = require('node:fs');
const path = require('node:path');
const { JsonRpcProvider, Interface } = require('ethers');
// The SDK namespaces its exports (encoding, queryBuilder, proofProvider, …)
// rather than flattening them at the root.
const { encoding } = require('@gluwa/usc-sdk');
const { abiEncode, getTransactionWithRaw } = encoding;

const RPC = process.env.ETH_MAINNET_RPC || 'https://eth.merkle.io';
// Free RPCs bill anything older than a few blocks as an "archive" request, so keep
// the scan shallow by default. Raise both when pointing at a real archive node.
const LOOKBACK = Number(process.env.LOOKBACK || 6);
const SCAN = Number(process.env.SCAN || 24);
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const OUT = path.join(__dirname, 'fixtures');

const erc20 = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const TRANSFER_TOPIC = erc20.getEvent('Transfer').topicHash;

async function encode(provider, txHash) {
  const tx = await getTransactionWithRaw(provider, txHash);
  if (!tx) throw new Error(`tx not found: ${txHash}`);
  const rx = await provider.getTransactionReceipt(txHash);
  if (!rx) throw new Error(`receipt not found: ${txHash}`);
  const { abi, types } = abiEncode(tx, rx);
  return { tx, rx, abi, types };
}

/** A plain EOA -> USDC.transfer with exactly one Transfer log keeps the fixture unambiguous. */
async function findSimpleTransfer(provider, head) {
  for (let n = head; n > head - SCAN; n--) {
    const logs = await provider.getLogs({
      address: USDC,
      topics: [TRANSFER_TOPIC],
      fromBlock: n,
      toBlock: n,
    });
    for (const log of logs) {
      const rx = await provider.getTransactionReceipt(log.transactionHash);
      if (!rx || rx.status !== 1) continue;
      // exactly one log, emitted by USDC: no ambiguity about which log we mean
      if (rx.logs.length !== 1) continue;
      if (rx.to?.toLowerCase() !== USDC.toLowerCase()) continue;
      return log.transactionHash;
    }
  }
  throw new Error('no simple single-log USDC transfer found in the scanned range');
}

/**
 * Reverted transactions are common, but finding one receipt-by-receipt is slow and
 * hammers the RPC. `eth_getBlockReceipts` returns every receipt in a block in one
 * call, so a whole block is a single request.
 */
async function findReverted(provider, head) {
  for (let n = head; n > head - SCAN; n--) {
    let receipts;
    try {
      receipts = await provider.send('eth_getBlockReceipts', ['0x' + n.toString(16)]);
    } catch {
      continue; // endpoint may not support it; try the next block
    }
    if (!Array.isArray(receipts)) continue;
    for (const rx of receipts) {
      if (rx.status === '0x0') return rx.transactionHash;
    }
  }
  throw new Error('no reverted transaction found in the scanned range');
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const provider = new JsonRpcProvider(RPC);

  const net = await provider.getNetwork();
  if (net.chainId !== 1n) {
    throw new Error(`expected Ethereum mainnet (chainId 1), got ${net.chainId}`);
  }
  // Stay well behind the head so the fixtures reference settled history.
  const head = (await provider.getBlockNumber()) - LOOKBACK;
  console.log(`connected: chainId=${net.chainId} scanning from block ${head}`);

  const successHash = await findSimpleTransfer(provider, head);
  const success = await encode(provider, successHash);
  const log = success.rx.logs[0];
  const parsed = erc20.parseLog({ topics: [...log.topics], data: log.data });

  writeFixture('erc20-transfer-success.json', {
    note: 'Real Ethereum mainnet ERC-20 Transfer. Used to prove the happy path decodes.',
    chainId: 1,
    txHash: successHash,
    blockNumber: success.rx.blockNumber,
    txType: success.tx.formatted.type,
    receiptStatus: success.rx.status,
    token: log.address,
    from: parsed.args.from,
    to: parsed.args.to,
    value: parsed.args.value.toString(),
    logIndexInReceipt: 0,
    logCount: success.rx.logs.length,
    encodedTransaction: success.abi,
    etherscan: `https://etherscan.io/tx/${successHash}`,
  });

  const revertedHash = await findReverted(provider, head);
  const reverted = await encode(provider, revertedHash);

  writeFixture('tx-reverted.json', {
    note:
      'Real REVERTED Ethereum mainnet transaction. The BlockProver precompile ' +
      'verifies inclusion, not success — this fixture proves AscVerify rejects it.',
    chainId: 1,
    txHash: revertedHash,
    blockNumber: reverted.rx.blockNumber,
    txType: reverted.tx.formatted.type,
    receiptStatus: reverted.rx.status,
    logCount: reverted.rx.logs.length,
    encodedTransaction: reverted.abi,
    etherscan: `https://etherscan.io/tx/${revertedHash}`,
  });
}

function writeFixture(name, obj) {
  const file = path.join(OUT, name);
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
  const kb = (obj.encodedTransaction.length / 2 / 1024).toFixed(1);
  console.log(`wrote ${name}  tx=${obj.txHash}  status=${obj.receiptStatus}  ${kb}KB`);
}

main().catch((e) => {
  console.error('fixture generation failed:', e.message);
  process.exit(1);
});
