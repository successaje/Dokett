'use strict';

const { ethers } = require('ethers');
const { REGISTER, BOND } = require('../../worker/src/abi');
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
    this.register = new ethers.Contract(addresses.register, REGISTER, provider);
    this.bond = addresses.bond ? new ethers.Contract(addresses.bond, BOND, provider) : null;

    /** @type {Map<string, object>} obligation id → projected record */
    this.obligations = new Map();
    /** @type {Map<string, object>} bond id → projected record */
    this.bonds = new Map();
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
        // The honesty flag. Everything downstream keys off this.
        bonded: o.registrarBond > 0n,
      });
    }

    await this.syncBonds(head);
    this.lastBlock = head;
    return { head, obligations: this.obligations.size, bonds: this.bonds.size };
  }

  async syncBonds(head) {
    if (!this.bond) return;

    const posted = await this.bond.queryFilter(this.bond.filters.BondPosted(), 0, head);
    const slashed = await this.bond.queryFilter(this.bond.filters.BondSlashed(), 0, head);
    const released = await this.bond.queryFilter(this.bond.filters.BondReleased(), 0, head);

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

    const bonded = matches.filter((o) => o.bonded);
    const unbonded = matches.filter((o) => !o.bonded);
    const bad = matches.filter((o) => ['Delinquent', 'Default', 'ChargedOff'].includes(o.status));

    return {
      entity,
      asOfBlock: this.lastBlock,
      bonded: bucket(bonded),
      unbonded: bucket(unbonded),
      adverse: { count: bad.length, statuses: bad.map((o) => ({ id: o.id, status: o.status })) },
      note:
        'Bonded and unbonded claims are reported separately and must not be summed. ' +
        'Registration is permissionless; a registrar bond is what gives a claim weight.',
    };
  }

  /** Is this asset already pledged? The wedge query for RWA vaults. */
  encumbrance(asset) {
    const needle = asset.toLowerCase();
    const claims = [...this.obligations.values()].filter(
      (o) => o.collateralRef.toLowerCase() === needle && !['Settled', 'ChargedOff'].includes(o.status),
    );
    return {
      asset,
      asOfBlock: this.lastBlock,
      encumbered: claims.length > 0,
      claims: claims.map((o) => ({
        id: o.id,
        status: o.status,
        outstanding: o.outstanding,
        registrar: o.registrar,
        bonded: o.bonded,
      })),
    };
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
    const bonded = mine.filter((o) => o.bonded);
    const adverse = bonded.filter((o) => ['Default', 'ChargedOff'].includes(o.status));

    const sum = (list, k) => list.reduce((a, o) => a + BigInt(o[k]), 0n).toString();
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
        'Only bonded claims contribute to proven figures.',
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
