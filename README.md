# Covenant

**The obligation layer for the open economy.**

A registry where a promise to pay is a first-class on-chain object, and its state advances only on cryptographically verified evidence — never on anyone's word.

Built on **Attestcoin Smart Contracts (ASCs)** · Creditcoin CC3

---

## The problem

There is ~$14B of active tokenized private credit on-chain and ~$20B of tokenized real-world assets, and underneath all of it there is **no credit bureau, no lien registry, and no bankruptcy court**.

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

Repayments moved on-chain — stablecoin settlement means a repayment is now an **event**, not a report. And ASC readability shipped to Creditcoin mainnet in June 2026: a contract here can cryptographically verify an Ethereum event in one block for about **$0.000024**.

For the first time, the performance of a loan is something a contract can *check* rather than something a human tells you.

---

## The primitive

An **Obligation** — a promise to pay, on-chain:

```
obligor (commitment, never PII) · principal · schedule · seniority · collateral ref
status: Active → Current → Delinquent → Default → Settled
```

Status advances **only** when an ASC proof of the corresponding Ethereum event is verified by the `BlockProver` precompile, or when a deadline measured in **attested source-chain block height** expires. No party can assert a transition.

### The inversion

Every other ASC project proves that something *happened*. Covenant's `SilenceAdapter` handles the case where nothing did: an obligation **degrades unless proof of payment arrives**. No reporter, no committee, no oracle operator. Default is the default.

To be precise, because it matters: *you cannot prove a negative with an inclusion proof.* Covenant does **not** claim to prove that no payment occurred on Ethereum. It proves an on-chain fact about Creditcoin state —

> no admissible proof of payment for this window was presented before the attested head passed `windowEndHeight + minConfirmations`

— which is economically equivalent to non-payment, because submission is permissionless, costs ~$0.000024, and the borrower is the party most motivated to submit. And if it is ever wrong, **the proof still cures it**: a payment proof whose *source-chain height* falls inside the missed window restores `Current` even when submitted late.

Nobody has to volunteer bad news, and nobody can suppress it.

### The market on top

**Bonded underwriters** stake first-loss capital against a **named** borrower — not a pool, not a score. They earn a premium when the borrower pays and are **slashed by proof** when they don't. This puts the credit decision where the information actually is: the loan officer, the employer, the co-op, the merchant acquirer. A borrower's cost of credit becomes a live market price instead of a model's opinion.

---

## How ASCs are used

Full detail in [`docs/ASC-INTEGRATION.md`](docs/ASC-INTEGRATION.md).

1. **Real Ethereum mainnet evidence, from testnet.** CC3 testnet attests Ethereum mainnet at chainkey 3. Every proof is against a real mainnet transaction.
2. **Presence** — `PaymentAdapter` verifies inclusion of a qualifying ERC-20 `Transfer` and advances the obligation.
3. **Absence** — `SilenceAdapter` inverts the primitive to drive degradation, enabling permissionless default detection with no reporter.
4. **Deep history** — proofs against transactions over two years old, exercising the continuity-proof cost curve that makes a permanent registry economic.
5. **Batching** — up to 10 queries share one continuity proof.
6. **Liveness gate** — penalties require an unbroken observation record. A stalled oracle must never manufacture defaults.

### `AscVerify.sol` — published standalone, MIT

The `BlockProver` precompile **does not validate whether the proven transaction succeeded**. A reverted ERC-20 transfer is still a validly-included transaction.

`AscVerify.sol` is the single door to the outside world in this codebase, and it handles what every ASC integrator has to get right: asserts receipt `status == 0x1` before any log is touched, replay-guards every proof on `(chainKey, height, txIndex, logIndex)`, enforces confirmation depth against the attested head, gates penalties on observation continuity, and resolves chainkeys from `ChainInfo` rather than hardcoding them.

---

## Architecture

| Component | Role |
|---|---|
| `src/lib/AscVerify.sol` | The only door to the outside world. All ASC verification, guards, liveness. |
| `src/AscVerifier.sol` | The single shared instance — one replay map, one observation record. |
| `src/Register.sol` | Obligations, the status machine, registration bonds, disputes. |
| `src/adapters/PaymentAdapter.sol` | Proof present → advance. Also the cure path. |
| `src/adapters/SilenceAdapter.sol` | Proof absent → delinquency, cure, default. |
| `src/Bond.sol` | Named first-loss capital; pro-rata slashing; premium escrow. |
| `worker/` | Keeper: poke / prove / sweep, on independent timers. |
| `lens/` | Indexer + free public read API. A pure projection; holds no privileged state. |
| `app/` | Covenant Console — the protocol explorer. |

End to end: [`docs/USE-CASES.md`](docs/USE-CASES.md) · Design spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Threat model: [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md)

---

## Quickstart

```bash
git clone https://github.com/successaje/covenant && cd covenant
npm install
npm test            # 66 contract tests + 7 lens projection tests
npm run demo        # seeded Lens + Console on :5173 — no chain required
```

`npm run demo` serves a fixture projection covering every state in the
lifecycle, including a defaulted obligation with a slashed bond and an unbonded
claim registered in bad faith. It is the fastest way to see what this is.

Against a real deployment:

```bash
cp .env.example .env   # endpoints are pre-filled; add your RPC and keys
npm run prove:one      # verify ONE real mainnet tx — the evidence-layer gate
npm run lens           # indexer + read API on :8787
npm run keeper         # poke / prove / sweep   (DRY_RUN=1 to observe only)
npm run app            # Covenant Console on :5173
```

Regenerate the mainnet fixtures:

```bash
ETH_MAINNET_RPC=https://... npm run fixtures
```

---

## Trust assumptions

Stated plainly, because a reviewer should not have to discover them.

Covenant inherits the trust model of the ASC attestor set. As of 2026 that set is **permissioned** (`AuthorizedOnly` election mode), with a mainnet minimum bond of **0 CTC** and no publicly documented slashing regime. Covenant is therefore, today, a system with a curated federation at its evidence root — materially stronger than a multisig bridge, materially weaker than a ZK light client.

We treat this as the protocol's most important external dependency and design around it: per-obligation exposure caps, and an `AscVerify` abstraction that allows a second evidence backend (ZK storage proofs, an alternate messaging layer) to be swapped in without touching `Register`.

**Privileged functions.** The adapter allowlist, behind a 48-hour timelock, is the *only* privileged surface. No privileged role can transition an obligation's status directly, and no privileged role can prevent a borrower from curing. Both are asserted as invariants in the test suite.

## Known limitations

Deliberately not buried:

- **Privacy is v1.** Identity is a commitment (≥128-bit salt, client-side, never reused), but `sourcePayer`, `sourcePayee` and all amounts are **public by construction**. The roadmap answer is a source-chain payment router giving each obligation an ephemeral payer address, plus ZK selective disclosure. Do not put real people's data in this registry today.
- **One source chain.** Ethereum mainnet only, because that is what ASC attests today.
- **Registry spam is priced, not adjudicated.** Anyone can register an obligation against any address; registrar bonds and Lens weighting make it expensive, and `dispute()` quarantines contested claims, but v1 does not adjudicate bad-faith registration.
- **Wash underwriting is priced, not prevented.** Fabricating a history costs its face value in real on-chain transfers — unlike a self-reported score — but Covenant does not solve identity. It makes identity someone's *priced* problem.
- **False-default residual.** A borrower who paid but whose proof nobody submits within window + cure is wrongly defaulted. Mitigated by permissionless submission, near-zero cost, a 7-day cure, borrower self-service in the Console, and keeper incentives. This residual is the honest price of having no trusted reporter.
- **On-chain registration is not legal lien perfection** in any jurisdiction.
- **Testnet, synthetic data.** No real borrower information appears anywhere in this repository.

## Roadmap

| | |
|---|---|
| 0–3 mo | Mainnet v0; import historical loan records as commitment-form obligations → coverage on day one |
| 3–6 mo | Free encumbrance API; 3 venues querying; `AscVerify` adopted as an ecosystem standard |
| 6–12 mo | Underwriting bonds with real capital; first proven mainnet default |
| 12–24 mo | ERC standard for Obligations; Registrar Council; attested Register mirrors on Ethereum/Base |

## Licence

MIT.
