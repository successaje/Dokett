<!--
  DRAFT — becomes /README.md in the submission repo on 13 Aug.
  Placeholders marked <!-- FILL --> must all be resolved before submitting.
  Written 29 Jul 2026 as a template. Prose is final; facts get filled in during the build.
-->

# Dokett

**The obligation layer for the open economy.**
A registry where a promise to pay is a first-class on-chain object, and its state advances only on cryptographically verified evidence — never on anyone's word.

Built on **Attestcoin Smart Contracts (ASCs)** · Creditcoin CC3 Testnet · BUIDL CTC 2026 Fall, RWA track

<!-- FILL: badges — CI, licence, testnet deployment -->

| | |
|---|---|
| **Live demo** | <!-- FILL: URL --> |
| **Demo video** | <!-- FILL: URL --> |
| **Deck** | <!-- FILL: PDF URL --> |
| **Contracts (CC3 testnet)** | <!-- FILL: Register / Bond / adapters / AscVerify --> |
| **Source chain** | Ethereum **mainnet**, chainkey 3 on CC3 testnet |

---

## The problem

There is $14B of active tokenized private credit on-chain and $20B of tokenized real-world assets, and underneath all of it there is **no credit bureau, no lien registry, and no bankruptcy court**.

A borrower — retail or institutional — can hold obligations at five protocols across four chains, and none of them can see the others. Every credit blowup of the last cycle was the same failure: not fraud we couldn't punish, but leverage we couldn't *see*.

Previous attempts failed for reasons that are now well understood:

| | Why it died |
|---|---|
| On-chain credit scores | A number with no recourse and no sybil cost. Nobody lends against an opinion. |
| Aave credit delegation | The delegator got no upside and no enforcement. |
| Goldfinch | **Not an underwriting failure — an observability failure.** Borrowers reported performance in PDFs. |
| Maple v1 | Pool delegates with no cross-venue visibility → correlated blowups. |

Every one of these was attacked with better *models*. None was attacked with better *evidence*.

## What changed

Repayments moved on-chain — stablecoin settlement means a repayment is now an **event**, not a report. And in June 2026 ASC readability shipped to Creditcoin mainnet: a contract here can cryptographically verify an Ethereum event in one block for about **$0.000024**.

For the first time, the performance of a loan is something a contract can *check* rather than something a human tells you.

---

## What Dokett is

**A Liability Object** — a promise to pay, on-chain:

```
obligor (commitment, never PII) · principal · schedule · seniority · collateral ref
status: Active → Current → Delinquent → Default → Settled
```

Status advances **only** when an ASC proof of the corresponding Ethereum event is verified by the `BlockProver` precompile, or when a deadline measured in Creditcoin block time expires. No party can assert a transition.

**The inversion.** Every other ASC project proves that something *happened*. Dokett's `SilenceAdapter` handles the case where nothing did: an obligation **degrades unless proof of payment arrives**. No reporter, no committee, no oracle operator. Default is the default.

To be precise about what that means, because it matters: *you cannot prove a negative with an inclusion proof.* Dokett does **not** claim to prove that no payment occurred on Ethereum. It proves an on-chain fact about Creditcoin state —

> no admissible proof of payment for this window was presented before it closed

— which is economically equivalent to non-payment, because submission is permissionless, costs ~$0.000024, and the borrower is the party most motivated to submit. And if it is ever wrong, **the proof still cures it**: a payment proof whose *source-chain* timestamp falls inside the missed window restores `Current` even when submitted late. Nobody has to volunteer bad news, and nobody can suppress it.

**The market on top.** Bonded underwriters stake first-loss capital against a **named** borrower — not a pool, not a score. They earn the spread when the borrower pays and are **slashed by proof** when they don't. This puts the credit decision where the information actually is: the loan officer, the employer, the co-op, the merchant acquirer. A borrower's cost of credit becomes a live market price instead of a model's opinion.

---

## How ASCs are used

Full detail in [`docs/ASC-INTEGRATION.md`](./ASC-INTEGRATION.md). Summary:

1. **Real Ethereum mainnet evidence, from testnet.** CC3 testnet attests Ethereum mainnet at chainkey 3. Every proof in the demo is against a real mainnet transaction, not a Sepolia transaction we sent ourselves.
2. **Presence** — `PaymentAdapter` verifies inclusion of a qualifying ERC-20 `Transfer` and advances the obligation.
3. **Absence** — `SilenceAdapter` inverts the primitive to drive degradation, enabling permissionless default detection with no reporter.
4. **Deep history** — the demo verifies a transaction over two years old, exercising ASC's continuity-proof cost curve. A permanent credit registry is only economic on a chain with this cost curve.
5. **Batching** — the registry sweep amortises one continuity proof across up to ten queries via `verifyBatch()`.
6. **Liveness circuit breaker** — if the attested head goes stale, all degradation paths revert. A stalled oracle must never manufacture defaults.

### `AscVerify.sol` — published standalone, MIT

The `BlockProver` precompile **does not validate whether the proven transaction succeeded**. A reverted ERC-20 transfer is still a validly-included transaction, so any contract that proves a payment without checking the receipt status can be cleared for free.

`AscVerify.sol` is the single door to the outside world in this codebase, and it handles the things every ASC integrator has to get right:

- asserts receipt `status == 0x1`
- replay-guards every proof on `(chainKey, txHash, logIndex, loId)`
- enforces confirmation depth against the attested head
- circuit-breaks on a stale attestation head
- resolves chainkeys from `ChainInfo` rather than hardcoding them

It is released MIT as a standalone contract for the ecosystem. <!-- FILL: link to the standalone repo/package -->

---

## Architecture

<!-- FILL: inline the §2 diagram from docs/ARCHITECTURE.md -->

| Contract | Role |
|---|---|
| `lib/AscVerify.sol` | The only door to the outside world. All ASC verification, guards, and the circuit breaker. |
| `Register.sol` | Liability Objects, the status machine, registration bonds, disputes. |
| `adapters/PaymentAdapter.sol` | Proof present → advance the obligation; also the cure path. |
| `adapters/SilenceAdapter.sol` | Proof absent → delinquency, cure window, default. |
| `Bond.sol` | Named first-loss capital; slashed atomically on proven default. |
| Lens (off-chain) | Indexer + free public `getSolvency()` / `getEncumbrance()` API. |
| Keeper (off-chain) | Permissionless bot: finds payments, builds proofs, submits, marks delinquencies. |

Design specification: [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) · Threat model: [`docs/THREAT-MODEL.md`](./THREAT-MODEL.md)

---

## Quickstart

```bash
git clone <!-- FILL --> && cd dokett
cp .env.example .env          # RPCs, proof builder URL, deployer key
pnpm install
forge test                    # unit + fork + invariant
forge script script/Deploy.s.sol --rpc-url $CC3_TESTNET --broadcast
pnpm --filter worker start    # keeper
pnpm --filter lens start      # indexer + API
pnpm --filter app dev         # demo UI
```

Reproduce the demo end to end:

```bash
pnpm demo:seed     # register the obligation, post the bond
pnpm demo:pay      # prove period 1 against a real Ethereum mainnet tx
pnpm demo:silence  # advance time, mark delinquent, finalize, slash
pnpm demo:history  # verify a 2-year-old mainnet tx and print the gas
```

<!-- FILL: confirm every command actually works from a clean clone. A judge will try this. -->

---

## Trust assumptions

Stated plainly, because a reviewer should not have to discover them.

Dokett inherits the trust model of the ASC attestor set. As of July 2026 that set is **permissioned** (`AuthorizedOnly` election mode), with a mainnet minimum bond of **0 CTC** and no publicly documented slashing regime. Dokett is therefore, today, a system with a curated federation at its evidence root — materially stronger than a multisig bridge, materially weaker than a ZK light client.

We treat this as the protocol's most important external dependency and design around it: per-obligation exposure caps, and an `AscVerify` abstraction that allows a second evidence backend (ZK storage proofs, an alternate messaging layer) to be swapped in without touching `Register`.

**Privileged functions.** The adapter allowlist, behind a 48-hour timelock, is the *only* privileged surface. No privileged role can transition an obligation's status directly, and no privileged role can prevent a borrower from curing. Both are asserted as invariants in the test suite (INV-9, INV-10).

## Known limitations

Honest, and deliberately not buried:

- **Privacy is v1.** Identity is a commitment (≥128-bit salt, client-side, never reused), but `sourcePayer`, `sourcePayee` and all amounts are **public by construction**. The roadmap answer is a source-chain payment router giving each obligation an ephemeral payer address, plus ZK selective disclosure over the schedule tree. Do not put real people's data in this registry today.
- **One source chain.** Ethereum mainnet only, because that is what ASC attests today.
- **Registry spam is priced, not adjudicated.** Anyone can register an obligation against any address; registrar bonds and Lens weighting make it expensive, and `dispute()` quarantines contested claims, but v1 does not adjudicate bad-faith registration.
- **Wash underwriting is priced, not prevented.** Fabricating a repayment history costs its face value in real on-chain transfers — unlike a self-reported score — but Dokett does not solve identity. It makes identity someone's *priced* problem.
- **False-default residual.** A borrower who paid but whose proof nobody submits within window + buffer + cure is wrongly defaulted. Mitigated by permissionless submission, near-zero cost, a 7-day cure, borrower self-service in the UI, and keeper incentives. This residual is the honest price of having no trusted reporter.
- **On-chain registration is not legal lien perfection** in any jurisdiction.
- **Testnet, synthetic data.** No real borrower information appears anywhere in this repository.

## Test coverage

<!-- FILL after build: table mapping each threat (T-01…T-15) and invariant (INV-1…INV-10) to its test -->

| Invariant | Test |
|---|---|
| INV-4 — every transition is preceded by a verified proof or a timestamp comparison | <!-- FILL --> |
| INV-6 — stale attestation head ⟹ no obligation can reach Delinquent or Default | <!-- FILL --> |
| INV-8 — a proof inside the missed window always cures | <!-- FILL --> |
| INV-9 — no privileged role can transition status directly | <!-- FILL --> |
| INV-10 — no privileged role can prevent a cure | <!-- FILL --> |

Full list: [`docs/THREAT-MODEL.md`](./THREAT-MODEL.md) §4.

## Roadmap

| | |
|---|---|
| 0–3 mo | Mainnet v0; import historical loan records as commitment-form obligations → non-zero coverage on day one |
| 3–6 mo | Free encumbrance API; 3 venues querying; `AscVerify` adopted as an ecosystem standard |
| 6–12 mo | Underwriting bonds with real capital in the Nigeria corridor; first proven mainnet default |
| 12–24 mo | ERC standard for Liability Objects; Registrar Council; attested Register mirrors on Ethereum/Base |

## Team

<!-- FILL: name, role, bio, links -->

## Licence

MIT. `contracts/lib/AscVerify.sol` is additionally published standalone for ecosystem use.
