'use strict';

const { ethers } = require('ethers');
const { REGISTER, VERIFIER, PAYMENT_ADAPTER, SILENCE_ADAPTER, ERC20 } = require('./abi');
const { ProofSource, toContractProof } = require('./proof');

const STATUS = ['None', 'Active', 'Current', 'Delinquent', 'Default', 'Settled', 'ChargedOff'];
const LIVE = new Set([1, 2, 3]); // Active, Current, Delinquent

const erc20 = new ethers.Interface(ERC20);
const TRANSFER_TOPIC = erc20.getEvent('Transfer').topicHash;

/**
 * The Covenant keeper.
 *
 * Permissionless by design — anyone can run one, and the demo runs two against
 * different proof builders. It does three independent jobs, and the fact that
 * they are independent is the point:
 *
 *   1. POKE   keep the attested-head observation record continuous
 *   2. PROVE  find qualifying repayments and submit them
 *   3. SWEEP  mark delinquencies and finalize defaults
 *
 * (1) runs on its own timer and never waits on (2) or (3). That is a correctness
 * requirement, not tidiness: AscVerify refuses penalties unless the head has been
 * observed advancing without a coverage gap, so a keeper that only poked when it
 * had other work would manufacture gaps and disable the protocol's own
 * enforcement. The watchdog must not share a thread with the work it guards.
 */
class Keeper {
  constructor(config, log = console) {
    this.cfg = config;
    this.log = log;

    this.cc = new ethers.JsonRpcProvider(config.creditcoinRpc);
    this.src = new ethers.JsonRpcProvider(config.sourceRpc);

    this.signer = config.privateKey ? new ethers.Wallet(config.privateKey, this.cc) : null;
    const runner = this.signer || this.cc;

    this.register = new ethers.Contract(config.register, REGISTER, runner);
    this.verifier = new ethers.Contract(config.verifier, VERIFIER, runner);
    this.payment = new ethers.Contract(config.paymentAdapter, PAYMENT_ADAPTER, runner);
    this.silence = new ethers.Contract(config.silenceAdapter, SILENCE_ADAPTER, runner);

    this.proofs = new ProofSource(config.chainKey, config.proofBuilders, log);

    /** @type {Map<string, {id: bigint, o: object}>} keyed by `token|payer|payee` */
    this.watchlist = new Map();
    this.cursor = config.startBlock;
    this.timers = [];
    this.stopped = false;
  }

  /* ───────────────────────────── lifecycle ───────────────────────────── */

  async start() {
    if (!this.signer && !this.cfg.dryRun) {
      throw new Error('KEEPER_PRIVATE_KEY is required unless DRY_RUN=1');
    }

    const net = await this.cc.getNetwork();
    this.log.info(`keeper up · creditcoin chainId=${net.chainId} · sourceChainKey=${this.cfg.chainKey}`);
    if (this.signer) this.log.info(`signer ${await this.signer.getAddress()}`);
    if (this.cfg.dryRun) this.log.warn('DRY_RUN: observing only, no transactions will be sent');

    await this.refreshWatchlist();
    if (this.cursor == null) {
      this.cursor = (await this.src.getBlockNumber()) - this.cfg.scanChunk;
      this.log.info(`no cursor configured; starting ${this.cfg.scanChunk} blocks back at ${this.cursor}`);
    }

    // Poke immediately, then on its own cadence — see the class note.
    await this.safely('poke', () => this.poke());
    this.every(this.cfg.pokeIntervalMs, 'poke', () => this.poke());
    this.every(this.cfg.scanIntervalMs, 'scan', () => this.scan());
    this.every(this.cfg.sweepIntervalMs, 'sweep', () => this.sweep());
  }

  stop() {
    this.stopped = true;
    this.timers.forEach(clearInterval);
    this.timers = [];
  }

  every(ms, name, fn) {
    const t = setInterval(() => this.safely(name, fn), ms);
    if (t.unref) t.unref();
    this.timers.push(t);
  }

  /** One job failing must never take down the others — especially not the poker. */
  async safely(name, fn) {
    try {
      await fn();
    } catch (err) {
      this.log.error(`[${name}] ${err.message}`);
    }
  }

  /* ─────────────────────────────── 1. poke ───────────────────────────── */

  async poke() {
    const [head, enabled, stalled] = await Promise.all([
      this.verifier.attestedHead(this.cfg.chainKey),
      this.verifier.penaltiesEnabled(this.cfg.chainKey),
      this.verifier.attestationStalled(this.cfg.chainKey),
    ]);

    if (stalled) {
      // Worth shouting about: while this is true nothing can be proven OR
      // penalised, and every live cure window is effectively frozen.
      this.log.warn(`attestation stalled for chainKey=${this.cfg.chainKey} at head ${head}`);
    }

    if (this.cfg.dryRun) {
      this.log.info(`[poke] head=${head} penaltiesEnabled=${enabled} (dry run)`);
      return;
    }

    const tx = await this.verifier.pokeHead(this.cfg.chainKey);
    await tx.wait();
    this.log.info(`[poke] head=${head} penaltiesEnabled=${enabled} tx=${tx.hash}`);
  }

  /* ────────────────────────────── watchlist ──────────────────────────── */

  static key(token, payer, payee) {
    return `${token}|${payer}|${payee}`.toLowerCase();
  }

  async refreshWatchlist() {
    const next = await this.register.nextId();
    const list = new Map();

    for (let id = 1n; id < next; id++) {
      const o = await this.register.getObligation(id);
      if (!LIVE.has(Number(o.status))) continue;
      if (Number(o.chainKey) !== this.cfg.chainKey) continue;
      list.set(Keeper.key(o.sourceToken, o.sourcePayer, o.sourcePayee), { id, o });
    }

    this.watchlist = list;
    this.log.info(`watching ${list.size} live obligation(s)`);
  }

  /* ────────────────────────────── 2. prove ───────────────────────────── */

  async scan() {
    await this.refreshWatchlist();
    if (this.watchlist.size === 0) return;

    const head = await this.src.getBlockNumber();
    const conf = Number(await this.verifier.minConfirmations());

    // Never look at blocks shallower than the contract will accept: a proof
    // inside the confirmation window is rejected on-chain, so fetching it early
    // just burns a proof-builder request and risks acting on a reorged log.
    const safeHead = head - conf;
    if (safeHead <= this.cursor) return;

    const to = Math.min(safeHead, this.cursor + this.cfg.scanChunk);
    const tokens = [...new Set([...this.watchlist.values()].map((w) => w.o.sourceToken))];

    const logs = await this.src.getLogs({
      address: tokens,
      topics: [TRANSFER_TOPIC],
      fromBlock: this.cursor + 1,
      toBlock: to,
    });

    for (const log of logs) {
      const parsed = erc20.parseLog(log);
      const hit = this.watchlist.get(Keeper.key(log.address, parsed.args.from, parsed.args.to));
      if (!hit) continue;
      await this.safely(`prove#${hit.id}`, () => this.prove(hit, log, parsed));
    }

    this.cursor = to;
  }

  async prove(hit, log, parsed) {
    const { id, o } = hit;

    if (parsed.args.value < o.periodAmount) {
      this.log.info(`[prove#${id}] skipping ${log.transactionHash}: ${parsed.args.value} < periodAmount`);
      return;
    }

    const [windowStart, windowEnd] = await this.register.windowBounds(id);
    if (BigInt(log.blockNumber) <= windowStart || BigInt(log.blockNumber) > windowEnd) {
      this.log.info(
        `[prove#${id}] skipping ${log.transactionHash}: height ${log.blockNumber} outside window (${windowStart}, ${windowEnd}]`,
      );
      return;
    }

    // The contract indexes into the transaction's OWN receipt logs, not the
    // block-wide log index ethers reports.
    const receipt = await this.src.getTransactionReceipt(log.transactionHash);
    const logIndex = receipt.logs.findIndex((l) => l.index === log.index);
    if (logIndex < 0) throw new Error(`log ${log.index} not found in its own receipt`);

    await this.proofs.waitUntilAttested(log.blockNumber);
    const data = await this.proofs.getProof(log.transactionHash);
    const proof = toContractProof(data, logIndex);

    if (this.cfg.dryRun) {
      this.log.info(`[prove#${id}] would submit ${log.transactionHash} logIndex=${logIndex} (dry run)`);
      return;
    }

    const tx = await this.payment.provePayment(id, proof);
    await tx.wait();
    this.log.info(`[prove#${id}] proved ${log.transactionHash} → ${tx.hash}`);
  }

  /* ────────────────────────────── 3. sweep ───────────────────────────── */

  async sweep() {
    const next = await this.register.nextId();

    for (let id = 1n; id < next; id++) {
      const status = Number(await this.register.statusOf(id));
      if (!LIVE.has(status)) continue;

      if (status === 3) {
        await this.safely(`finalize#${id}`, () => this.tryFinalize(id));
      } else {
        await this.safely(`delinquent#${id}`, () => this.tryMarkDelinquent(id));
      }
    }
  }

  async tryMarkDelinquent(id) {
    const [markable, head, required, liveness] = await this.silence.delinquencyStatus(id);
    if (!markable) {
      if (!liveness) this.log.info(`[sweep#${id}] penalties disabled (liveness); head=${head}`);
      return;
    }

    if (this.cfg.dryRun) {
      this.log.info(`[sweep#${id}] would mark delinquent; head=${head} required=${required} (dry run)`);
      return;
    }

    const tx = await this.silence.markDelinquent(id);
    await tx.wait();
    this.log.info(`[sweep#${id}] marked delinquent → ${tx.hash}`);
  }

  async tryFinalize(id) {
    const [o, enabled, head] = await Promise.all([
      this.register.getObligation(id),
      this.verifier.penaltiesEnabled(this.cfg.chainKey),
      this.verifier.attestedHead(this.cfg.chainKey),
    ]);

    if (!enabled) return; // I7 — the contract would refuse anyway
    const required = o.windowEndHeight + o.cureBlocks;
    if (head < required) return; // cure window still open

    if (this.cfg.dryRun) {
      this.log.info(`[sweep#${id}] would finalize default; head=${head} required=${required} (dry run)`);
      return;
    }

    const tx = await this.silence.finalizeDefault(id);
    await tx.wait();
    this.log.info(`[sweep#${id}] finalized default → ${tx.hash}`);
  }
}

module.exports = { Keeper, STATUS, LIVE, TRANSFER_TOPIC };
