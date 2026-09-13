# Protocol releases

Dokett contracts are not upgradeable. Every protocol version is a new immutable
deployment. Earlier deployments remain available as reproducible historical
artifacts; service cutovers never change their state or addresses.

## Release policy

Each release must identify:

1. the exact Git tag and 40-character source commit;
2. the Creditcoin chain ID and source-chain binding;
3. every deployed address and deployment transaction;
4. security-relevant configuration and bootstrap transactions;
5. contract verification status and test results;
6. any migration or service-cutover boundary.

Deployment manifests use `deployments/<chainId>-<version>.json`. The unversioned
`deployments/<chainId>.json` is only the service default and is updated after the
new release has passed live checks.

## v0.2.0 — authenticated provenance

**Source:** pending release tag  
**Network:** Creditcoin CC3 testnet · chain ID `102031`  
**Source chain:** Ethereum mainnet · chain key `3`  
**Status:** release preparation

This release adds subject-signed origination, immutable terms provenance,
authenticated dispute quarantine, permanent bond-at-registration history and
the EncumbranceAdapter to the standard deployment.

Contract addresses, deployment transactions, block, bootstrap transactions and
Blockscout verification links are added here immediately after broadcast.

## v0.1.0 — first public deployment

**Source tag:** [`v0.1.0`](https://github.com/successaje/Dokett/tree/v0.1.0)  
**Source commit:** `2b7893575b58fbba25aae5eee75ecf65afacf60a`  
**Network:** Creditcoin CC3 testnet · chain ID `102031`  
**Deployment block:** `5,324,811`

| Contract | Address |
|---|---|
| Register | [`0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5`](https://creditcoin-testnet.blockscout.com/address/0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5) |
| AscVerifier | [`0x02406b6d17E743deA7fBbfAE8A15c82e4481E168`](https://creditcoin-testnet.blockscout.com/address/0x02406b6d17E743deA7fBbfAE8A15c82e4481E168) |
| PaymentAdapter | [`0xA68f1CBff869a7f6c7A9BC9313E0B9E135A79a60`](https://creditcoin-testnet.blockscout.com/address/0xA68f1CBff869a7f6c7A9BC9313E0B9E135A79a60) |
| SilenceAdapter | [`0x8e827a12C78dED9459268eb05cce2C5d709FE6AF`](https://creditcoin-testnet.blockscout.com/address/0x8e827a12C78dED9459268eb05cce2C5d709FE6AF) |
| Bond | [`0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e`](https://creditcoin-testnet.blockscout.com/address/0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e) |

The v1 Console and populated demonstration remain available while v0.2.0 is
deployed and validated. No v1 state is migrated or rewritten.
