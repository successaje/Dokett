'use strict';

/**
 * Relay validation tests.
 *
 * The relay holds a funded key, so every one of these is a test about not
 * spending it. An endpoint that fetches a proof and broadcasts before checking
 * whether the obligation is even curable is a faucet with extra steps.
 *
 *   node --test "relay/test/*.test.js"
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { ethers } = require('ethers');
const { Relay, RelayError } = require('../src/relay');

const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const PAYER = '0x1111111111111111111111111111111111111111';
const PAYEE = '0x2222222222222222222222222222222222222222';
const TX = '0x' + '11'.repeat(32);

// Anvil's first well-known key. Never funded anywhere real.
const TEST_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const erc20 = new ethers.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function transferLog(over = {}) {
  const from = over.from ?? PAYER;
  const to = over.to ?? PAYEE;
  const value = over.value ?? 1_000_000_000n;
  const encoded = erc20.encodeEventLog('Transfer', [from, to, value]);
  return { address: over.address ?? TOKEN, topics: encoded.topics, data: encoded.data };
}

function obligation(over = {}) {
  return {
    status: 3, // Delinquent
    chainKey: 3,
    sourceToken: TOKEN,
    sourcePayer: PAYER,
    sourcePayee: PAYEE,
    periodAmount: 1_000_000_000n,
    ...over,
  };
}

/** A relay with every network edge stubbed. */
function makeRelay({ o = obligation(), receipt, bounds = [900n, 1100n], head = 2000, minConf = 64 } = {}) {
  const relay = new Relay(
    {
      creditcoinRpc: 'http://127.0.0.1:1',
      sourceRpc: 'http://127.0.0.1:1',
      chainKey: 3,
      register: ethers.ZeroAddress,
      verifier: ethers.ZeroAddress,
      paymentAdapter: ethers.ZeroAddress,
      privateKey: TEST_KEY,
      proofBuilders: ['http://127.0.0.1:1'],
      rateWindowMs: 60_000,
      rateMax: 5,
      attestTimeoutMs: 1000,
    },
    { info() {}, warn() {}, error() {} },
  );

  relay.register = {
    getObligation: async () => o,
    windowBounds: async () => bounds,
  };
  relay.verifier = { minConfirmations: async () => BigInt(minConf) };
  relay.src = {
    getTransactionReceipt: async () => receipt,
    getBlockNumber: async () => head,
  };
  relay.payment = {
    provePayment: Object.assign(async () => ({ hash: '0xdead', wait: async () => {} }), {
      staticCall: async () => {},
    }),
  };
  relay.proofs = {
    waitUntilAttested: async () => 'stub',
    getProof: async () => ({
      chainKey: 3,
      headerNumber: receipt.blockNumber,
      txIndex: 0,
      txBytes: '0x00',
      merkleProof: { root: ethers.ZeroHash, siblings: [] },
      continuityProof: { lowerEndpointDigest: ethers.ZeroHash, roots: [] },
    }),
  };

  return relay;
}

const goodReceipt = { status: 1, blockNumber: 1000, logs: [transferLog()] };

/* ─────────────────────────────── input ─────────────────────────────── */

test('rejects a malformed obligation id', async () => {
  const r = makeRelay({ receipt: goodReceipt });
  await assert.rejects(() => r.cure({ obligationId: 'abc', txHash: TX }), /positive integer/);
});

test('rejects a malformed transaction hash', async () => {
  const r = makeRelay({ receipt: goodReceipt });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: '0x1234' }), /32-byte hex/);
});

/* ───────────────────────── curability ──────────────────────────────── */

/** Paying gas to "cure" something that is already Current is pure waste. */
test('refuses an obligation that is not delinquent', async () => {
  const r = makeRelay({ o: obligation({ status: 2 }), receipt: goodReceipt });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /is Current, not Delinquent/);
});

test('refuses an unregistered obligation', async () => {
  const r = makeRelay({ o: obligation({ status: 0 }), receipt: goodReceipt });
  await assert.rejects(() => r.cure({ obligationId: '9', txHash: TX }), /not registered/);
});

test('refuses an obligation on a different source chain', async () => {
  const r = makeRelay({ o: obligation({ chainKey: 1 }), receipt: goodReceipt });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /this relay serves 3/);
});

/* ───────────────────────── the transaction ─────────────────────────── */

test('refuses a reverted transaction before spending anything', async () => {
  const r = makeRelay({ receipt: { status: 0, blockNumber: 1000, logs: [] } });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /reverted/);
});

/**
 * THE ONE THAT MATTERS. Without this, anyone could point any unrelated
 * transaction at any delinquent obligation and make the relay pay to discover
 * that the contract rejects it.
 */
test('refuses a transaction whose transfer does not match the obligation', async () => {
  const wrongPayee = { status: 1, blockNumber: 1000, logs: [transferLog({ to: ethers.ZeroAddress })] };
  const r = makeRelay({ receipt: wrongPayee });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /no transfer matching/);
});

test('refuses a transfer below one period', async () => {
  const tooSmall = { status: 1, blockNumber: 1000, logs: [transferLog({ value: 1n })] };
  const r = makeRelay({ receipt: tooSmall });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /no transfer matching/);
});

test('refuses a transfer of the wrong token', async () => {
  const wrongToken = { status: 1, blockNumber: 1000, logs: [transferLog({ address: ethers.ZeroAddress })] };
  const r = makeRelay({ receipt: wrongToken });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /no transfer matching/);
});

/* ─────────────────────────── the window ────────────────────────────── */

/**
 * A cure proves a payment made INSIDE the window that was missed. A later
 * payment is a real payment, but it does not undo this delinquency.
 */
test('refuses a payment made after the window closed', async () => {
  const late = { status: 1, blockNumber: 1200, logs: [transferLog()] };
  const r = makeRelay({ receipt: late });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /outside the missed window/);
});

test('refuses a payment made before the window opened', async () => {
  const early = { status: 1, blockNumber: 800, logs: [transferLog()] };
  const r = makeRelay({ receipt: early });
  await assert.rejects(() => r.cure({ obligationId: '1', txHash: TX }), /outside the missed window/);
});

test('refuses a payment without enough confirmations, and says how long to wait', async () => {
  const r = makeRelay({ receipt: goodReceipt, head: 1010 });
  await assert.rejects(
    () => r.cure({ obligationId: '1', txHash: TX }),
    (err) => err.status === 425 && /minutes/.test(err.message),
  );
});

/* ──────────────────────────── happy path ───────────────────────────── */

test('submits when everything checks out', async () => {
  const r = makeRelay({ receipt: goodReceipt });
  const res = await r.cure({ obligationId: '1', txHash: TX });

  assert.equal(res.txHash, '0xdead');
  assert.equal(res.obligationId, '1');
  assert.equal(res.provenHeight, 1000);
});

/* ───────────────────────── abuse resistance ────────────────────────── */

test('rate limits a single caller', async () => {
  const r = makeRelay({ receipt: goodReceipt });

  // Distinct hashes so the in-flight de-dupe is not what stops it — and
  // deliberately not colliding with TX, which the assertion below reuses.
  for (let i = 0; i < 5; i++) {
    await r.cure({ obligationId: '1', txHash: '0x' + 'a'.repeat(63) + i, ip: 'x' }).catch(() => {});
  }
  await assert.rejects(
    () => r.cure({ obligationId: '1', txHash: TX, ip: 'x' }),
    (err) => err.status === 429,
  );
});

/** A double-click must not pay gas twice. */
test('de-dupes identical concurrent requests', async () => {
  const r = makeRelay({ receipt: goodReceipt });
  let sends = 0;
  r.payment.provePayment = Object.assign(
    async () => {
      sends += 1;
      return { hash: '0xdead', wait: async () => {} };
    },
    { staticCall: async () => {} },
  );

  const [a, b] = await Promise.all([
    r.cure({ obligationId: '1', txHash: TX }),
    r.cure({ obligationId: '1', txHash: TX }),
  ]);

  assert.equal(sends, 1, 'only one transaction should be broadcast');
  assert.deepEqual(a, b);
});

test('RelayError carries an HTTP status', () => {
  assert.equal(new RelayError('x').status, 400);
  assert.equal(new RelayError('x', 429).status, 429);
});
