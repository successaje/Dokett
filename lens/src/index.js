#!/usr/bin/env node
'use strict';

/**
 * Covenant Lens entrypoint.
 *
 *   CC3_RPC=... REGISTER_ADDRESS=0x... BOND_ADDRESS=0x... node lens/src/index.js
 *
 * Listens on PORT (default 8787). Re-syncs every SYNC_INTERVAL_MS.
 */

const { ethers } = require('ethers');
const { Index } = require('./indexer');
const { createServer } = require('./api');

const ts = () => new Date().toISOString();
const log = {
  info: (m) => console.log(`${ts()} INFO  ${m}`),
  warn: (m) => console.warn(`${ts()} WARN  ${m}`),
  error: (m) => console.error(`${ts()} ERROR ${m}`),
};

async function main() {
  const rpc = process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network';
  const register = process.env.REGISTER_ADDRESS;
  if (!register) throw new Error('missing required env: REGISTER_ADDRESS');

  const port = Number(process.env.PORT || 8787);
  const interval = Number(process.env.SYNC_INTERVAL_MS || 30_000);

  const provider = new ethers.JsonRpcProvider(rpc);
  const index = new Index(
    provider,
    {
      register,
      bond: process.env.BOND_ADDRESS || null,
      // Without this the first sync scans from genesis and times out.
      deployBlock: process.env.DEPLOY_BLOCK || 0,
      chunk: process.env.LOG_CHUNK || 50_000,
    },
    log,
  );

  const first = await index.sync();
  log.info(`indexed ${first.obligations} obligation(s), ${first.bonds} bond(s) at block ${first.head}`);

  const timer = setInterval(async () => {
    try {
      const r = await index.sync();
      log.info(`resynced: ${r.obligations} obligation(s), ${r.bonds} bond(s) @ ${r.head}`);
    } catch (err) {
      // Serving slightly stale data beats serving none: the index is a
      // projection, and the previous projection is still internally consistent.
      log.error(`sync failed, serving last good index @ ${index.lastBlock}: ${err.message}`);
    }
  }, interval);
  if (timer.unref) timer.unref();

  createServer(index, log).listen(port, () => {
    log.info(`lens listening on http://localhost:${port}`);
    log.info(`  try: curl localhost:${port}/obligations`);
  });
}

main().catch((err) => {
  log.error(err.stack || err.message);
  process.exit(1);
});
