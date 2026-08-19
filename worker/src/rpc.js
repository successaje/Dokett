'use strict';

const { ethers } = require('ethers');

/**
 * A source-chain provider that fails over across RPC endpoints, never fans a
 * single call out to more than one.
 *
 * ethers ships its own FallbackProvider, and it is the wrong tool here. It is
 * built for QUORUM — querying several providers per call to agree on an
 * answer, defending against one of them lying. That is not the failure mode
 * we hit. A free-tier endpoint under sustained load returns
 * "Request timeout on the free plan, please upgrade to paid plan" — it is
 * throttling, not lying — and querying two providers to be sure would double
 * the request volume against the exact limit that is being hit. One provider
 * that answers is sufficient; the goal is finding one, not polling all of them.
 *
 * STICKY-WITH-FALLBACK: a working endpoint stays first in line rather than
 * being retried from the top of the list on every call. A keeper polling
 * every 30 seconds for hours does not need to rediscover the same dead
 * endpoint each time — that itself becomes load against a provider that has
 * already shown it cannot take it.
 *
 * Scope is deliberately narrow: only the methods worker/src/keeper.js
 * actually calls on the source-chain provider (see Keeper.scan). Widen it if
 * a caller needs more; do not grow it speculatively.
 *
 * ─── STATIC NETWORK, NOT DETECTED ──────────────────────────────────────────
 *
 * A plain `new JsonRpcProvider(url)` runs a background network-detection poll
 * for the LIFETIME of the provider object — including one that has already
 * failed and been demoted to the back of the list and will never be called
 * again. That is silent extra request volume against every endpoint here, all
 * the time, and it was very likely part of what tripped the original
 * rate-limit: the keeper was not the only thing hitting these providers, its
 * own idle fallback slots were too. We already know the chain (Ethereum
 * mainnet), so there is nothing to detect — passing it as a static network
 * turns that polling off entirely.
 */
class FallbackRpc {
  constructor(urls, log = console, chainId = 1) {
    if (!urls.length) throw new Error('at least one source-chain RPC URL is required');
    this.log = log;
    const network = ethers.Network.from(chainId);
    this.providers = urls.map((url) => ({
      url,
      provider: new ethers.JsonRpcProvider(url, network, { staticNetwork: network }),
    }));
  }

  async _call(method, ...args) {
    const failures = [];

    for (let i = 0; i < this.providers.length; i++) {
      const entry = this.providers[i];
      try {
        const result = await entry.provider[method](...args);
        if (i > 0) {
          // Promote: this endpoint just proved it works, so it goes to the
          // front and the one(s) that failed just now drop behind it.
          this.providers.splice(i, 1);
          this.providers.unshift(entry);
          this.log.warn(`[rpc] switched to ${entry.url} after ${failures.length} failure(s) on ${method}`);
        }
        return result;
      } catch (err) {
        failures.push(`${entry.url}: ${err.shortMessage || err.message || String(err)}`);
      }
    }

    throw new Error(
      `all ${this.providers.length} source-chain RPC(s) failed for ${method}:\n  ${failures.join('\n  ')}`,
    );
  }

  getBlockNumber() {
    return this._call('getBlockNumber');
  }

  getLogs(filter) {
    return this._call('getLogs', filter);
  }

  getTransactionReceipt(hash) {
    return this._call('getTransactionReceipt', hash);
  }

  getBlock(...args) {
    return this._call('getBlock', ...args);
  }
}

module.exports = { FallbackRpc };
