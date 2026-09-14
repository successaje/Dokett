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

**Source tag:** [`v0.2.0`](https://github.com/successaje/Dokett/tree/v0.2.0)
**Deployed contract source:** [`0975d207b533bbd7fe73bc5e6a4ebe314b527b7f`](https://github.com/successaje/Dokett/commit/0975d207b533bbd7fe73bc5e6a4ebe314b527b7f)
**Network:** Creditcoin CC3 testnet · chain ID `102031`
**Source chain:** Ethereum mainnet · chain key `3`
**Deployment block:** [`5,482,440`](https://creditcoin-testnet.blockscout.com/block/5482440)
**Bootstrap block:** [`5,482,454`](https://creditcoin-testnet.blockscout.com/block/5482454)
**Status:** deployed, bootstrapped and source verified

**Validation:** 85 Foundry tests, 13 Lens tests and 16 relay tests; Console
production build passed.

This release adds subject-signed origination, immutable terms provenance,
authenticated dispute quarantine, permanent bond-at-registration history and
the EncumbranceAdapter to the standard deployment.

| Contract | Verified address | Deployment transaction |
|---|---|---|
| Register | [`0xdcCF757C996Ee36E7f40B81a583B4B3692956281`](https://creditcoin-testnet.blockscout.com/address/0xdcCF757C996Ee36E7f40B81a583B4B3692956281) | [`0xacc517…60f7af`](https://creditcoin-testnet.blockscout.com/tx/0xacc5174d318aad8a4633fdb7978119a1680b1c9d3137ba1b6e37dee99c60f7af) |
| AscVerifier | [`0x0aF5Edf93C35608a3EfC3C741Cc261de6da55522`](https://creditcoin-testnet.blockscout.com/address/0x0aF5Edf93C35608a3EfC3C741Cc261de6da55522) | [`0x303b6c…1d23ff`](https://creditcoin-testnet.blockscout.com/tx/0x303b6cd6a52a91e90c8f7464c1bd13b77e694ca2b46b518197470c75db1d23ff) |
| Bond | [`0xb08fbE5b83CaE7FC167ad670CDd73Ece211D0ceA`](https://creditcoin-testnet.blockscout.com/address/0xb08fbE5b83CaE7FC167ad670CDd73Ece211D0ceA) | [`0x77f1b5…29813a`](https://creditcoin-testnet.blockscout.com/tx/0x77f1b5c89d58a04a2c93a501a7177f5e815645c596a4ccee064005e70929813a) |
| PaymentAdapter | [`0xcD322Ffd7988B90e5C6BFeD4e93b2cfCFfA366cA`](https://creditcoin-testnet.blockscout.com/address/0xcD322Ffd7988B90e5C6BFeD4e93b2cfCFfA366cA) | [`0xa3bb0c…5147df`](https://creditcoin-testnet.blockscout.com/tx/0xa3bb0cfce9d1d893b0baf08527a557a55571e4f47f2878cc6b0da5317b5147df) |
| SilenceAdapter | [`0xDa70Aa4A3A666536a5975e6D9969E5BBd5A06C8d`](https://creditcoin-testnet.blockscout.com/address/0xDa70Aa4A3A666536a5975e6D9969E5BBd5A06C8d) | [`0xd2c5d5…48c797`](https://creditcoin-testnet.blockscout.com/tx/0xd2c5d58dd87190331aeeb8c4a01dc17d65d1e35382d349cadedb19801448c797) |
| EncumbranceAdapter | [`0x73713DD8865353270f548917F707DF29Cc944B2f`](https://creditcoin-testnet.blockscout.com/address/0x73713DD8865353270f548917F707DF29Cc944B2f) | [`0x13b926…781796`](https://creditcoin-testnet.blockscout.com/tx/0x13b926d7b8ed839e85a80e3c9da5994aabeee4a0369aed3e5c90acd79e781796) |

The verifier was initialized in [transaction `0x9e4a47…ed1865`](https://creditcoin-testnet.blockscout.com/tx/0x9e4a47be2b7f646a5d64893a2d90a7188edf9c6f29dd93b1fd1afb7d09ed1865).
The initial estimate supplied too little gas and reverted without changing state;
the successful initialization used the same configuration with an explicit gas
limit. The three adapters were installed through the one-time
[`bootstrapAdapters`](https://creditcoin-testnet.blockscout.com/tx/0x624b33e617b831908d3ac39fba2ab67db2f0dfa0449f4612bb058a42b7bc81d2)
path, and MockUSDC was allowlisted for bonds in
[transaction `0x113680…893a0`](https://creditcoin-testnet.blockscout.com/tx/0x1136806a35734f3d5d62b491c14c949df34c415298e441bbeab609266a4893a0).

### Live provenance checks

Three synthetic obligations make the new security boundary independently
inspectable:

- Obligation 1 entered through a subject's EIP-712 authorization:
  [registration transaction](https://creditcoin-testnet.blockscout.com/tx/0x2fbe3e11f09b61c9f89462ce699f1b9d4424a354f03c6ade33f2fe5dd0c64180).
- Obligation 2 entered through a different subject authorization, then that
  subject signed a one-shot dispute relayed by the registrar:
  [registration](https://creditcoin-testnet.blockscout.com/tx/0x6cde56eb900d6fb484db99b93a1640acb1e919b27fd4652165c3bb22c3ce1e54) ·
  [authenticated dispute](https://creditcoin-testnet.blockscout.com/tx/0x469eca2ccf238972ba806449d37f56bd416f8421eb1a50ae2c557db7eb3c1d9e).
- Obligation 3 is a bonded
  [registrar assertion without a subject signature](https://creditcoin-testnet.blockscout.com/tx/0x99e6e24b0151426e93e600244dc004cecf5b5146f9637d44334fee850f52a9a0),
  retained as a separate exposure class for the DemoBank policy demonstration.

The public signer addresses, terms commitments, evidence hash and blocks are in
[`seed-provenance-v0.2.0-102031.json`](https://github.com/successaje/Dokett/blob/main/deployments/seed-provenance-v0.2.0-102031.json).
No synthetic subject private key is stored.

The Lens reports gross registered, subject-authorized, registrar-asserted,
contested and underwriting-eligible exposure separately. DemoBank consumes
those facts and stops automatic approval for asserted or contested records
without representing either as zero debt.

### Service cutover and first external venue

The v0.2 Lens is live at [dokett-lens-v2.fly.dev](https://dokett-lens-v2.fly.dev)
and indexes from deployment block `5,482,440`. The Console selects between this
projection and the unchanged v1 demonstration instead of migrating either
release's state.

The first governed external schema is Aave V3 Ethereum's
`ReserveUsedAsCollateralEnabled(address,address)` event. It was
[queued on CC3](https://creditcoin-testnet.blockscout.com/tx/0x89eff9feae6e6ebe48bb858ccd5656f0cdee6fcf4ba7c54cdd94dd292264829d)
and becomes activatable at `2026-09-15T22:30:00Z`, after the adapter's mandatory
48-hour delay. Its selected Ethereum receipt, indexed asset and holder, verified
state at the attested head, and derived collateral reference are recorded in
[`deployments/encumbrance-aave-v3-102031.json`](../deployments/encumbrance-aave-v3-102031.json).

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

The v1 populated demonstration remains available through the Console release
selector. No v1 state is migrated or rewritten.
