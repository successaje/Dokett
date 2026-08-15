'use strict';

const { proofProvider } = require('@gluwa/usc-sdk');

/**
 * Proof acquisition, with failover.
 *
 * A proof builder can censor but never forge — the BlockProver precompile
 * verifies every proof on-chain, so a lying builder produces a proof that simply
 * fails verification. Withholding is the whole attack surface, and it matters
 * because a withheld proof is indistinguishable from a missed payment right up
 * until the cure window closes. Hence: more than one builder, always, and a
 * self-hosted one in production.
 */
class ProofSource {
  /**
   * @param {number} chainKey source chain key, resolved per-environment
   * @param {string[]} urls   builders in preference order
   */
  constructor(chainKey, urls, log = console) {
    if (!urls.length) throw new Error('at least one proof builder URL is required');
    this.chainKey = chainKey;
    this.log = log;
    this.builders = urls.map((url) => ({
      url,
      client: new proofProvider.service.ProofBuilder(chainKey, url),
    }));
  }

  /**
   * Fetch a proof, trying each builder in turn.
   * @returns {Promise<object>} the builder's proof payload
   */
  async getProof(txHash) {
    const failures = [];

    for (const { url, client } of this.builders) {
      let res;
      try {
        res = await client.getProof(txHash);
      } catch (err) {
        failures.push(`${url}: threw ${err.message}`);
        continue;
      }

      if (res && res.success) {
        if (failures.length) {
          this.log.warn(`proof for ${txHash} served by fallback ${url} after ${failures.length} failure(s)`);
        }
        return res.data;
      }
      failures.push(`${url}: ${res && res.error ? res.error : 'unsuccessful'}`);
    }

    // Deliberately loud. Every builder refusing is operationally identical to the
    // evidence layer being down, and the keeper must not quietly treat that as
    // "no payment happened".
    throw new Error(`all ${this.builders.length} proof builders failed for ${txHash}:\n  ${failures.join('\n  ')}`);
  }

  /** Block until at least one builder has ingested `height`. */
  async waitUntilAttested(height, { pollIntervalMs = 10_000, timeoutMs = 900_000 } = {}) {
    const errors = [];
    for (const { url, client } of this.builders) {
      try {
        await client.waitUntilHeightAttested(this.chainKey, height, pollIntervalMs, timeoutMs);
        return url;
      } catch (err) {
        errors.push(`${url}: ${err.message}`);
      }
    }
    throw new Error(`no proof builder reached height ${height}:\n  ${errors.join('\n  ')}`);
  }
}

/**
 * Map the SDK's proof payload onto the contract's `AscVerify.Proof` tuple.
 *
 * The two shapes are close but not identical — `headerNumber` vs `height`,
 * `txBytes` vs `encodedTransaction` — and `logIndex` exists only on our side,
 * because the builder proves a TRANSACTION while an obligation is advanced by a
 * specific LOG within it.
 *
 * @param {object} data     payload from ProofBuilder.getProof
 * @param {number} logIndex index within the transaction's own receipt logs
 */
function toContractProof(data, logIndex) {
  if (data.chainKey === undefined || data.headerNumber === undefined) {
    throw new Error(`malformed proof payload: ${JSON.stringify(data).slice(0, 200)}`);
  }

  return {
    chainKey: BigInt(data.chainKey),
    height: BigInt(data.headerNumber),
    encodedTransaction: data.txBytes,
    merkleProof: {
      root: data.merkleProof.root,
      siblings: data.merkleProof.siblings.map((s) => ({ hash: s.hash, isLeft: s.isLeft })),
    },
    continuityProof: {
      lowerEndpointDigest: data.continuityProof.lowerEndpointDigest,
      roots: data.continuityProof.roots,
    },
    logIndex,
  };
}

module.exports = { ProofSource, toContractProof };
