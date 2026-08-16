/**
 * Wire types for the Lens read API.
 *
 * Mirrors `lens/src/indexer.js`. All numeric fields arrive as decimal strings
 * because they are uint128/uint256 on-chain — parsing them into JS numbers
 * would silently round balances, which in a credit registry is not a rendering
 * bug but a correctness one.
 */

export type Status =
  | 'None'
  | 'Active'
  | 'Current'
  | 'Delinquent'
  | 'Default'
  | 'Settled'
  | 'ChargedOff'
  | 'Unknown';

export interface Obligation {
  id: string;
  obligor: string;
  creditor: string;
  status: Status;
  chainKey: number;
  sourceToken: string;
  sourcePayer: string;
  sourcePayee: string;
  principal: string;
  outstanding: string;
  periodAmount: string;
  periodsTotal: number;
  periodsSatisfied: number;
  windowEndHeight: string;
  cureEndHeight: string;
  lastProvenHeight: string;
  registrar: string;
  registrarBond: string;
  collateralRef: string;
  coverage: string;
  /** True when the registrar posted a bond. The Lens keys its buckets off this. */
  bonded: boolean;
}

export interface Bond {
  bondId: string;
  obligationId: string;
  underwriter: string;
  collateral: string;
  amount: string;
  spreadBps: number;
  slashed: string;
  released: boolean;
}

export interface Bucket {
  count: number;
  outstanding: string;
  obligations: Obligation[];
}

/**
 * Note the shape: there is no `total`.
 *
 * That absence is deliberate and load-bearing. Registration is permissionless,
 * so anyone can register fictional debts against anyone; a combined total would
 * make that attack free. The UI must not reintroduce at the presentation layer
 * the summation the protocol refuses to do.
 */
export interface Solvency {
  entity: string;
  asOfBlock: number;
  bonded: Bucket;
  unbonded: Bucket;
  adverse: { count: number; statuses: { id: string; status: Status }[] };
  note: string;
}

export interface Encumbrance {
  asset: string;
  asOfBlock: number;
  encumbered: boolean;
  claims: {
    id: string;
    status: Status;
    outstanding: string;
    registrar: string;
    bonded: boolean;
  }[];
}

export interface Underwriter {
  underwriter: string;
  asOfBlock: number;
  bondsWritten: number;
  totalPosted: string;
  totalSlashed: string;
  lossRateBps: number;
  bonds: Bond[];
}

export interface ObligationDetail extends Obligation {
  bonds: Bond[];
}

export interface Health {
  ok: boolean;
  asOfBlock: number;
  obligations: number;
}

/* ─────────────────────────── profile ─────────────────────────── */

/**
 * An attested claim: something a named issuer said, with what they staked.
 *
 * Never proof. The Console must render these in a visually distinct register
 * from `ProvenRecord` — collapsing the two is how a registry starts laundering
 * assertions into evidence.
 */
export interface Attestation {
  kind: string;
  claim: string;
  issuer: string;
  issuerName: string;
  method: 'signature' | 'document' | 'site-visit' | string;
  /** CTC the issuer staked against being wrong. '0' means unbonded. */
  bondedCtc: string;
  at: string;
}

/** Derived from the register. Recomputable by any stranger; adjustable by nobody. */
export interface ProvenRecord {
  obligationsRegistered: number;
  paymentsProven: number;
  paymentsScheduled: number;
  defaults: number;
  delinquentNow: number;
  openNow: number;
  lifetimePrincipal: string;
  outstanding: string;
  firstSeenHeight: string | null;
}

export interface DisclosedIdentity {
  displayName: string;
  latinName: string | null;
  kind: string;
  jurisdiction: string;
  sector: string;
  disclosure: string;
}

export interface Profile {
  subject: string;
  asOfBlock: number;
  /** Null is normal: most subjects never disclose, and the record stands alone. */
  identity: DisclosedIdentity | null;
  proven: ProvenRecord;
  attested: Attestation[];
  unbondedClaims: number;
  /** Facts deliberately NOT reported, rather than defaulted to a flattering zero. */
  notIndexed: string[];
  note: string;
}
