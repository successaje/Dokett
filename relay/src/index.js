#!/usr/bin/env node
'use strict';

/**
 * Covenant cure relay.
 *
 *   RELAY_PRIVATE_KEY=0x… CHAIN_KEY=3 REGISTER_ADDRESS=0x… VERIFIER_ADDRESS=0x… \
 *   PAYMENT_ADAPTER_ADDRESS=0x… ETH_MAINNET_RPC=… node relay/src/index.js
 *
 * A deliberately single-purpose service. It exposes exactly one write endpoint,
 * which can only ever call `provePayment` on the configured adapter — it is not
 * a general transaction service, and it holds a funded key, so the narrower its
 * surface the better.
 *
 * Kept out of the Lens on purpose: the Lens is a read-only projection anyone can
 * rebuild, and giving it a funded key and a POST route would destroy the
 * property that makes it credible.
 */

const http = require('node:http');
const { ethers } = require('ethers');
const { Relay, RelayError } = require('./relay');
const { Faucet, FaucetError } = require('./faucet');

const ts = () => new Date().toISOString();
const log = {
  info: (m) => console.log(`${ts()} INFO  ${m}`),
  warn: (m) => console.warn(`${ts()} WARN  ${m}`),
  error: (m) => console.error(`${ts()} ERROR ${m}`),
};

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env: ${name}`);
  return v;
}

const config = {
  creditcoinRpc: process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network',
  sourceRpc: required('ETH_MAINNET_RPC'),
  chainKey: Number(required('CHAIN_KEY')),
  register: required('REGISTER_ADDRESS'),
  verifier: required('VERIFIER_ADDRESS'),
  paymentAdapter: required('PAYMENT_ADAPTER_ADDRESS'),
  privateKey: required('RELAY_PRIVATE_KEY'),
  proofBuilders: (process.env.PROOF_BUILDERS || 'https://proof-gen-api.cc3-testnet.creditcoin.network')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  rateWindowMs: Number(process.env.RELAY_RATE_WINDOW_MS || 60_000),
  rateMax: Number(process.env.RELAY_RATE_MAX || 5),
  attestTimeoutMs: Number(process.env.RELAY_ATTEST_TIMEOUT_MS || 120_000),
  /** Refuse to start below this, rather than fail at the moment someone needs it. */
  minBalanceCtc: process.env.RELAY_MIN_BALANCE_CTC || '1',

  /*
   * Faucet. Optional: with no FAUCET_PRIVATE_KEY the endpoint simply is not
   * mounted, and the cure relay runs exactly as before. A clone of this repo
   * should not need a faucet key to have a working cure path.
   */
  faucetPrivateKey: process.env.FAUCET_PRIVATE_KEY || null,
  mockUsdc: process.env.MOCK_USDC_ADDRESS || null,
  faucetCtc: process.env.FAUCET_CTC || '3',
  faucetUsdc: process.env.FAUCET_USDC || '2000',
  faucetCooldownMs: Number(process.env.FAUCET_COOLDOWN_MS || 6 * 60 * 60 * 1000),
};

const relay = new Relay(config, log);

const faucet =
  config.faucetPrivateKey && config.mockUsdc ? new Faucet(config, log) : null;

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (c) => {
      raw += c;
      if (raw.length > limit) {
        reject(new RelayError('Request body too large', 413));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new RelayError('Body must be JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const send = (code, body) => {
    res.writeHead(code, {
      'content-type': 'application/json',
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'content-type',
      'access-control-allow-methods': 'POST, GET, OPTIONS',
    });
    res.end(JSON.stringify(body, null, 2));
  };

  if (req.method === 'OPTIONS') return send(204, {});

  const path = new URL(req.url, 'http://localhost').pathname;

  if (req.method === 'GET' && path === '/health') {
    const bal = await relay.balance().catch(() => null);
    const fBal = faucet ? await faucet.balance().catch(() => null) : null;
    return send(200, {
      ok: bal !== null,
      relay: relay.address(),
      balanceCtc: bal === null ? null : ethers.formatEther(bal),
      chainKey: config.chainKey,
      faucet: faucet
        ? { address: faucet.address(), balanceCtc: fBal === null ? null : ethers.formatEther(fBal) }
        : null,
    });
  }

  if (req.method === 'POST' && path === '/cure') {
    try {
      const body = await readBody(req);
      const ip =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown';

      const result = await relay.cure({ ...body, ip });
      return send(200, { ok: true, ...result });
    } catch (err) {
      const status = err instanceof RelayError ? err.status : 500;
      if (status >= 500) log.error(err.stack || err.message);
      else log.warn(`[cure] rejected: ${err.message}`);

      return send(status, {
        ok: false,
        error: err.message,
        // Restated on every failure: the relay is a convenience, not a gate.
        alternative:
          'Anyone can submit this proof directly by calling provePayment on the PaymentAdapter. The relay only pays the gas.',
      });
    }
  }

  if (req.method === 'POST' && path === '/faucet') {
    if (!faucet) {
      return send(501, {
        ok: false,
        error: 'faucet not configured on this deployment',
      });
    }
    try {
      const body = await readBody(req);
      const ip =
        (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
        req.socket.remoteAddress ||
        'unknown';
      const result = await faucet.claim({ ...body, ip });
      return send(200, { ok: true, ...result });
    } catch (err) {
      const status = err instanceof FaucetError ? err.status : 500;
      if (status >= 500) log.error(err.stack || err.message);
      else log.warn(`[faucet] rejected: ${err.message}`);
      return send(status, { ok: false, error: err.message });
    }
  }

  send(404, {
    error: 'not found',
    endpoints: ['GET /health', 'POST /cure', ...(faucet ? ['POST /faucet'] : [])],
  });
});

async function main() {
  const bal = await relay.balance();
  const min = ethers.parseEther(config.minBalanceCtc);

  log.info(`relay signer ${relay.address()}`);
  log.info(`balance      ${ethers.formatEther(bal)} CTC`);

  if (bal < min) {
    // Starting broke means the first borrower to need help gets an opaque
    // failure at the worst possible moment. Fail now, loudly, instead.
    throw new Error(
      `relay balance ${ethers.formatEther(bal)} CTC is below RELAY_MIN_BALANCE_CTC=${config.minBalanceCtc}. ` +
        `Fund ${relay.address()} before starting.`,
    );
  }

  const port = Number(process.env.RELAY_PORT || 8788);
  server.listen(port, () => {
    log.info(`cure relay on http://localhost:${port}`);
    log.info(`  POST /cure   { "obligationId": "3", "txHash": "0x…" }`);
    if (faucet) log.info(`  POST /faucet { "address": "0x…" }  signer ${faucet.address()}`);
    else log.info('  faucet not mounted (no FAUCET_PRIVATE_KEY / MOCK_USDC_ADDRESS)');
  });
}

main().catch((err) => {
  log.error(err.message);
  process.exit(1);
});
