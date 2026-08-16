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
