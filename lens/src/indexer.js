'use strict';

const { ethers } = require('ethers');
const { REGISTER, BOND, ENCUMBRANCE_ADAPTER } = require('../../worker/src/abi');
const { identityOf } = require('./directory');

const STATUS = ['None', 'Active', 'Current', 'Delinquent', 'Default', 'Settled', 'ChargedOff'];

/**
 * The Lens index.
 *
 * A pure projection over on-chain events. It holds no privileged state, decides
 * nothing, and can be rebuilt from genesis by anyone with an RPC endpoint — which
 * is the property that makes it credible as a public record rather than a vendor
 * database. If this process and its operator disappeared, every fact it serves
 * would still be derivable by a stranger.
 *
 * The one editorial decision it makes is refusing to sum bonded and unbonded
 * claims. See {@link solvency}.
 */
class Index {
  constructor(provider, addresses, log = console) {
    this.provider = provider;
    this.log = log;

    /**
     * Where to start scanning logs.
     *
     * Scanning from genesis is not merely slow — on CC3 it exceeds the node's
     * 10s query timeout outright, so the Lens never finishes its first sync and
     * serves nothing. A registry has no history before the block its contracts
     * were deployed in, so there is nothing above this worth reading.
     */
    this.fromBlock = Number(addresses.deployBlock || 0);
    /** Log range per request. Large enough to be quick, small enough to return. */
    this.chunk = Number(addresses.chunk || 50_000);
    /** First block not yet scanned for bond events. Null until the first pass. */
    this.bondCursor = null;
    /** First block not yet scanned for external lien evidence. */
    this.lienCursor = null;
    this.register = new ethers.Contract(addresses.register, REGISTER, provider);
    this.bond = addresses.bond ? new ethers.Contract(addresses.bond, BOND, provider) : null;
    this.encumbranceAdapter = addresses.encumbrance
      ? new ethers.Contract(addresses.encumbrance, ENCUMBRANCE_ADAPTER, provider)
      : null;
    this.releaseVersion = addresses.releaseVersion || 'v1';

    /** @type {Map<string, object>} obligation id → projected record */
    this.obligations = new Map();
    /** @type {Map<string, object>} bond id → projected record */
    this.bonds = new Map();
    /** @type {Map<string, object>} txHash:logIndex → proven external lien */
    this.witnessedLiens = new Map();
    /** @type {Map<string, object>} venue id → active or queued schema */
    this.venues = new Map();
    this.lastBlock = 0;
  }

  /* ─────────────────────────────── ingest ────────────────────────────── */

  /**
   * Rebuild from chain. Idempotent: obligations are re-read in full rather than
   * mutated incrementally, so a missed event cannot leave the index skewed.
   */
  async sync() {
    const head = await this.provider.getBlockNumber();
    const next = await this.register.nextId();

    for (let id = 1n; id < next; id++) {
      const o = await this.register.getObligation(id);
      const coverage = this.bond ? await this.bond.coverageOf(id) : 0n;

      // Provenance was added after the first CC3 deployment. Query it when the
      // contract supports it and fall back to the only creation path in v1:
      // every obligation was registrar-asserted with the mandatory bond.
      let provenance = 'RegistrarAsserted';
      let subjectSigner = ethers.ZeroAddress;
      let committedTerms = ethers.ZeroHash;
      let registrationBond = o.registrarBond;
      let provenanceNative = false;
      try {
        const p = await this.register.provenanceOf(id);
        provenance = ['RegistrarAsserted', 'SubjectAuthorized'][Number(p.kind)] || 'Unknown';
        subjectSigner = p.signer;
        committedTerms = p.committedTerms;
        registrationBond = p.registrationBond;
        provenanceNative = true;
      } catch (_) {
        // Expected against the immutable v1 deployment.
        registrationBond = ethers.parseEther('1');
      }

      let dispute = null;
      try {
        const d = await this.register.disputeOf(id);
        if (d.reasonCode !== ethers.ZeroHash) {
          dispute = {
            reasonCode: d.reasonCode,
            evidenceHash: d.evidenceHash,
            signer: d.signer,
            filedAt: d.filedAt.toString(),
            authenticated: d.signer !== ethers.ZeroAddress && d.signer.toLowerCase() === subjectSigner.toLowerCase(),
          };
        }
      } catch (_) {
        // A v1 dispute is deliberately surfaced as unauthenticated. It must not
        // quarantine a claim because anybody could have filed or overwritten it.
        try {
          const reasonCode = await this.register.disputeReason(id);
          if (reasonCode !== ethers.ZeroHash) {
            dispute = {
              reasonCode,
              evidenceHash: ethers.ZeroHash,
              signer: ethers.ZeroAddress,
              filedAt: null,
              authenticated: false,
            };
          }
        } catch (_) {
          // Earliest projections did not expose disputeReason in their ABI.
        }
      }

      this.obligations.set(id.toString(), {
        id: id.toString(),
        obligor: o.obligor,
        creditor: o.creditor,
        status: STATUS[Number(o.status)] || 'Unknown',
        chainKey: Number(o.chainKey),
        sourceToken: o.sourceToken,
        sourcePayer: o.sourcePayer,
        sourcePayee: o.sourcePayee,
        principal: o.principal.toString(),
        outstanding: o.outstanding.toString(),
        periodAmount: o.periodAmount.toString(),
        periodsTotal: Number(o.periodsTotal),
        startHeight: o.startHeight.toString(),
        periodBlocks: o.periodBlocks.toString(),
        periodsSatisfied: Number(o.periodsSatisfied),
        windowEndHeight: o.windowEndHeight.toString(),
        cureEndHeight: (o.windowEndHeight + o.cureBlocks).toString(),
        lastProvenHeight: o.lastProvenHeight.toString(),
        registrar: o.registrar,
        registrarBond: o.registrarBond.toString(),
        collateralRef: o.collateralRef,
        coverage: coverage.toString(),
        provenance,
        provenanceNative,
        subjectSigner,
        termsHash: committedTerms,
        registrationBond: registrationBond.toString(),
        dispute,

        /*
         * The honesty flag. Everything downstream keys off this, which is why
         * it was so damaging when it measured the wrong thing.
         *
         * It used to read `o.registrarBond > 0n` — the CURRENT escrow balance.
         * That is a different question from "was this claim bonded", and the
         * two diverge at exactly the worst moment: `_refundEscrow` is called on
         * one event only, `Status.Settled`, so paying a loan off in full zeroed
         * the field and reclassified the claim as unbonded. A borrower who
         * repaid everything showed `obligationsRegistered: 0`, and their
         * settled loan was bucketed alongside claims the API's own note calls
         * weightless. A credit registry that erases repayment is not a credit
         * registry.
         *
         * Bonded-at-registration is a historical fact, and here it is a
         * constant one: `Register.register()` is the only path that creates an
         * obligation and it reverts unless
         * `msg.value >= MIN_REGISTRAR_BOND + MIN_KEEPER_FUND`. Nothing in this
         * register was ever unbonded.
         */
        bonded: registrationBond > 0n,

        /*
         * The current-state question, kept separately and named for what it
         * actually is. True only after settlement returned the escrow, so it
         * reads as "this obligation is finished and the registrar was refunded"
         * rather than as a judgement on the claim's weight.
         */
        escrowReleased: o.registrarBond === 0n,
      });
    }

    await this.syncBonds(head);
    await this.syncEncumbrance(head);
    this.bondCursor = head + 1;
    this.lienCursor = head + 1;
    this.lastBlock = head;
    return {
      head,
      obligations: this.obligations.size,
      bonds: this.bonds.size,
      witnessedLiens: this.witnessedLiens.size,
    };
  }

  /**
   * Paged log query, with the page size discovered rather than assumed.
   *
   * A fixed chunk is a time bomb on a young chain. This shipped with a 50,000
   * block default, which was harmless on the day it deployed — there were only
   * a few hundred blocks of history to walk — and became fatal once the gap
   * between `deployBlock` and the head grew past what CC3 will answer inside
   * its 10-second query budget. The failure only appears on a COLD start, so a
   * long-running instance keeps working while any restart of the same code
   * crash-loops. That is the worst shape a bug can have: invisible until the
   * moment you need to redeploy.
   *
   * So the range halves on failure until the node accepts it, the same way the
   * keeper's scan already handles this. Provider limits are not knowable in
   * advance and change with log density; the only reliable way to find the
   * ceiling is to walk into it and back off.
   */
  async _logs(contract, filter, head, fromBlock = this.fromBlock) {
    const out = [];
    let from = fromBlock;

    while (from <= head) {
      let span = Math.min(this.chunk, head - from + 1);
      let page = null;

      while (span >= 1) {
        try {
          page = await contract.queryFilter(filter, from, from + span - 1);
          break;
        } catch (err) {
          if (span === 1) throw err; // a single block it cannot answer is real
          span = Math.floor(span / 2);
        }
      }

      out.push(...(page ?? []));
      from += span;
    }

    return out;
  }

  /**
   * Bond events, scanned forward rather than from scratch.
   *
   * This used to re-walk the entire chain from `deployBlock` on EVERY poll.
   * That was survivable while there were a few thousand blocks of history and
   * the whole span fitted in one request. Once the span grew — and especially
   * once each span had to be split into many smaller requests to stay inside
   * the node's query budget — a single sync took minutes, polls began
   * overlapping, and the projection fell hours behind the chain while still
   * reporting itself healthy.
   *
   * Bonds accumulate into `this.bonds` and are keyed by id, so replaying old
   * events buys nothing: the state they produce is already there. Only blocks
   * newer than the last successful pass can change anything.
   *
   * `bondCursor` advances only after a pass completes. A throw leaves it where
   * it was, so a failed sync is retried rather than silently skipped.
   */
  async syncBonds(head) {
    if (!this.bond) return;

    const from = this.bondCursor ?? this.fromBlock;
    if (from > head) return;

    const posted = await this._logs(this.bond, this.bond.filters.BondPosted(), head, from);
    const slashed = await this._logs(this.bond, this.bond.filters.BondSlashed(), head, from);
    const released = await this._logs(this.bond, this.bond.filters.BondReleased(), head, from);

    for (const e of posted) {
      this.bonds.set(e.args.bondId.toString(), {
        bondId: e.args.bondId.toString(),
        obligationId: e.args.obligationId.toString(),
        underwriter: e.args.underwriter,
        collateral: e.args.collateral,
        amount: e.args.amount.toString(),
        spreadBps: Number(e.args.spreadBps),
        slashed: '0',
        released: false,
      });
    }
    for (const e of slashed) {
      const b = this.bonds.get(e.args.bondId.toString());
      if (b) b.slashed = (BigInt(b.slashed) + e.args.amount).toString();
    }
    for (const e of released) {
      const b = this.bonds.get(e.args.bondId.toString());
      if (b) b.released = true;
    }
  }

  /** Index governed venue schemas and every USC-proven external collateral event. */
  async syncEncumbrance(head) {
    if (!this.encumbranceAdapter) return;

    const nextVenue = await this.encumbranceAdapter.nextVenueId();
    for (let id = 0n; id < nextVenue; id++) {
      const [active, pending, eta] = await Promise.all([
        this.encumbranceAdapter.venues(id),
        this.encumbranceAdapter.venuePending(id),
        this.encumbranceAdapter.venueEta(id),
      ]);
      const queued = eta > 0n;
      const v = queued ? pending : active;
      this.venues.set(id.toString(), {
        venueId: id.toString(),
        emitter: v.emitter,
        topic0: v.topic0,
        assetTopic: Number(v.assetTopic),
        holderTopic: Number(v.holderTopic),
        enabled: active.enabled,
        status: queued ? (active.enabled ? 'update-queued' : 'queued') : active.enabled ? 'active' : 'disabled',
        eta: queued ? eta.toString() : null,
      });
    }

    const from = this.lienCursor ?? this.fromBlock;
    if (from > head) return;
    const liens = await this._logs(
      this.encumbranceAdapter,
      this.encumbranceAdapter.filters.LienWitnessed(),
      head,
      from,
    );
    const seenByReference = new Map();
    for (const existing of this.witnessedLiens.values()) {
      const key = existing.collateralRef.toLowerCase();
      seenByReference.set(key, (seenByReference.get(key) || 0) + 1);
    }
    for (const e of liens) {
      const venueId = e.args.venueId.toString();
      const referenceKey = e.args.collateralRef.toLowerCase();
      const ordinal = seenByReference.get(referenceKey) || 0;
      const stored = await this.encumbranceAdapter.lienAt(e.args.collateralRef, ordinal);
      seenByReference.set(referenceKey, ordinal + 1);
      this.witnessedLiens.set(`${e.transactionHash}:${e.index}`, {
        collateralRef: e.args.collateralRef,
        venueId,
        holder: e.args.holder,
        chainKey: Number(e.args.chainKey),
        height: e.args.height.toString(),
        emitter: stored.emitter,
        cc3Transaction: e.transactionHash,
        blockNumber: e.blockNumber,
      });
    }
  }

  /* ─────────────────────────────── queries ───────────────────────────── */

  /**
   * Everything registered against one entity.
   *
   * THE QUERY THAT DOES NOT EXIST ANYWHERE ELSE: a lender can ask what a
   * counterparty already owes before extending credit, across venues that have
   * never spoken to each other.
   *
   * Bonded and unbonded claims are returned in separate buckets and are NEVER
   * summed into one number. Registration is permissionless — that is deliberate,
   * since a registry that gatekeeps registration is just a private database — but
   * it means anyone can register a claim against anyone. A naive total would
   * therefore be trivially poisoned by an adversary registering fictional debts
   * against a competitor. Weighting by registrar bond is what makes the number
   * mean something, and collapsing the buckets would throw that away.
   */
  solvency(entity) {
    const needle = entity.toLowerCase();
    const matches = [...this.obligations.values()].filter(
      (o) =>
        o.sourcePayer.toLowerCase() === needle ||
        o.obligor.toLowerCase() === needle ||
        o.sourcePayee.toLowerCase() === needle,
    );

    const bucket = (list) => ({
      count: list.length,
      outstanding: list.reduce((a, o) => a + BigInt(o.outstanding), 0n).toString(),
      obligations: list,
    });

    const quarantined = matches.filter((o) => o.dispute?.authenticated);
    const admitted = matches.filter((o) => !o.dispute?.authenticated);
    const bonded = admitted.filter((o) => o.bonded);
    const unbonded = admitted.filter((o) => !o.bonded);
    const bad = admitted.filter((o) => ['Delinquent', 'Default', 'ChargedOff'].includes(o.status));

    return {
      entity,
      asOfBlock: this.lastBlock,
      bonded: bucket(bonded),
      unbonded: bucket(unbonded),
      disputed: bucket(quarantined),
      adverse: { count: bad.length, statuses: bad.map((o) => ({ id: o.id, status: o.status })) },
      note:
        'Bonded, unbonded and subject-disputed claims are reported separately and must not be summed. ' +
        'Only a dispute authenticated by the signer who authorized the obligation is quarantined.',
    };
  }

  /** Is this asset already pledged? The wedge query for RWA vaults. */
  encumbrance(asset) {
    const needle = asset.toLowerCase();
    const claims = [...this.obligations.values()].filter(
      (o) => o.collateralRef.toLowerCase() === needle && !['Settled', 'ChargedOff'].includes(o.status),
    );
    const witnessedLiens = [...this.witnessedLiens.values()].filter(
      (l) => l.collateralRef.toLowerCase() === needle,
    );
    return {
      asset,
      asOfBlock: this.lastBlock,
      encumbered: claims.length > 0 || witnessedLiens.length > 0,
      witnessedLiens,
      claims: claims.map((o) => ({
        id: o.id,
        status: o.status,
        outstanding: o.outstanding,
        // Without this the consumer cannot know what `outstanding` is
        // DENOMINATED IN, and every claim renders at whatever decimals the
        // caller guesses. That guess was 6 everywhere, so an 18-decimal
        // claim read as a trillion-fold overstatement of the encumbrance.
        // A registry that reports a lien has to say in what.
        sourceToken: o.sourceToken,
        registrar: o.registrar,
        bonded: o.bonded,
        dispute: o.dispute,
      })),
    };
  }

  encumbranceVenues() {
    return { asOfBlock: this.lastBlock, venues: [...this.venues.values()] };
  }

  obligation(id) {
    const o = this.obligations.get(String(id));
    if (!o) return null;
    return { ...o, bonds: [...this.bonds.values()].filter((b) => b.obligationId === String(id)) };
  }

  /**
   * A subject's profile: what the register proves, and separately, what people
   * have claimed about them.
   *
   * The split is the whole point. `proven` is derived from obligations and is
   * recomputable by any stranger with an RPC endpoint — nobody, including us,
   * can adjust it. `attested` is a list of statements by named issuers, each
   * carrying who said it and what they staked.
   *
   * Rendering those as the same kind of fact is how a registry starts lying, so
   * they are returned as two separate objects that cannot be accidentally
   * merged, and `notIndexed` names the facts we deliberately do NOT report
   * rather than defaulting them to a flattering zero.
   */
  profile(subject) {
    const needle = String(subject).toLowerCase();
    const mine = [...this.obligations.values()].filter(
      (o) => o.obligor.toLowerCase() === needle || o.sourcePayer.toLowerCase() === needle,
    );

    // Only bonded claims count toward a subject's proven record. An unbonded
    // claim is unpriced and anyone can register one, so letting it into these
    // figures would let a griefer author someone else's credit history.
    const quarantined = mine.filter((o) => o.dispute?.authenticated);
    const bonded = mine.filter((o) => o.bonded && !o.dispute?.authenticated);
    const adverse = bonded.filter((o) => ['Default', 'ChargedOff'].includes(o.status));

    const sum = (list, k) => list.reduce((a, o) => a + BigInt(o[k]), 0n).toString();

    /*
     * Totals broken out by the asset they are denominated in.
     *
     * `sum` above adds raw integers across a subject's claims, which is one
     * correct number only while they are all in the same token — and the flat
     * total carries no indication of which. A PAXG-only subject's outstanding
     * came back as an 18-decimal integer that every consumer then rendered at
     * six, reading 16 troy ounces of gold as 16 trillion.
     *
     * The flat fields stay for compatibility, but this lets a consumer render
     * each denomination correctly, and refuse to add them — which is right,
     * since converting between them needs a price and this registry has none.
     */
    const byDenomination = () => {
      const acc = {};
      for (const o of bonded) {
        const t = (o.sourceToken || '').toLowerCase();
        acc[t] ??= { sourceToken: o.sourceToken, outstanding: 0n, lifetimePrincipal: 0n };
        acc[t].outstanding += BigInt(o.outstanding);
        acc[t].lifetimePrincipal += BigInt(o.principal);
      }
      return Object.values(acc).map((d) => ({
        sourceToken: d.sourceToken,
        outstanding: d.outstanding.toString(),
        lifetimePrincipal: d.lifetimePrincipal.toString(),
      }));
    };
    const count = (list, k) => list.reduce((a, o) => a + Number(o[k] || 0), 0);

    const heights = bonded.map((o) => BigInt(o.startHeight || 0)).filter((h) => h > 0n);
    const firstSeen = heights.length ? heights.reduce((a, h) => (h < a ? h : a)).toString() : null;

    const identity = identityOf(subject);

    return {
      subject,
      asOfBlock: this.lastBlock,

      identity: identity
        ? {
            displayName: identity.displayName,
            latinName: identity.latinName,
            kind: identity.kind,
            jurisdiction: identity.jurisdiction,
            sector: identity.sector,
            disclosure: identity.disclosure,
          }
        : null,

      proven: {
        byDenomination: byDenomination(),
        obligationsRegistered: bonded.length,
        paymentsProven: count(bonded, 'periodsSatisfied'),
        paymentsScheduled: count(bonded, 'periodsTotal'),
        defaults: adverse.length,
        delinquentNow: bonded.filter((o) => o.status === 'Delinquent').length,
        openNow: bonded.filter((o) => ['Active', 'Current', 'Delinquent'].includes(o.status)).length,
        lifetimePrincipal: sum(bonded, 'principal'),
        outstanding: sum(
          bonded.filter((o) => !['Settled', 'ChargedOff'].includes(o.status)),
          'outstanding',
        ),
        firstSeenHeight: firstSeen,
      },

      attested: identity ? identity.attestations : [],

      // Registered against this subject but carrying no registrar bond. Reported
      // so the subject can see what is being claimed about them, and never mixed
      // into `proven`.
      unbondedClaims: mine.filter((o) => !o.bonded).length,
      disputedClaims: quarantined.length,

      /**
       * Facts a credit file would normally carry that this projection cannot
       * derive yet. Named explicitly, because silently reporting `curedLate: 0`
       * would be indistinguishable from a clean record.
       */
      notIndexed: [
        'curedLate — requires replaying StatusChanged transitions, not just current state',
        'timeToCure — same',
        'counterpartyConcentration — needs registrar clustering',
      ],

      note:
        'PROVEN figures are derived from the register and recomputable by anyone. ' +
        'ATTESTED claims are statements by named issuers and are not proof. ' +
        'Only bonded, undisputed claims contribute to proven figures. ' +
        'A dispute is quarantined only when authenticated by the subject signer recorded at origination.',
    };
  }

  /**
   * An underwriter's record.
   *
   * Derived, never stored. Reputation here is a view over history rather than a
   * mutable score someone can be talked into adjusting — which is precisely the
   * failure mode of every on-chain credit score that came before.
   */
  underwriter(addr) {
    const needle = addr.toLowerCase();
    const mine = [...this.bonds.values()].filter((b) => b.underwriter.toLowerCase() === needle);

    const posted = mine.reduce((a, b) => a + BigInt(b.amount), 0n);
    const lost = mine.reduce((a, b) => a + BigInt(b.slashed), 0n);

    return {
      underwriter: addr,
      asOfBlock: this.lastBlock,
      bondsWritten: mine.length,
      totalPosted: posted.toString(),
      totalSlashed: lost.toString(),
      lossRateBps: posted > 0n ? Number((lost * 10000n) / posted) : 0,
      bonds: mine,
    };
  }
}

module.exports = { Index, STATUS };
