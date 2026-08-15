// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {AscVerify} from "./lib/AscVerify.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/decoding/EvmV1Decoder.sol";

interface IAdapterAllowlist {
    function isAdapter(address) external view returns (bool);
}

/**
 * @title AscVerifier
 * @notice The single deployed instance of {AscVerify} that the whole system shares.
 *
 * @dev Why one instance rather than each adapter inheriting AscVerify directly:
 *
 *      1. REPLAY. The consumed-proof map is per-contract state. Two adapters each
 *         carrying their own copy means a payment proof spent at one is still fresh
 *         at the other — evidence double-spend, and precisely what the global proof
 *         key exists to prevent.
 *
 *      2. LIVENESS (I7). The observation record is also per-contract state. Split it
 *         across contracts and each keeps a partial view of the same chain, so a gap
 *         that should disable penalties everywhere disables them only where it was
 *         noticed. Continuous observation only means something if there is one
 *         record of it.
 *
 *      Access is derived from the Register's adapter allowlist rather than kept in a
 *      second list here. One source of truth, one timelock, no drift between "may
 *      move status" and "may consume evidence" — a contract that could burn proof
 *      keys without being able to act on them would be a pure griefing primitive.
 */
contract AscVerifier is AscVerify {
    IAdapterAllowlist public register;
    address private immutable _deployer;

    error AlreadyInitialized();
    error NotDeployer(address caller);
    error NotAuthorized(address caller);
    error NotInitialized();

    event Initialized(address register);

    constructor(uint64 minConfirmations_, uint64 maxSampleGap_, uint64 recoveryGrace_)
        AscVerify(minConfirmations_, maxSampleGap_, recoveryGrace_)
    {
        _deployer = msg.sender;
    }

    /**
     * @notice Bind this verifier to the Register whose allowlist governs it.
     * @dev One-time, deployer-only. The Register needs the verifier's address at
     *      construction and the verifier needs the Register's, so one of the two
     *      links has to be made after the fact. Deploy scripts must call this in the
     *      same transaction bundle as construction; a verifier left uninitialized is
     *      inert rather than permissive, so the failure mode is a dead system, not
     *      an open one.
     */
    function initialize(IAdapterAllowlist register_) external {
        if (msg.sender != _deployer) revert NotDeployer(msg.sender);
        if (address(register) != address(0)) revert AlreadyInitialized();
        register = register_;
        emit Initialized(address(register_));
    }

    modifier onlyAdapter() {
        if (address(register) == address(0)) revert NotInitialized();
        if (!register.isAdapter(msg.sender)) revert NotAuthorized(msg.sender);
        _;
    }

    /**
     * @notice Verify an ASC proof and match it as an ERC-20 Transfer in one call.
     * @dev Restricted, because verification has a side effect: it burns the proof
     *      key. If anyone could call this, they could consume the key for a real
     *      payment and leave the borrower unable to prove it — a cheap way to
     *      manufacture a default. Only contracts that can act on the result may
     *      spend it.
     * @return value  the transferred amount, as decoded from the proven log
     * @return height the source-chain block height the proof binds the transfer to
     */
    function proveErc20Transfer(
        Proof calldata p,
        address token,
        address from,
        address to,
        uint256 minValue
    ) external onlyAdapter returns (uint256 value, uint64 height) {
        EvmV1Decoder.LogEntry memory log = _verify(p);
        value = _requireErc20Transfer(log, token, from, to, minValue);
        height = p.height;
    }

    /// @notice Batch form: up to MAX_BATCH transfers sharing one continuity proof.
    function proveErc20TransferBatch(
        BatchProof calldata p,
        address token,
        address from,
        address to,
        uint256 minValue
    ) external onlyAdapter returns (uint256 totalValue) {
        EvmV1Decoder.LogEntry[] memory logs = _verifyBatch(p);
        for (uint256 i = 0; i < logs.length; i++) {
            totalValue += _requireErc20Transfer(logs[i], token, from, to, minValue);
        }
    }
}
