'use strict';

const { ethers } = require('ethers');
const { REGISTER, VERIFIER, PAYMENT_ADAPTER, ERC20 } = require('../../worker/src/abi');
const { ProofSource, toContractProof } = require('../../worker/src/proof');

const erc20 = new ethers.Interface(ERC20);
const TRANSFER_TOPIC = erc20.getEvent('Transfer').topicHash;
const STATUS = ['None', 'Active', 'Current', 'Delinquent', 'Default', 'Settled', 'ChargedOff'];
const DELINQUENT = 3;

/** Thrown for anything the caller could fix. Carries an HTTP status. */
class RelayError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * The cure relay.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Curing a delinquency is permissionless — the contract admits a proof on the
 * source height it binds to, never on who sent it. But submitting still costs
 * gas on Creditcoin, and the person who most needs to cure is exactly the person
 * least likely to hold CTC. Without a relay, "anyone can cure" is true in theory
 * and false for the borrower.
 *
 * ─── WHAT IT CAN AND CANNOT DO ─────────────────────────────────────────────
 *
 * It can only CENSOR, never FORGE. Every proof it submits is verified
 * independently by the BlockProver precompile and matched against the
 * obligation's own binding, so a compromised relay cannot fabricate a payment,
 * cure the wrong obligation, or move any other status. The worst it can do is
 * refuse to help — which is why the Console tells the borrower they can always
 * submit directly, and why the relay is a convenience rather than a dependency.
 *
 * ─── WHY IT VALIDATES BEFORE IT SPENDS ─────────────────────────────────────
 *
 * The relay pays for every transaction it sends, so an unvalidated endpoint is a
 * faucet for draining its own gas. Everything checkable off-chain is checked
 * before a proof is fetched and long before anything is broadcast: the
 * obligation must exist, be delinquent, be on the configured chain, and the
 * transaction must contain a transfer that actually matches the obligation's
 * binding at a height inside the missed window.
 *
 * It also never accepts a caller-supplied proof. It builds the proof itself from
 * a transaction hash, because accepting proof bytes would let anyone hand it
 * arbitrary payloads to burn gas on.
 */
class Relay {
  constructor(config, log = console) {
    this.cfg = config;
    this.log = log;

    this.cc = new ethers.JsonRpcProvider(config.creditcoinRpc);
    this.src = new ethers.JsonRpcProvider(config.sourceRpc);
    this.wallet = new ethers.Wallet(config.privateKey, this.cc);

    this.register = new ethers.Contract(config.register, REGISTER, this.cc);
    this.verifier = new ethers.Contract(config.verifier, VERIFIER, this.cc);
    this.payment = new ethers.Contract(config.paymentAdapter, PAYMENT_ADAPTER, this.wallet);

    this.proofs = new ProofSource(config.chainKey, config.proofBuilders, log);

    /** In-flight de-dupe: the same cure submitted twice must not pay gas twice. */
    this.inFlight = new Map();
    /** Crude per-IP budget. Enough to stop casual draining; not a WAF. */
    this.spend = new Map();
  }

  address() {
    return this.wallet.address;
  }

  async balance() {
    return this.cc.getBalance(this.wallet.address);
  }

  /* ───────────────────────────── rate limiting ──────────────────────────── */

  budget(ip) {
    const now = Date.now();
    const win = this.cfg.rateWindowMs;
    const entry = this.spend.get(ip);

    if (!entry || now - entry.since > win) {
      this.spend.set(ip, { since: now, count: 1 });
      return;
    }
    if (entry.count >= this.cfg.rateMax) {
      throw new RelayError(
        `Too many cure attempts from this address. Anyone can still submit directly — the relay is a convenience, not the only route.`,
        429,
      );
    }
    entry.count += 1;
  }

  /* ─────────────────────────────── the cure ─────────────────────────────── */

  /**
   * Validate a claimed payment and, if it holds up, submit the proof.
   * @returns {Promise<{txHash: string, obligationId: string, provenHeight: number}>}
   */
  async cure({ obligationId, txHash, ip = 'unknown' }) {
    if (!/^\d+$/.test(String(obligationId))) {
      throw new RelayError('obligationId must be a positive integer');
    }
    if (!/^0x[0-9a-fA-F]{64}$/.test(String(txHash))) {
      throw new RelayError('txHash must be a 32-byte hex string');
    }

    const key = `${obligationId}:${txHash.toLowerCase()}`;
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    this.budget(ip);

    const work = this._cure(obligationId, txHash).finally(() => {
      // Held briefly after settling so a double-click cannot pay twice.
      setTimeout(() => this.inFlight.delete(key), 15_000);
    });

    this.inFlight.set(key, work);
    return work;
  }

  async _cure(obligationId, txHash) {
    // ── 1. the obligation must exist, and be curable ────────────────────
    const o = await this.register.getObligation(obligationId).catch(() => null);
    if (!o || Number(o.status) === 0) {
      throw new RelayError(`Obligation ${obligationId} is not registered`, 404);
    }
    if (Number(o.status) !== DELINQUENT) {
      throw new RelayError(
        `Obligation ${obligationId} is ${STATUS[Number(o.status)]}, not Delinquent — there is nothing to cure.`,
      );
    }
    if (Number(o.chainKey) !== this.cfg.chainKey) {
      throw new RelayError(
        `Obligation ${obligationId} settles on chainKey ${o.chainKey}; this relay serves ${this.cfg.chainKey}.`,
      );
    }

    // ── 2. the transaction must exist and have succeeded ────────────────
    const receipt = await this.src.getTransactionReceipt(txHash);
    if (!receipt) throw new RelayError('No such transaction on the source chain', 404);
    if (receipt.status !== 1) {
      // The contract would reject this anyway; refusing here saves the gas.
      throw new RelayError('That transaction reverted, so it paid nothing');
    }

    // ── 3. it must contain a transfer matching THIS obligation ──────────
    const logIndex = receipt.logs.findIndex((l) => {
      if (l.address.toLowerCase() !== o.sourceToken.toLowerCase()) return false;
      if (l.topics[0] !== TRANSFER_TOPIC) return false;
      try {
        const parsed = erc20.parseLog({ topics: [...l.topics], data: l.data });
        return (
          parsed.args.from.toLowerCase() === o.sourcePayer.toLowerCase() &&
          parsed.args.to.toLowerCase() === o.sourcePayee.toLowerCase() &&
          parsed.args.value >= o.periodAmount
        );
      } catch {
        return false;
      }
    });

    if (logIndex < 0) {
      throw new RelayError(
        'That transaction contains no transfer matching this obligation — check the token, the payer, the payee, and that the amount is at least one period.',
      );
    }

    // ── 4. the payment must land inside the missed window ───────────────
    const [windowStart, windowEnd] = await this.register.windowBounds(obligationId);
    const height = BigInt(receipt.blockNumber);
    if (height <= windowStart || height > windowEnd) {
      throw new RelayError(
        `That payment is at height ${height}, outside the missed window (${windowStart}, ${windowEnd}]. ` +
          `A cure must prove a payment made inside the window that was missed.`,
      );
    }

    // ── 5. confirmation depth, per the contract's own rule ──────────────
    const head = await this.src.getBlockNumber();
    const minConf = Number(await this.verifier.minConfirmations());
    const confirmations = head - receipt.blockNumber;
    if (confirmations < minConf) {
      throw new RelayError(
        `Only ${confirmations} confirmations; ${minConf} are required. Try again in about ${
          Math.ceil(((minConf - confirmations) * 12) / 60)
        } minutes.`,
        425,
      );
    }

    // ── 6. build the proof ourselves, never accept one ──────────────────
    await this.proofs.waitUntilAttested(receipt.blockNumber, {
      pollIntervalMs: 5_000,
      timeoutMs: this.cfg.attestTimeoutMs,
    });
    const data = await this.proofs.getProof(txHash);
    const proof = toContractProof(data, logIndex);

    // ── 7. simulate, so a revert costs nothing ──────────────────────────
    try {
      await this.payment.provePayment.staticCall(obligationId, proof);
    } catch (err) {
      throw new RelayError(
        `The registry would reject this proof: ${err.shortMessage ?? err.message}`,
        422,
      );
    }

    // ── 8. submit ───────────────────────────────────────────────────────
    const tx = await this.payment.provePayment(obligationId, proof);
    this.log.info(`[cure] obligation ${obligationId} <- ${txHash} :: ${tx.hash}`);
    await tx.wait();

    return {
      txHash: tx.hash,
      obligationId: String(obligationId),
      provenHeight: receipt.blockNumber,
    };
  }
}

module.exports = { Relay, RelayError };
