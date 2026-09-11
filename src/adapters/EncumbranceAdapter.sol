// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AscVerify} from "../lib/AscVerify.sol";
import {AscVerifier} from "../AscVerifier.sol";

/**
 * @title EncumbranceAdapter
 * @notice Witnesses a pledge on a chain we do not control, from a protocol that
 *         has never heard of this registry.
 *
 * @dev ─── WHY THIS EXISTS ──────────────────────────────────────────────────
 *
 *      Everywhere else in Dokett, a lien is ASSERTED: someone calls
 *      `Register.register()` and names a `collateralRef`. That is correct and it
 *      is bonded, but it has a hard ceiling — it requires cooperation. A lender
 *      who never integrates never files, and the asset they took as security is
 *      invisible to everyone else. A registry that only knows what it is told is
 *      a registry of the co-operative, which is not the population you need to
 *      worry about.
 *
 *      This inverts that. A pledge event emitted by an unmodified third-party
 *      protocol is proven through Attestcoin and recorded here as an
 *      observation. Nobody at that protocol agrees to anything, integrates
 *      anything, or knows this happened.
 *
 *      ─── WHAT THIS IS NOT ────────────────────────────────────────────────
 *
 *      A witnessed lien is NOT an obligation and is deliberately not written
 *      into `Register`. A pledge event says an asset was locked; it does not say
 *      the principal, the schedule, the counterparty, or the terms. Manufacturing
 *      an Obligation from it would mean inventing those fields, and a registry
 *      whose entire argument is that state moves on evidence cannot start filling
 *      in blanks because the struct has them.
 *
 *      So witnessed liens live in their own map, are reported separately, and are
 *      never summed with bonded claims — the same refusal the Lens already makes
 *      between bonded and unbonded claims, for the same reason.
 *
 *      ─── THE HONEST LIMIT ────────────────────────────────────────────────
 *
 *      Every protocol spells "pledge" differently, so a venue must be described
 *      before it can be witnessed: which contract, which event signature, which
 *      indexed topic carries the asset and which carries the holder. That
 *      description is timelocked, because a wrong `assetTopic` silently attributes
 *      liens to the wrong asset — evidence that is worse than absent, because it
 *      looks like a finding.
 *
 *      This does not remove trust. It moves it from "the borrower told us" to
 *      "governance described the venue correctly, and the chain proved the rest."
 *      That is a smaller surface, and it is one anybody can audit against the
 *      emitting contract's own ABI.
 */
contract EncumbranceAdapter {
    AscVerifier public immutable verifier;
    address public immutable timelock;

    uint64 public constant VENUE_TIMELOCK = 48 hours;

    /**
     * @param emitter     the third-party contract whose event we witness
     * @param topic0      that event's signature hash
     * @param assetTopic  index into `topics` holding the asset identifier
     * @param holderTopic index into `topics` holding the pledgor
     */
    struct Venue {
        address emitter;
        bytes32 topic0;
        uint8 assetTopic;
        uint8 holderTopic;
        bool enabled;
    }

    /// @param height source-chain height of the proven pledge. The clock, as everywhere.
    struct Lien {
        uint64 chainKey;
        uint64 height;
        uint256 venueId;
        bytes32 holder;
        address emitter;
    }

    mapping(uint256 => Venue) public venues;
    mapping(uint256 => uint64) public venueEta;
    mapping(uint256 => Venue) public venuePending;
    uint256 public nextVenueId;

    /// @notice collateral commitment => every lien witnessed against it.
    mapping(bytes32 => Lien[]) private _liens;

    error NotTimelock(address caller);
    error VenueDisabled(uint256 venueId);
    error NothingQueued(uint256 venueId);
    error TimelockNotElapsed(uint64 eta);
    error TopicOutOfRange(uint8 index, uint256 topicCount);

    event VenueQueued(uint256 indexed venueId, address indexed emitter, bytes32 topic0, uint64 eta);
    event VenueSet(uint256 indexed venueId, address indexed emitter, bool enabled);
    event LienWitnessed(
        bytes32 indexed collateralRef,
        uint256 indexed venueId,
        bytes32 indexed holder,
        uint64 chainKey,
        uint64 height
    );

    constructor(AscVerifier verifier_, address timelock_) {
        verifier = verifier_;
        timelock = timelock_;
    }

    /* ───────────────────────── venue governance ────────────────────────── */

    function queueVenue(uint256 venueId, Venue calldata v) external {
        if (msg.sender != timelock) revert NotTimelock(msg.sender);
        uint64 eta = uint64(block.timestamp) + VENUE_TIMELOCK;
        venuePending[venueId] = v;
        venueEta[venueId] = eta;
        if (venueId >= nextVenueId) nextVenueId = venueId + 1;
        emit VenueQueued(venueId, v.emitter, v.topic0, eta);
    }

    function setVenue(uint256 venueId) external {
        uint64 eta = venueEta[venueId];
        if (eta == 0) revert NothingQueued(venueId);
        if (block.timestamp < eta) revert TimelockNotElapsed(eta);

        Venue memory v = venuePending[venueId];
        venues[venueId] = v;
        delete venueEta[venueId];
        delete venuePending[venueId];
        emit VenueSet(venueId, v.emitter, v.enabled);
    }

    /* ────────────────────────────── witness ────────────────────────────── */

    /**
     * @notice Prove a pledge at a described venue and record the lien.
     *
     * @dev Permissionless, like every other proof path here. The submitter picks
     *      only which venue to point the proof at; a proof whose emitter or event
     *      signature does not match that venue reverts inside {AscVerifier}, and
     *      the replay guard means the same pledge cannot be witnessed twice.
     *
     *      The collateral commitment is DERIVED from the proven topic, never
     *      supplied by the caller. Letting a caller name the asset would hand any
     *      passer-by the ability to attach a real, proven lien to an asset it has
     *      nothing to do with — which is the encumbrance equivalent of
     *      defamation-by-registration, and the reason bonded and unbonded claims
     *      are kept apart everywhere else in this codebase.
     */
    function witnessPledge(uint256 venueId, AscVerify.Proof calldata p)
        external
        returns (bytes32 collateralRef)
    {
        Venue memory v = venues[venueId];
        if (!v.enabled) revert VenueDisabled(venueId);

        (bytes32[] memory topics,, uint64 height) = verifier.proveEvent(p, v.emitter, v.topic0);

        if (v.assetTopic >= topics.length) revert TopicOutOfRange(v.assetTopic, topics.length);
        if (v.holderTopic >= topics.length) revert TopicOutOfRange(v.holderTopic, topics.length);

        // Commit to (chain, venue, asset) rather than the bare asset id. A token id
        // is only unique within its own contract, and two venues on two chains can
        // legitimately use the same number for unrelated things.
        collateralRef = keccak256(abi.encode(p.chainKey, v.emitter, topics[v.assetTopic]));

        _liens[collateralRef].push(
            Lien({
                chainKey: p.chainKey,
                height: height,
                venueId: venueId,
                holder: topics[v.holderTopic],
                emitter: v.emitter
            })
        );

        emit LienWitnessed(collateralRef, venueId, topics[v.holderTopic], p.chainKey, height);
    }

    /* ─────────────────────────────── views ─────────────────────────────── */

    function lienCount(bytes32 collateralRef) external view returns (uint256) {
        return _liens[collateralRef].length;
    }

    function lienAt(bytes32 collateralRef, uint256 i) external view returns (Lien memory) {
        return _liens[collateralRef][i];
    }

    /// @notice Every witnessed lien on an asset. Never combined with bonded claims.
    function liensOf(bytes32 collateralRef) external view returns (Lien[] memory) {
        return _liens[collateralRef];
    }
}
