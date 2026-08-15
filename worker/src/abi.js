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
  'event Registered(uint256 indexed id, address indexed registrar, bytes32 indexed obligor, uint64 chainKey, address sourcePayer, address sourcePayee, address sourceToken, uint128 principal)',
  'event StatusChanged(uint256 indexed id, uint8 from, uint8 to, address adapter)',
  'event PaymentRecorded(uint256 indexed id, uint64 provenHeight, uint128 value, uint8 periodsCovered)',
  'event ScheduleAdvanced(uint256 indexed id, uint64 windowEndHeight, uint8 periodsSatisfied)',
  'event Disputed(uint256 indexed id, bytes32 reasonCode)',
  'event BountyPaid(uint256 indexed id, address indexed keeper, uint128 amount)',

  'function nextId() view returns (uint256)',
  'function statusOf(uint256 id) view returns (uint8)',
  'function getObligation(uint256 id) view returns (tuple(bytes32 obligor, bytes32 creditor, address creditorPayout, uint64 chainKey, address sourceToken, address sourcePayer, address sourcePayee, uint128 principal, uint128 outstanding, uint128 periodAmount, uint16 aprBps, uint64 startHeight, uint64 periodBlocks, uint64 windowEndHeight, uint64 cureBlocks, uint64 lastProvenHeight, uint8 periodsTotal, uint8 periodsSatisfied, uint8 status, address registrar, uint128 registrarBond, uint128 keeperFund, uint8 seniority, bytes32 collateralRef))',
  'function windowBounds(uint256 id) view returns (uint64 windowStart, uint64 windowEnd)',
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

const ERC20 = ['event Transfer(address indexed from, address indexed to, uint256 value)'];

module.exports = { REGISTER, VERIFIER, PAYMENT_ADAPTER, SILENCE_ADAPTER, BOND, ERC20 };
