'use strict';

/**
 * Testnet faucet — the thing that makes the write paths reachable by a stranger.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Curing is gas-sponsored, so anyone can do it with nothing. Every OTHER write
 * path needs the caller to hold assets of their own: registering posts a CTC
 * registrar bond, and underwriting stakes real collateral. A visitor arriving
 * with an empty testnet wallet cannot do either, which is what kept those flows
 * out of the Console — not the contracts, which have been deployed and callable
 * all along.
 *
 * One call hands over both halves: CTC for gas and bonds, and mUSDC to
 * underwrite with. `MockUSDC.mint` is public and unpermissioned, so minting on
 * someone's behalf grants nothing they could not have done themselves — it just
 * saves them a transaction they had no gas to send.
 *
 * ─── WHY A SEPARATE KEY ────────────────────────────────────────────────────
 *
 * The relay's docstring calls it "a deliberately single-purpose service", and
 * that principle is about blast radius, not endpoint count. Sharing the cure
 * key would mean anyone draining the faucet also stops every borrower from
 * curing — turning a nuisance into an outage on the one path that must not
 * fail. With its own key, a drained faucet is exactly a drained faucet.
 *
 * Everything below is testnet play money. The caps exist to keep the faucet
 * useful for the next person, not because the funds are worth defending.
 */

const { ethers } = require('ethers');

class FaucetError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const TOKEN_ABI = [
  'function mint(address to, uint256 amount)',
  'function balanceOf(address) view returns (uint256)',
];

class Faucet {
  constructor(cfg, log) {
    this.cfg = cfg;
    this.log = log;
    this.provider = new ethers.JsonRpcProvider(cfg.creditcoinRpc);
    this.wallet = new ethers.Wallet(cfg.faucetPrivateKey, this.provider);
    this.token = new ethers.Contract(cfg.mockUsdc, TOKEN_ABI, this.wallet);

    /** address → timestamp of last drip. In-memory by design: see `claim`. */
    this.seen = new Map();
    /** Serialises sends so two concurrent claims cannot reuse a nonce. */
    this.queue = Promise.resolve();
  }

  address() {
    return this.wallet.address;
  }

  balance() {
    return this.provider.getBalance(this.wallet.address);
  }

  /**
   * A single drip.
   *
   * Cooldown state is in memory rather than a store, which means a redeploy
   * resets it. That is an accepted trade for testnet play money: the
   * alternative is a database this service otherwise does not need, and the
   * worst case is someone claiming twice across a deploy.
   */
  async claim({ address, ip }) {
    if (typeof address !== 'string' || !ethers.isAddress(address)) {
      throw new FaucetError('address must be a valid 0x-prefixed address');
    }
    const to = ethers.getAddress(address);

    const now = Date.now();
    const last = this.seen.get(to.toLowerCase());
    if (last && now - last < this.cfg.faucetCooldownMs) {
      const mins = Math.ceil((this.cfg.faucetCooldownMs - (now - last)) / 60_000);
      throw new FaucetError(`already funded this address; try again in ${mins} minute(s)`, 429);
    }

    const funded = await this.balance();
    const drip = ethers.parseEther(this.cfg.faucetCtc);
    if (funded < drip * 2n) {
      throw new FaucetError('faucet is empty — please report this', 503);
    }

    // Don't top up someone who is already able to transact. Keeps the faucet
    // useful for people who actually need it.
    const theirs = await this.provider.getBalance(to);
    const needsCtc = theirs < drip;

    return this.enqueue(async () => {
      const out = { address: to, ctcSent: '0', musdcMinted: '0' };

      if (needsCtc) {
        const tx = await this.wallet.sendTransaction({ to, value: drip });
        await tx.wait();
        out.ctcSent = this.cfg.faucetCtc;
        out.ctcTx = tx.hash;
      }

      const amount = ethers.parseUnits(this.cfg.faucetUsdc, 6);
      const mint = await this.token.mint(to, amount);
      await mint.wait();
      out.musdcMinted = this.cfg.faucetUsdc;
      out.musdcTx = mint.hash;
      out.token = this.cfg.mockUsdc;

      this.seen.set(to.toLowerCase(), Date.now());
      this.log.info(`[faucet] ${to} ← ${out.ctcSent} CTC, ${out.musdcMinted} mUSDC (ip ${ip})`);
      return out;
    });
  }

  /** Serialise: concurrent sends from one key race on nonce and one will fail. */
  enqueue(fn) {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => {});
    return run;
  }
}

module.exports = { Faucet, FaucetError };
