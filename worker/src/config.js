'use strict';

/**
 * Keeper configuration.
 *
 * Every value is overridable by env so the same process can run against CC3
 * testnet, a local anvil fork, or the demo. Nothing here has a production
 * default that would silently point at the wrong chain — CHAIN_KEY in
 * particular is required, because chainkeys are NOT portable between
 * environments (Ethereum mainnet is 3 on CC3 testnet and 1 on CC3 mainnet), and
 * a wrong one verifies proofs against the wrong chain without erroring.
 */

function required(name) {
  const v = process.env[name];
  if (!v) throw new Error(`missing required env: ${name}`);
  return v;
}

const config = {
  // ── chains ──────────────────────────────────────────────────────────────
  creditcoinRpc: process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network',
  sourceRpc: required('ETH_MAINNET_RPC'),
  chainKey: Number(required('CHAIN_KEY')),

  // ── contracts ───────────────────────────────────────────────────────────
  register: required('REGISTER_ADDRESS'),
  verifier: required('VERIFIER_ADDRESS'),
  paymentAdapter: required('PAYMENT_ADAPTER_ADDRESS'),
  silenceAdapter: required('SILENCE_ADAPTER_ADDRESS'),

  // ── signer ──────────────────────────────────────────────────────────────
  privateKey: process.env.KEEPER_PRIVATE_KEY || null,

  /**
   * Proof builders, in preference order.
   *
   * More than one on purpose. A proof builder can censor but never forge —
   * proofs are verified on-chain — so the only thing a bad or dead builder can
   * do is withhold. Since a withheld proof is indistinguishable from a missed
   * payment right up until the cure window closes, withholding IS the attack,
   * and the answer is to never depend on a single endpoint.
   */
  proofBuilders: (process.env.PROOF_BUILDERS ||
    'https://proof-gen-api.cc3-testnet.creditcoin.network')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // ── cadences (ms) ───────────────────────────────────────────────────────

  /**
   * How often to poke the attested head.
   *
   * This is a CORRECTNESS parameter, not a polling preference. AscVerify only
   * permits penalties when the head has been observed advancing with no
   * coverage gap longer than maxSampleGap. Poke slower than that and the
   * protocol correctly refuses to penalise anyone — the keeper's own laziness
   * reads as an oracle outage. Default is well inside the 15-minute gap.
   */
  pokeIntervalMs: Number(process.env.POKE_INTERVAL_MS || 120_000),

  /** Source-chain scan cadence for qualifying repayments. */
  scanIntervalMs: Number(process.env.SCAN_INTERVAL_MS || 30_000),

  /** Delinquency/default sweep cadence. */
  sweepIntervalMs: Number(process.env.SWEEP_INTERVAL_MS || 60_000),

  /**
   * Starting source-chain scan width, halved on refusal until the provider
   * accepts it. 64 suits a high-volume token like USDC; the adaptive retry
   * handles endpoints stricter or looser than that.
   */
  scanChunk: Number(process.env.SCAN_CHUNK || 64),

  /** Start scanning from here if the keeper has no prior cursor. */
  startBlock: process.env.SOURCE_START_BLOCK ? Number(process.env.SOURCE_START_BLOCK) : null,

  dryRun: process.env.DRY_RUN === '1',
};

module.exports = config;
