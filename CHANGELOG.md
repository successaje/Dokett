# Changelog

All protocol releases are immutable deployments. A release records the source
commit, network, configuration, contract addresses and deployment transactions
needed to reproduce it.

## [Unreleased]

## [0.2.0] - 2026-09-13

### Added

- EIP-712 subject-authorized obligation registration, including EIP-1271 smart accounts.
- Immutable origination provenance, terms commitments and registration-bond history.
- Authenticated direct and relayed disputes with one-shot authorization digests.
- Lens quarantine for subject-authenticated disputes.
- Encumbrance adapter deployment in the standard protocol stack.
- Versioned deployment manifests and manifest-driven bootstrap.

### Changed

- Corrected the worker ABI for the `Registered` event.
- Preserved a claim's bonded-at-registration classification after settlement.
- Reconciled protocol documentation with source-height deadlines and terminal defaults.

### Deployment status

Deployed, bootstrapped and source verified on Creditcoin CC3 testnet. Addresses,
configuration and transaction receipts are recorded in `docs/RELEASES.md`.

## [0.1.0] - 2026-08-17

- First CC3 testnet deployment of Register, AscVerifier, PaymentAdapter,
  SilenceAdapter and Bond.
- Autonomous payment, delinquency, cure, default and first-loss slashing flows.
- Public Lens API, keeper, cure relay and Console.

[Unreleased]: https://github.com/successaje/Dokett/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/successaje/Dokett/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/successaje/Dokett/releases/tag/v0.1.0
