#!/usr/bin/env node
'use strict';

/**
 * Covenant keeper entrypoint.
 *
 *   ETH_MAINNET_RPC=... CHAIN_KEY=3 REGISTER_ADDRESS=0x... \
 *   VERIFIER_ADDRESS=0x... PAYMENT_ADAPTER_ADDRESS=0x... \
 *   SILENCE_ADAPTER_ADDRESS=0x... KEEPER_PRIVATE_KEY=0x... \
 *   node worker/src/index.js
 *
 * Add DRY_RUN=1 to observe without sending transactions.
 */

const config = require('./config');
const { Keeper } = require('./keeper');

const ts = () => new Date().toISOString();
const log = {
  info: (m) => console.log(`${ts()} INFO  ${m}`),
  warn: (m) => console.warn(`${ts()} WARN  ${m}`),
  error: (m) => console.error(`${ts()} ERROR ${m}`),
};

async function main() {
  const keeper = new Keeper(config, log);
  await keeper.start();

  const shutdown = (sig) => {
    log.info(`${sig} received, stopping`);
    keeper.stop();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Timers are unref'd so they never hold the loop open on their own; this does.
  await new Promise(() => {});
}

main().catch((err) => {
  log.error(err.stack || err.message);
  process.exit(1);
});
