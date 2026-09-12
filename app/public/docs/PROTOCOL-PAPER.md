# Dokett: A Verifiable Credit Coordination Layer for On-Chain Lending

**Protocol paper · Version 0.1 · September 2026**  
**Implementation:** Creditcoin CC3 testnet · **Source:** [github.com/successaje/Dokett](https://github.com/successaje/Dokett)

---

## Abstract

On-chain credit markets can verify collateral and settlement inside their own
contracts, but they rarely share a durable account of what a borrower already
owes, whether an asset has already been pledged, or how an obligation performed
after origination. Each venue therefore underwrites from an incomplete view and
rebuilds the same evidence, lifecycle and indexing machinery.

Dokett is a shared obligation and encumbrance registry on Creditcoin. It models
a promise to pay as a first-class on-chain object with terms, status, evidence
history, dispute state and optional named first-loss capital. Ethereum payment
events are admitted through Creditcoin Universal Smart Contracts (USC). Deadlines
are evaluated against USC's attested Ethereum height, so a caller may trigger a
transition but cannot choose its result.

Dokett makes a narrower claim than a credit bureau or court. It records what was
registered, what qualifying evidence was verified, and whether that evidence was
submitted before an attested-height deadline. It does not determine whether an
underlying debt was legally agreed, prove that no payment occurred anywhere, or
make a lender's credit decision. Those boundaries are part of the protocol.

## 1. The coordination problem

Credit is relational. A new lender needs facts created by prior lenders: open
exposure, repayment performance, defaults, seniority and collateral claims.
Today those facts are fragmented across contracts, chains and private systems.
The result is duplicated diligence and a structural double-financing risk.

Moving loan contracts on-chain does not by itself create a shared credit record.
A lending venue still needs a common object model, a source of admissible
cross-chain evidence, deterministic lifecycle rules and a query surface that
other venues can consume without inheriting its underwriting policy.

Dokett separates these responsibilities:

1. **USC establishes admissible cross-chain evidence and an attested clock.**
2. **Dokett records obligations and applies deterministic transitions.**
3. **The Lens projects neutral, queryable facts from protocol events.**
4. **Lenders and RWA platforms apply their own risk policies.**

## 2. Protocol scope

An obligation contains the minimum information required to evaluate a scheduled
promise: obligor commitment, creditor, principal, payment asset, source chain,
payer and payee bindings, payment schedule, cure window, seniority and an
optional collateral reference.

The registry provides four shared functions:

| Function | Protocol output |
|---|---|
| Obligation record | Terms, lifecycle state and an append-only transition docket |
| Solvency view | Open bonded exposure, reported separately from unbonded claims |
| Encumbrance view | Live claims associated with a collateral reference |
| Performance history | Proven payments, adverse outcomes and underwriting results |

Dokett is neither a lender nor a scoring model. It returns evidence-bearing facts
and keeps policy outside the registry. A venue may reject all unbonded claims,
require a specific registrar set, cap exposure by asset class, or ignore Dokett
entirely. The record remains shared while the decision stays local.

## 3. System architecture

```text
Ethereum mainnet
  ERC-20 payment event
          │
          ▼
Creditcoin USC attestation and proof
          │
          ▼
AscVerifier ── receipt success · event binding · confirmations · replay guard
          │
          ├── PaymentAdapter ── proof present ──▶ advance or cure
          │
          └── SilenceAdapter ── deadline passed ─▶ delinquent or default
                                      │
                                      ▼
Register ── obligation state ── Bond ── named first-loss capital
    │
    ▼
Lens API ── solvency · encumbrance · obligation · profile
    │
    ▼
Independent lender or RWA policy
```

Creditcoin is the ledger of record and the venue of consequence. Ethereum is a
source of evidence. Dokett does not move or seize funds on Ethereum; verified
source-chain facts update Creditcoin state and may release or slash capital held
by Dokett contracts on Creditcoin.

## 4. Obligation lifecycle

An obligation advances through a constrained state machine:

| State | Meaning | Admissible next evidence or condition |
|---|---|---|
| Active | Registered; no scheduled payment has yet been proven | Qualifying payment proof |
| Current | Required payments are proven through the current window | Next payment proof or deadline evaluation |
| Delinquent | No qualifying proof was recorded by the deadline | Late proof during cure, or cure expiry |
| Default | Cure expired without a qualifying proof | Terminal adverse record; bonds may be slashed |
| Settled | Schedule has been satisfied | Terminal successful record; bonds may be released |
| Charged off / void | Obligation has been terminated under its defined path | Terminal |

Post-registration status does not follow a reporter's assertion. Every advance
must be caused by a USC-verified event or by a comparison with the attested
source-chain height. Keepers are permissionless and replaceable: they supply
transactions, but the contracts derive the result.

### What “default by silence” means

Dokett does not use an inclusion proof to claim that an event never happened.
Its exact claim is:

> No admissible payment proof for this obligation window was recorded before
> USC's attested Ethereum height passed the deadline and the cure path expired.

This distinction matters. A qualifying payment made within the window may cure a
delinquency while the cure period remains open. A borrower who paid but never
submits proof before cure expiry may still be recorded in default. Permissionless
submission, low proof cost, keeper incentives and a gas-sponsored cure relay
reduce that risk; they do not erase it.

## 5. USC integration

USC supplies two primitives that Dokett cannot safely manufacture itself:
verifiable Ethereum transaction evidence and an attested Ethereum block height.

The payment path is:

1. An ERC-20 payment is included on Ethereum.
2. A proof for the transaction and receipt is submitted on Creditcoin.
3. `AscVerifier` calls the USC verification precompiles.
4. The verifier requires a successful receipt, binds the expected transfer,
   enforces confirmation depth and rejects a consumed proof key.
5. `PaymentAdapter` applies the verified event to the correct obligation window.
6. `Register` updates the lifecycle and records the transition.

The deadline path uses USC's attested head instead of wall time. `SilenceAdapter`
compares that head with the obligation's scheduled height. If the attested head
stalls, penalty paths are disabled. A failure of the evidence network may delay a
delinquency or default; it must not manufacture one.

The deployed implementation retains the names `AscVerify` and `AscVerifier`
from the earlier Attestcoin Smart Contracts terminology. They are the protocol's
guard layer around the USC primitives.

## 6. Legitimacy, disputes and economic weight

Permissionless registration creates useful openness and a legitimacy problem:
any account can allege an obligation against a subject. Dokett does not turn
registration into proof of consent or legal enforceability.

The protocol therefore separates existence from weight:

- A **registered claim** proves that a registrar created the on-chain object.
- A **registrar bond** puts capital behind that claim.
- An **unbonded claim** remains visible but is never summed with bonded exposure.
- A **dispute** quarantines a contested record for consumers to handle explicitly.
- A **verified payment** proves that the configured event passed USC and Dokett's
  admission rules; it does not validate the original legal agreement.

A future production version should support subject-signed origination terms,
domain-specific registrar policies and an adjudication process for bad-faith
registration. Until then, integrations should treat Dokett as an evidence
registry with disclosed provenance, not as a legal judgment engine.

## 7. Named first-loss underwriting

Underwriters may post capital against one named obligation and quote a spread.
The position is obligation-specific rather than pooled, making the risk opinion
and its outcome inspectable. If the obligation settles, principal and funded
premium are released according to the contract. If it defaults, live bonds are
slashed pro rata to the creditor in the same transaction as finalization, capped
by posted capital.

Bonding serves two purposes. It gives a claim economic weight and produces an
observable underwriting record based on capital actually exposed. It is not a
guarantee that covers the full debt, and the spread is not a protocol-issued
credit score.

## 8. Integration surface

The Lens is a read-only projection over on-chain events. It holds no privileged
write authority and exposes the same public endpoints used by the Console and
the reference DemoBank integration:

```text
GET /solvency/:entity      open exposure, with bonded and unbonded separated
GET /encumbrance/:asset    live claims against a collateral reference
GET /obligation/:id        terms, state, evidence docket and bond positions
GET /profile/:subject      proven performance and disclosed attestations
```

An integration should query Dokett immediately before an underwriting or
collateral decision, preserve the response height, and apply its own acceptance
rules. The near-term validation target is one independent protocol testing these
queries against a real decision and specifying the schema or adapter work needed
for a pilot.

## 9. Security and trust model

Dokett inherits USC's evidence trust assumptions. In the current deployment, the
attestor set is permissioned. This is the protocol's largest external dependency
and should constrain production exposure until decentralization and economic
security improve.

Application-level controls include:

- successful-receipt verification before event decoding;
- proof replay protection;
- confirmation depth enforced against the attested head;
- a liveness gate that blocks penalties when observation is stale;
- re-derived default conditions before bond slashing;
- reentrancy protection and bounded bond iteration;
- explicit separation of bonded and unbonded claims; and
- high-entropy obligor commitments rather than direct identity data.

Current privacy is limited. Payer addresses, payee addresses and amounts remain
public. On-chain registration is not legal lien perfection in any jurisdiction.
The deployment uses synthetic borrowers and should not contain real personal
data. The complete analysis is maintained in the [threat model](https://github.com/successaje/Dokett/blob/main/docs/THREAT-MODEL.md).

## 10. Current implementation

The protocol is deployed on Creditcoin CC3 testnet at chain ID 102031. The build
uses Ethereum mainnet evidence through USC and includes source-verified contracts,
a keeper, a public Lens API, the Dokett Console and DemoBank reference lender.

| Contract | CC3 address |
|---|---|
| Register | [`0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5`](https://creditcoin-testnet.blockscout.com/address/0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5) |
| AscVerifier | [`0x02406b6d17E743deA7fBbfAE8A15c82e4481E168`](https://creditcoin-testnet.blockscout.com/address/0x02406b6d17E743deA7fBbfAE8A15c82e4481E168) |
| Bond | [`0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e`](https://creditcoin-testnet.blockscout.com/address/0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e) |
| PaymentAdapter | [`0xA68f1CBff869a7f6c7A9BC9313E0B9E135A79a60`](https://creditcoin-testnet.blockscout.com/address/0xA68f1CBff869a7f6c7A9BC9313E0B9E135A79a60) |
| SilenceAdapter | [`0x8e827a12C78dED9459268eb05cce2C5d709FE6AF`](https://creditcoin-testnet.blockscout.com/address/0x8e827a12C78dED9459268eb05cce2C5d709FE6AF) |

The current public demonstration covers every lifecycle state, real Ethereum
mainnet payment evidence, permissionless proof submission, an autonomous default
and an executed first-loss slash. Contract, projection and relay behavior is
covered by 99 tests.

## 11. Development path

Dokett's next milestones are measured by external use rather than deposited
value:

1. Complete one integration review against a real underwriting or collateral
   workflow.
2. Add subject-signed origination evidence and a production dispute framework.
3. Pilot named first-loss capital with an independent credit venue.
4. Standardize the obligation interface and add a second evidence backend.
5. Extend selective disclosure before any use with real borrower data.

The protocol becomes shared infrastructure when an independent venue queries the
record before taking risk and can verify every fact it relied upon.

## Conclusion

Dokett treats credit history as shared, verifiable state rather than a private
score. USC makes cross-chain payment evidence and source-chain progress readable
to Creditcoin contracts; Dokett turns those primitives into obligations,
encumbrances and deterministic lifecycle outcomes; lenders retain control of the
decision. The result is a narrow coordination layer designed to make existing
credit markets more interoperable without asking a registry operator to decide
what is true.
