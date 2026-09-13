// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AscVerify} from "./lib/AscVerify.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IERC1271} from "@openzeppelin/contracts/interfaces/IERC1271.sol";

/**
 * @title Register
 * @notice The canonical record of obligations.
 *
 * @dev Two lenders who have never met can see each other's claims on the same
 *      borrower before they lend. That query is the product; everything else here
 *      exists to make its answer trustworthy.
 *
 *      Design rules this contract enforces (ARCHITECTURE.md §1):
 *
 *      I2  No privileged reporter. Nothing in this file lets any caller — including
 *          the timelock — assert an obligation's status. Status moves only through
 *          an allowlisted adapter, and adapters move it only on ASC-verified
 *          evidence or a comparison against the attested source-chain head.
 *
 *      I5  No PII. `obligor` and `creditor` are commitments. This contract never
 *          learns who they are and has no way to reverse them.
 *
 *      I6  The clock is attested source-chain height. Every schedule field is
 *          denominated in source blocks, never in `block.timestamp` — see the note
 *          on `periodBlocks` below.
 *
 *      I8  Registration is permissionless; weight is bonded. Anyone may register
 *          anything against anyone. The bond prices spam, and the Lens reports
 *          bonded and unbonded claims separately rather than summing them.
 */
contract Register {
    /* ─────────────────────────────── types ─────────────────────────────── */

    enum Status {
        None, // 0  unregistered
        Active, // 1  registered, first window open
        Current, // 2  last due window satisfied by verified proof
        Delinquent, // 3  a window closed with no admissible proof; cure open
        Default, // 4  cure expired; triggers slashing
        Settled, // 5  schedule fully satisfied
        ChargedOff // 6  defaulted and written off

    }

    enum Provenance {
        RegistrarAsserted,
        SubjectAuthorized
    }

    struct Obligation {
        // identity — commitments only (I5)
        bytes32 obligor;
        bytes32 creditor;
        address creditorPayout; // receives slashed bond value, on Creditcoin
        // source-chain binding. Public by construction — see README "Known limitations".
        uint64 chainKey;
        address sourceToken;
        address sourcePayer;
        address sourcePayee;
        // economics
        uint128 principal;
        uint128 outstanding;
        uint128 periodAmount; // minimum qualifying payment per window
        uint16 aprBps;
        // schedule, in SOURCE-CHAIN BLOCK HEIGHT (I6)
        uint64 startHeight;
        uint64 periodBlocks;
        uint64 windowEndHeight;
        uint64 cureBlocks;
        uint64 lastProvenHeight;
        uint8 periodsTotal;
        uint8 periodsSatisfied;
        // lifecycle
        Status status;
        // registry weighting (I8)
        address registrar;
        uint128 registrarBond;
        uint128 keeperFund;
        uint8 seniority;
        bytes32 collateralRef; // 0x0 if unsecured
    }

    /// @notice Registration parameters. Split from {Obligation} so the derived
    ///         fields (outstanding, windowEndHeight, status…) cannot be forged.
    struct ObligationInit {
        bytes32 obligor;
        bytes32 creditor;
        address creditorPayout;
        uint64 chainKey;
        address sourceToken;
        address sourcePayer;
        address sourcePayee;
        uint128 principal;
        uint128 periodAmount;
        uint16 aprBps;
        uint64 startHeight;
        uint64 periodBlocks;
        uint64 cureBlocks;
        uint8 periodsTotal;
        uint8 seniority;
        bytes32 collateralRef;
    }

    /* ────────────────────────────── constants ──────────────────────────── */

    /// @notice Minimum CTC bond for a registration to carry full weight in the Lens.
    uint128 public constant MIN_REGISTRAR_BOND = 1 ether;

    /// @notice Minimum CTC escrowed per obligation to pay keeper bounties.
    /// @dev Sized against the documented worst case for a single verification
    ///      (0.0375 CTC for a maximal transaction decode), with room for the
    ///      several calls an obligation's lifecycle can need.
    uint128 public constant MIN_KEEPER_FUND = 0.5 ether;

    /// @notice Delay on every change to the adapter allowlist.
    uint64 public constant ADAPTER_TIMELOCK = 48 hours;

    bytes32 public constant OBLIGATION_AUTHORIZATION_TYPEHASH = keccak256(
        "ObligationAuthorization(bytes32 termsHash,address registrar,address subjectSigner,uint64 expectedChainId,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant DISPUTE_AUTHORIZATION_TYPEHASH = keccak256(
        "DisputeAuthorization(uint256 obligationId,bytes32 reasonCode,bytes32 evidenceHash,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 public constant EIP712_NAME_HASH = keccak256("Dokett Register");
    bytes32 public constant EIP712_VERSION_HASH = keccak256("1");

    /* ─────────────────────────────── storage ───────────────────────────── */

    AscVerify public immutable ascVerify;

    /// @notice Governs the adapter allowlist, and nothing else. See {setAdapter}.
    address public timelock;

    uint256 public nextId = 1;

    mapping(uint256 => Obligation) internal _obligations;

    /// @notice Contracts permitted to advance an obligation's status.
    mapping(address => bool) public isAdapter;

    /// @notice True once {bootstrapAdapters} has run. See its note for why this
    ///         path exists and why it can never reopen.
    bool public bootstrapped;

    /// @notice adapter => earliest timestamp at which a pending change may execute.
    mapping(address => uint64) public adapterEta;
    mapping(address => bool) public adapterPendingState;

    /// @notice Obligor-filed flags. Advisory: surfaced by the Lens, never status-changing.
    mapping(uint256 => bytes32) public disputeReason;
    mapping(uint256 => address) public disputedBy;
    mapping(uint256 => bytes32) public disputeEvidence;
    mapping(uint256 => uint64) public disputedAt;

    /// @notice Immutable registration provenance. Kept separately from the
    ///         refundable escrow so settlement cannot erase how a claim entered.
    mapping(uint256 => Provenance) public provenance;
    mapping(uint256 => address) public subjectSigner;
    mapping(uint256 => bytes32) public termsHash;
    mapping(uint256 => uint128) public registrationBondPosted;

    /// @notice EIP-712 authorizations are one-shot, including unordered nonces.
    mapping(bytes32 => bool) public consumedAuthorizations;

    /// @notice Escrow credited back on settlement, claimable via {withdraw}.
    mapping(address => uint256) public withdrawable;

    /* ─────────────────────────────── events ────────────────────────────── */

    event Registered(
        uint256 indexed id,
        bytes32 indexed obligor,
        bytes32 indexed creditor,
        address registrar,
        uint64 chainKey,
        uint128 principal,
        uint64 windowEndHeight
    );
    event StatusChanged(uint256 indexed id, Status from, Status to, address adapter);
    event PaymentRecorded(uint256 indexed id, uint64 provenHeight, uint128 value, uint8 periodsCovered);
    event ScheduleAdvanced(uint256 indexed id, uint64 windowEndHeight, uint8 periodsSatisfied);
    event Disputed(uint256 indexed id, bytes32 reasonCode);
    event SubjectDisputed(uint256 indexed id, address indexed subjectSigner, bytes32 reasonCode, bytes32 evidenceHash);
    event ProvenanceRecorded(
        uint256 indexed id,
        Provenance provenance,
        bytes32 termsHash,
        address indexed subjectSigner,
        uint128 registrationBond
    );
    event BountyPaid(uint256 indexed id, address indexed keeper, uint128 amount);
    event AdapterChangeQueued(address indexed adapter, bool enabled, uint64 eta);
    event AdapterChanged(address indexed adapter, bool enabled);
    event Bootstrapped(address[] adapters);
    event BondEscrowReleased(uint256 indexed id, address indexed to, uint128 amount);
    event Withdrawn(address indexed to, uint256 amount);

    /* ─────────────────────────────── errors ────────────────────────────── */

    error NotAdapter(address caller);
    error NotTimelock(address caller);
    error UnknownObligation(uint256 id);
    error BondTooSmall(uint256 provided, uint256 required);
    error InvalidSchedule();
    error ChainMismatch(uint64 chainKey, uint64 expectedChainId);
    error IllegalTransition(Status from, Status to);
    error NothingQueued(address adapter);
    error TimelockNotElapsed(uint64 eta);
    error AlreadyBootstrapped();
    error RegistryNotEmpty(uint256 nextId);
    error BountyTransferFailed(address to);
    error AuthorizationExpired(uint256 deadline);
    error InvalidAuthorization(address signer);
    error AuthorizationAlreadyUsed(bytes32 digest);
    error SubjectAuthorizationRequired(uint256 id);
    error UnauthorizedDisputer(address caller, address expected);
    error AlreadyDisputed(uint256 id);
    error InvalidDisputeReason();

    /* ──────────────────────────── construction ─────────────────────────── */

    constructor(AscVerify ascVerify_, address timelock_) {
        ascVerify = ascVerify_;
        timelock = timelock_;
    }

    modifier onlyAdapter() {
        if (!isAdapter[msg.sender]) revert NotAdapter(msg.sender);
        _;
    }

    /* ────────────────────────── registration (I8) ──────────────────────── */

    /**
     * @notice Register an obligation. Permissionless by design.
     *
     * @dev Anyone may register any claim against any address, which is the classic
     *      registry attack and the reason most registries end up permissioned. The
     *      answer here is economic rather than gatekept: the bond prices spam, and
     *      the Lens never sums bonded and unbonded claims into one number. This
     *      registrar-asserted path does not imply subject consent. For authenticated
     *      disputes, use {registerAuthorized} so the subject controller is recorded.
     *
     *      What this function does NOT do is decide whether the claim is true. That
     *      is what the adapters are for.
     *
     * @param init Registration parameters.
     * @param expectedChainId Chain id the caller believes `init.chainKey` maps to.
     *        Asserted against the ChainInfo precompile, because chainkeys are not
     *        portable across environments — Ethereum mainnet is 3 on CC3 testnet
     *        and 1 on CC3 mainnet. A hardcoded key silently verifies proofs against
     *        the wrong chain; this makes that failure loud and immediate.
     */
    function register(ObligationInit calldata init, uint64 expectedChainId) external payable returns (uint256 id) {
        return _register(init, expectedChainId, Provenance.RegistrarAsserted, address(0));
    }

    /**
     * @notice Register terms authorized by the subject through EIP-712.
     * @dev The signature binds the exact terms, registrar, source-chain identity,
     *      nonce, deadline, settlement chain and this Register. Validation supports
     *      EOAs and EIP-1271 smart accounts.
     */
    function registerAuthorized(
        ObligationInit calldata init,
        uint64 expectedChainId,
        address signer,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external payable returns (uint256 id) {
        bytes32 digest = obligationAuthorizationDigest(init, msg.sender, signer, expectedChainId, nonce, deadline);
        _consumeAuthorization(signer, digest, deadline, signature);
        return _register(init, expectedChainId, Provenance.SubjectAuthorized, signer);
    }

    function _register(ObligationInit calldata init, uint64 expectedChainId, Provenance provenance_, address signer)
        internal
        returns (uint256 id)
    {
        if (msg.value < MIN_REGISTRAR_BOND + MIN_KEEPER_FUND) {
            revert BondTooSmall(msg.value, MIN_REGISTRAR_BOND + MIN_KEEPER_FUND);
        }
        if (
            init.principal == 0 || init.periodAmount == 0 || init.periodsTotal == 0 || init.periodBlocks == 0
                || init.cureBlocks == 0 || init.startHeight == 0
        ) {
            revert InvalidSchedule();
        }
        // A schedule whose windows cannot be satisfied by design is not a promise.
        if (uint256(init.periodAmount) * init.periodsTotal < init.principal) revert InvalidSchedule();

        // Reverts if the chainkey does not resolve to the chain the caller means.
        ascVerify.assertChainId(init.chainKey, expectedChainId);

        // Start the observation record for this chain now, so an obligation cannot
        // be penalised on a chain that has never been watched (I7).
        ascVerify.pokeHead(init.chainKey);

        id = nextId++;
        Obligation storage o = _obligations[id];

        o.obligor = init.obligor;
        o.creditor = init.creditor;
        o.creditorPayout = init.creditorPayout;
        o.chainKey = init.chainKey;
        o.sourceToken = init.sourceToken;
        o.sourcePayer = init.sourcePayer;
        o.sourcePayee = init.sourcePayee;
        o.principal = init.principal;
        o.outstanding = init.principal;
        o.periodAmount = init.periodAmount;
        o.aprBps = init.aprBps;
        o.startHeight = init.startHeight;
        o.periodBlocks = init.periodBlocks;
        o.cureBlocks = init.cureBlocks;
        o.periodsTotal = init.periodsTotal;
        o.seniority = init.seniority;
        o.collateralRef = init.collateralRef;

        // The first window closes one period after the schedule starts.
        o.windowEndHeight = init.startHeight + init.periodBlocks;
        o.status = Status.Active;

        o.registrar = msg.sender;
        o.registrarBond = MIN_REGISTRAR_BOND;
        o.keeperFund = uint128(msg.value) - MIN_REGISTRAR_BOND;

        bytes32 committedTerms = hashTerms(init);
        provenance[id] = provenance_;
        subjectSigner[id] = signer;
        termsHash[id] = committedTerms;
        registrationBondPosted[id] = MIN_REGISTRAR_BOND;

        emit Registered(id, init.obligor, init.creditor, msg.sender, init.chainKey, init.principal, o.windowEndHeight);
        emit StatusChanged(id, Status.None, Status.Active, address(0));
        emit ProvenanceRecorded(id, provenance_, committedTerms, signer, MIN_REGISTRAR_BOND);
    }

    /* ─────────────────────── adapter-driven mutation ───────────────────── */

    /**
     * @notice Record a verified payment and advance the schedule.
     * @dev Callable only by an allowlisted adapter, which reaches this point only
     *      after {AscVerify} has proven the transaction, checked its receipt status,
     *      matched the transfer parties, and consumed the proof key.
     *
     *      `provenHeight` is trustworthy because it is bound by the proof: the
     *      merkle proof ties the transaction to the block, and the continuity proof
     *      ties the block to an attested checkpoint. It is not a caller assertion.
     */
    function recordPayment(uint256 id, uint64 provenHeight, uint128 value, uint8 periodsCovered) external onlyAdapter {
        Obligation storage o = _mustExist(id);
        Status from = o.status;
        if (from != Status.Active && from != Status.Current && from != Status.Delinquent) {
            revert IllegalTransition(from, Status.Current);
        }

        o.outstanding -= value < o.outstanding ? value : o.outstanding;
        o.periodsSatisfied += periodsCovered;
        o.lastProvenHeight = provenHeight;
        o.windowEndHeight += uint64(periodsCovered) * o.periodBlocks;

        emit PaymentRecorded(id, provenHeight, value, periodsCovered);
        emit ScheduleAdvanced(id, o.windowEndHeight, o.periodsSatisfied);

        Status to = (o.periodsSatisfied >= o.periodsTotal && o.outstanding == 0) ? Status.Settled : Status.Current;
        _setStatus(id, o, to);

        // A settled obligation has no further work to fund; return the escrow.
        if (to == Status.Settled) _refundEscrow(id, o);
    }

    /**
     * @notice Move an obligation to Delinquent or Default.
     * @dev The liveness gate (I7) lives in the adapter, not here, because only the
     *      adapter knows which chain's head is being reasoned about. This function
     *      enforces the shape of the transition; the adapter enforces its grounds.
     */
    function markStatus(uint256 id, Status to) external onlyAdapter {
        Obligation storage o = _mustExist(id);
        Status from = o.status;

        bool legal = (to == Status.Delinquent && (from == Status.Active || from == Status.Current))
            || (to == Status.Default && from == Status.Delinquent) || (to == Status.ChargedOff && from == Status.Default);
        if (!legal) revert IllegalTransition(from, to);

        _setStatus(id, o, to);
    }

    /**
     * @notice Pay a keeper bounty from the obligation's own escrow.
     * @dev Bounties are funded per-obligation at registration rather than from a
     *      shared pot, so a griefer cannot drain the protocol by farming calls, and
     *      an obligation can never become unprofitable to watch while it is live.
     */
    function payBounty(uint256 id, address keeper, uint128 amount) external onlyAdapter {
        Obligation storage o = _mustExist(id);
        uint128 pay = amount > o.keeperFund ? o.keeperFund : amount;
        if (pay == 0) return;

        o.keeperFund -= pay;
        (bool ok,) = keeper.call{value: pay}("");
        if (!ok) revert BountyTransferFailed(keeper);

        emit BountyPaid(id, keeper, pay);
    }

    /* ──────────────────────── obligor due process ──────────────────────── */

    /**
     * @notice Flag an obligation as contested.
     * @dev Deliberately does not change status. A dispute is a claim about the
     *      record, not evidence about the world, and this contract does not let
     *      claims move status — that is I2, and it applies to obligors too. What a
     *      dispute does is make the contest visible: the Lens quarantines disputed
     *      claims rather than reporting them as clean.
     *
     *      The subject uses an obligation-specific or institution-controlled
     *      signing address. That address authorized the exact terms at registration,
     *      so a dispute does not require revealing the obligor commitment preimage.
     */
    function dispute(uint256 id, bytes32 reasonCode) external {
        _fileDispute(id, msg.sender, reasonCode, bytes32(0));
    }

    /// @notice Gas-sponsored dispute path. Anyone may relay; only the subject's
    ///         EIP-712/EIP-1271 authorization gives the record meaning.
    function disputeBySig(
        uint256 id,
        bytes32 reasonCode,
        bytes32 evidenceHash,
        uint256 nonce,
        uint256 deadline,
        bytes calldata signature
    ) external {
        _mustExist(id);
        address signer = subjectSigner[id];
        if (signer == address(0)) revert SubjectAuthorizationRequired(id);

        bytes32 digest = disputeAuthorizationDigest(id, reasonCode, evidenceHash, nonce, deadline);
        _consumeAuthorization(signer, digest, deadline, signature);
        _fileDispute(id, signer, reasonCode, evidenceHash);
    }

    /* ───────────────────────────── governance ──────────────────────────── */

    /**
     * @notice Queue a change to the adapter allowlist.
     * @dev The allowlist is the only privileged surface in this contract, and it is
     *      still not a status-change power: an adapter can only move an obligation
     *      by presenting evidence that satisfies {AscVerify}. The timelock exists so
     *      that installing a malicious adapter cannot be done quietly.
     */
    /**
     * @notice One-time genesis install of the initial adapter set.
     *
     * @dev Without this a fresh deployment is inert for 48 hours: no adapter can
     *      be installed, so no obligation can ever advance, so the registry cannot
     *      be used at all during its own timelock.
     *
     *      This is not a hole in the timelock, because of what the timelock is
     *      actually for. Its purpose is to stop an adapter being installed
     *      QUIETLY into a live registry — to guarantee anyone with capital at risk
     *      gets 48 hours' warning. At genesis nobody has capital at risk: no
     *      obligation exists, no bond has been posted, and anyone evaluating the
     *      deployment is reading its constructor arguments anyway.
     *
     *      The `nextId == 1` guard makes that argument enforceable rather than
     *      merely asserted. The instant the first obligation is registered this
     *      path closes permanently, and every subsequent change — including
     *      re-adding an adapter removed later — goes through the full queue. The
     *      `bootstrapped` flag is redundant with it on purpose: either guard alone
     *      is sufficient, so a future refactor has to defeat both to reopen this.
     */
    function bootstrapAdapters(address[] calldata adapters) external {
        if (msg.sender != timelock) revert NotTimelock(msg.sender);
        if (bootstrapped) revert AlreadyBootstrapped();
        if (nextId != 1) revert RegistryNotEmpty(nextId);

        bootstrapped = true;
        for (uint256 i = 0; i < adapters.length; i++) {
            isAdapter[adapters[i]] = true;
            emit AdapterChanged(adapters[i], true);
        }
        emit Bootstrapped(adapters);
    }

    function queueAdapter(address adapter, bool enabled) external {
        if (msg.sender != timelock) revert NotTimelock(msg.sender);
        uint64 eta = uint64(block.timestamp) + ADAPTER_TIMELOCK;
        adapterEta[adapter] = eta;
        adapterPendingState[adapter] = enabled;
        emit AdapterChangeQueued(adapter, enabled, eta);
    }

    function setAdapter(address adapter) external {
        uint64 eta = adapterEta[adapter];
        if (eta == 0) revert NothingQueued(adapter);
        if (block.timestamp < eta) revert TimelockNotElapsed(eta);

        bool enabled = adapterPendingState[adapter];
        isAdapter[adapter] = enabled;
        delete adapterEta[adapter];
        delete adapterPendingState[adapter];
        emit AdapterChanged(adapter, enabled);
    }

    /* ───────────────────────────── views ───────────────────────────────── */

    function getObligation(uint256 id) external view returns (Obligation memory) {
        return _obligations[id];
    }

    function statusOf(uint256 id) external view returns (Status) {
        return _obligations[id].status;
    }

    function provenanceOf(uint256 id)
        external
        view
        returns (Provenance kind, address signer, bytes32 committedTerms, uint128 registrationBond)
    {
        _mustExist(id);
        return (provenance[id], subjectSigner[id], termsHash[id], registrationBondPosted[id]);
    }

    function disputeOf(uint256 id)
        external
        view
        returns (address signer, bytes32 reasonCode, bytes32 evidenceHash, uint64 filedAt)
    {
        _mustExist(id);
        return (disputedBy[id], disputeReason[id], disputeEvidence[id], disputedAt[id]);
    }

    function hashTerms(ObligationInit calldata init) public pure returns (bytes32) {
        return keccak256(abi.encode(init));
    }

    function obligationAuthorizationDigest(
        ObligationInit calldata init,
        address registrar,
        address signer,
        uint64 expectedChainId,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return _hashTypedData(
            keccak256(
                abi.encode(
                    OBLIGATION_AUTHORIZATION_TYPEHASH,
                    hashTerms(init),
                    registrar,
                    signer,
                    expectedChainId,
                    nonce,
                    deadline
                )
            )
        );
    }

    function disputeAuthorizationDigest(
        uint256 id,
        bytes32 reasonCode,
        bytes32 evidenceHash,
        uint256 nonce,
        uint256 deadline
    ) public view returns (bytes32) {
        return _hashTypedData(
            keccak256(abi.encode(DISPUTE_AUTHORIZATION_TYPEHASH, id, reasonCode, evidenceHash, nonce, deadline))
        );
    }

    /// @notice Height at which the current window closes, and the cure deadline.
    /// @dev Both in source-chain blocks. The adapters compare these against the
    ///      attested head; nothing here consults `block.timestamp`.
    function deadlines(uint256 id) external view returns (uint64 windowEndHeight, uint64 cureEndHeight) {
        Obligation storage o = _obligations[id];
        return (o.windowEndHeight, o.windowEndHeight + o.cureBlocks);
    }

    /// @notice Window the given proven height would satisfy, if any.
    function windowBounds(uint256 id) external view returns (uint64 windowStart, uint64 windowEnd) {
        Obligation storage o = _obligations[id];
        return (o.windowEndHeight - o.periodBlocks, o.windowEndHeight);
    }

    /* ───────────────────────────── internals ───────────────────────────── */

    function _mustExist(uint256 id) internal view returns (Obligation storage o) {
        o = _obligations[id];
        if (o.status == Status.None) revert UnknownObligation(id);
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(
            abi.encode(EIP712_DOMAIN_TYPEHASH, EIP712_NAME_HASH, EIP712_VERSION_HASH, block.chainid, address(this))
        );
    }

    function _hashTypedData(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", domainSeparator(), structHash));
    }

    function _consumeAuthorization(address signer, bytes32 digest, uint256 deadline, bytes calldata signature)
        internal
    {
        if (signer == address(0)) revert InvalidAuthorization(signer);
        if (block.timestamp > deadline) revert AuthorizationExpired(deadline);
        if (consumedAuthorizations[digest]) revert AuthorizationAlreadyUsed(digest);
        consumedAuthorizations[digest] = true;
        bool valid;
        if (signer.code.length == 0) {
            (address recovered, ECDSA.RecoverError err,) = ECDSA.tryRecoverCalldata(digest, signature);
            valid = err == ECDSA.RecoverError.NoError && recovered == signer;
        } else {
            try IERC1271(signer).isValidSignature(digest, signature) returns (bytes4 result) {
                valid = result == IERC1271.isValidSignature.selector;
            } catch {
                valid = false;
            }
        }
        if (!valid) revert InvalidAuthorization(signer);
    }

    function _fileDispute(uint256 id, address signer, bytes32 reasonCode, bytes32 evidenceHash) internal {
        _mustExist(id);
        address expected = subjectSigner[id];
        if (expected == address(0)) revert SubjectAuthorizationRequired(id);
        if (signer != expected) revert UnauthorizedDisputer(signer, expected);
        if (reasonCode == bytes32(0)) revert InvalidDisputeReason();
        if (disputeReason[id] != bytes32(0)) revert AlreadyDisputed(id);

        disputeReason[id] = reasonCode;
        disputedBy[id] = signer;
        disputeEvidence[id] = evidenceHash;
        disputedAt[id] = uint64(block.timestamp);
        emit Disputed(id, reasonCode);
        emit SubjectDisputed(id, signer, reasonCode, evidenceHash);
    }

    function _setStatus(uint256 id, Obligation storage o, Status to) internal {
        Status from = o.status;
        if (from == to) return;
        o.status = to;
        emit StatusChanged(id, from, to, msg.sender);
    }

    /**
     * @dev Credits the registrar's bond and any unspent keeper escrow once the
     *      obligation can generate no further work.
     *
     *      Pull, not push. A registrar whose address reverts on receipt must not be
     *      able to block settlement of an obligation — settlement is a fact about a
     *      borrower's record, and it cannot be held hostage by a creditor's wallet.
     *      Pushing would force a choice between reverting (hostage) and swallowing
     *      the failure (stranded funds); crediting avoids both.
     */
    function _refundEscrow(uint256 id, Obligation storage o) internal {
        uint128 amount = o.registrarBond + o.keeperFund;
        if (amount == 0) return;

        o.registrarBond = 0;
        o.keeperFund = 0;
        withdrawable[o.registrar] += amount;

        emit BondEscrowReleased(id, o.registrar, amount);
    }

    /// @notice Withdraw escrow credited by settled obligations.
    function withdraw() external {
        uint256 amount = withdrawable[msg.sender];
        if (amount == 0) return;

        withdrawable[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert BountyTransferFailed(msg.sender);

        emit Withdrawn(msg.sender, amount);
    }

    receive() external payable {}
}
