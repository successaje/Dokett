'use strict';

/**
 * Minimal human-readable ABIs.
 *
 * Hand-written rather than imported from the Foundry artifacts so the keeper can
 * run from a clean checkout without a compile step, and so any drift between the
 * contracts and this file shows up as a loud decode error rather than a silently
 * wrong call.
 */

const REGISTER = [
  'event Registered(uint256 indexed id, bytes32 indexed obligor, bytes32 indexed creditor, address registrar, uint64 chainKey, uint128 principal, uint64 windowEndHeight)',
  'event StatusChanged(uint256 indexed id, uint8 from, uint8 to, address adapter)',
  'event PaymentRecorded(uint256 indexed id, uint64 provenHeight, uint128 value, uint8 periodsCovered)',
  'event ScheduleAdvanced(uint256 indexed id, uint64 windowEndHeight, uint8 periodsSatisfied)',
  'event Disputed(uint256 indexed id, bytes32 reasonCode)',
  'event SubjectDisputed(uint256 indexed id, address indexed subjectSigner, bytes32 reasonCode, bytes32 evidenceHash)',
  'event ProvenanceRecorded(uint256 indexed id, uint8 provenance, bytes32 termsHash, address indexed subjectSigner, uint128 registrationBond)',
  'event BountyPaid(uint256 indexed id, address indexed keeper, uint128 amount)',

  'function nextId() view returns (uint256)',
  'function statusOf(uint256 id) view returns (uint8)',
  'function getObligation(uint256 id) view returns (tuple(bytes32 obligor, bytes32 creditor, address creditorPayout, uint64 chainKey, address sourceToken, address sourcePayer, address sourcePayee, uint128 principal, uint128 outstanding, uint128 periodAmount, uint16 aprBps, uint64 startHeight, uint64 periodBlocks, uint64 windowEndHeight, uint64 cureBlocks, uint64 lastProvenHeight, uint8 periodsTotal, uint8 periodsSatisfied, uint8 status, address registrar, uint128 registrarBond, uint128 keeperFund, uint8 seniority, bytes32 collateralRef))',
  'function windowBounds(uint256 id) view returns (uint64 windowStart, uint64 windowEnd)',
  'function provenanceOf(uint256 id) view returns (uint8 kind, address signer, bytes32 committedTerms, uint128 registrationBond)',
  'function disputeOf(uint256 id) view returns (address signer, bytes32 reasonCode, bytes32 evidenceHash, uint64 filedAt)',
  'function disputeReason(uint256 id) view returns (bytes32)',
];

const VERIFIER = [
  'function pokeHead(uint64 chainKey) returns (uint64)',
  'function attestedHead(uint64 chainKey) view returns (uint64)',
  'function penaltiesEnabled(uint64 chainKey) view returns (bool)',
  'function attestationStalled(uint64 chainKey) view returns (bool)',
  'function minConfirmations() view returns (uint64)',
];

const PAYMENT_ADAPTER = [
  'function provePayment(uint256 id, tuple(uint64 chainKey, uint64 height, bytes encodedTransaction, tuple(bytes32 root, tuple(bytes32 hash, bool isLeft)[] siblings) merkleProof, tuple(bytes32 lowerEndpointDigest, bytes32[] roots) continuityProof, uint32 logIndex) p)',
  'event PaymentProven(uint256 indexed id, address indexed submitter, uint64 provenHeight, uint256 value, uint8 periodsCovered)',
];

const SILENCE_ADAPTER = [
  'function markDelinquent(uint256 id)',
  'function finalizeDefault(uint256 id)',
  'function delinquencyStatus(uint256 id) view returns (bool markable, uint64 attestedHead, uint64 requiredHeight, bool liveness)',
  'event MarkedDelinquent(uint256 indexed id, address indexed keeper, uint64 attestedHead, uint64 cureEndHeight)',
  'event Defaulted(uint256 indexed id, address indexed keeper, uint128 outstanding, uint128 slashed)',
];

const BOND = [
  'event BondPosted(uint256 indexed bondId, uint256 indexed obligationId, address indexed underwriter, address collateral, uint128 amount, uint16 spreadBps)',
  'event PremiumFunded(uint256 indexed bondId, address indexed funder, uint128 amount)',
  'event BondSlashed(uint256 indexed bondId, uint256 indexed obligationId, address payee, uint128 amount)',
  'event BondReleased(uint256 indexed bondId, address indexed underwriter, uint128 principal, uint128 premium)',
  'function coverageOf(uint256 obligationId) view returns (uint128)',
];

const ENCUMBRANCE_ADAPTER = [
  'event VenueQueued(uint256 indexed venueId, address indexed emitter, bytes32 topic0, uint64 eta)',
  'event VenueSet(uint256 indexed venueId, address indexed emitter, bool enabled)',
  'event LienWitnessed(bytes32 indexed collateralRef, uint256 indexed venueId, bytes32 indexed holder, uint64 chainKey, uint64 height)',
  'function nextVenueId() view returns (uint256)',
  'function venues(uint256 venueId) view returns (address emitter, bytes32 topic0, uint8 assetTopic, uint8 holderTopic, bool enabled)',
  'function venuePending(uint256 venueId) view returns (address emitter, bytes32 topic0, uint8 assetTopic, uint8 holderTopic, bool enabled)',
  'function venueEta(uint256 venueId) view returns (uint64)',
  'function lienAt(bytes32 collateralRef, uint256 index) view returns (uint64 chainKey, uint64 height, uint256 venueId, bytes32 holder, address emitter)',
];

const ERC20 = ['event Transfer(address indexed from, address indexed to, uint256 value)'];

module.exports = { REGISTER, VERIFIER, PAYMENT_ADAPTER, SILENCE_ADAPTER, BOND, ENCUMBRANCE_ADAPTER, ERC20 };
