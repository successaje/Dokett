# Covenant

**The obligation layer for the open economy.**

A registry where a promise to pay is a first-class on-chain object, and its state advances only on cryptographically verified evidence — never on anyone's word.

Built on **Attestcoin Smart Contracts (ASCs)** · Creditcoin CC3

> Creditcoin knows how to record credit. Attestcoin lets it see across chains.
> **Covenant turns what it can see into a shared, verifiable record of obligations.**

---

## Start with a question every lender asks

A business wants to borrow $1,000,000. Before approving it, the lender asks the oldest question in finance:

> **"What do you already owe?"**

In traditional finance an entire apparatus exists to answer that — credit bureaus, lien registries, filing systems, auditors, courts. The answer is imperfect, but it exists.

Now move that borrower on-chain. They might hold:

- a loan on Ethereum
- collateral locked on a second chain
- a tokenized RWA position on a third
- a credit facility with a protocol that has never spoken to any of the others
- repayments settling in stablecoins across all of them

Every one of those systems can see its own slice of reality perfectly. **None of them can see the others.** The next lender asks the oldest question in finance and there is nowhere to send it.

That is the problem. Not fraud nobody could punish — leverage nobody could *see*.

## Why this gets worse, not better

The instinct is to treat this as an early-market gap that scale will close. It's the opposite: **every new chain, every new venue, and every newly tokenized asset adds another silo of obligations that no other participant can observe.** Fragmentation compounds with adoption.

As real-world assets move on-chain — and the direction of travel there is not in question — the ecosystem inherits questions that tokenization alone does not answer:

- Who has a claim on this asset?
- What obligations are still outstanding against it?
- Has the borrower actually paid, or did someone just say so?
- What happens, mechanically, when they don't?

Issuing an asset on-chain is solved. **Knowing what is owed against it is not.**

## Why the previous attempts didn't fix it

| | Why it died |
|---|---|
| On-chain credit scores | A number with no recourse and no sybil cost. Nobody lends against an opinion. |
| Aave credit delegation | The delegator got no upside and no enforcement. |
| Goldfinch | **Not an underwriting failure — an observability failure.** Borrowers reported performance in PDFs. |
| Maple v1 | Pool delegates with no cross-venue visibility → correlated blowups. |

Every one of these was attacked with a better *model*. None was attacked with better *evidence*.

That distinction is the whole thesis. A score is an opinion about a borrower. A self-report is a claim by a borrower. Neither is a fact, and you cannot build settlement infrastructure on either one.

## What changed

Two things, and both are recent enough that this was not buildable before.

**Repayment became an event.** When loans settle in stablecoins, a repayment stops being something a borrower *reports* at the end of a quarter and becomes something that provably *happened* at a specific block height. Goldfinch's fatal flaw — performance arriving as a PDF — is not a flaw anyone has to accept anymore.

**And a contract gained the ability to check it.** ASC readability means a Creditcoin contract can verify that Ethereum event itself, in one block, for a fraction of a cent, with no trusted intermediary anywhere in the path.

For the first time, the performance of a loan is something a contract can **check** rather than something a human tells you. Covenant is what you build once that's true.

## Why Creditcoin, specifically

This project is not on Creditcoin because a hackathon required it. Three things had to be true at once for an obligation layer to be buildable, and they are true here and nowhere else:

**1. A chain that already treats credit as its subject.** Creditcoin has spent years building on-chain credit infrastructure rather than retrofitting lending onto a general-purpose chain. A registry belongs on a chain that wants to be the *record*, not a venue that competes with the parties recording on it. Neutrality is a product requirement here, not a preference.

**2. Attestcoin — the missing evidence primitive.** ASC readability means a Creditcoin contract can cryptographically verify that a specific Ethereum event occurred, with no bridge, no messaging layer, and no oracle operator. Creditcoin's own framing of this is a repayment on Ethereum triggering logic on Creditcoin. That is precisely the primitive an obligation layer needs, and it did not exist before.

**3. Verification cheap enough to do continuously, over deep history.** A registry's entire job is answering questions about *old* obligations. We measured this rather than assuming it: proving a two-year-old Ethereum fact costs **26% more** than a twenty-minute-old one — not 26% per year, 26% total across 51,529× the age. History is nearly flat-cost to verify here. That is what makes a *permanent* registry economically possible instead of theoretically nice.

Take any one of the three away and this doesn't work.

## What Covenant is

Not another lending protocol. Not another credit score. Not another oracle.

**A shared record of obligations** — where a promise to pay is a first-class on-chain object, and the record changes only when there is admissible evidence that it should.

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

## This is infrastructure, not an application

The Console is how a *human* reads the register. It is not the product. The product is the record itself, and the fact that anything can query it.

No lending protocol should have to build its own cross-chain payment verification, obligation state machine, default detection, encumbrance registry, and evidence history. Those are not competitive advantages — they are plumbing that every credit venue rebuilds badly and in isolation. The same way no website implements its own DNS.

**It should be able to ask.**

```
A lender, before underwriting              An RWA platform, before accepting collateral
─────────────────────────────              ────────────────────────────────────────────
  new loan request                            tokenized asset presented
        │                                              │
        ▼                                              ▼
  GET /profile/:subject   ── what is proven?      GET /encumbrance/:asset
  GET /solvency/:entity   ── what's outstanding?         │
        │                                              ▼
        ▼                                     already pledged? → price it, or decline
  underwriting decision
```

```
Any protocol, on a repayment
────────────────────────────
  payment settles on Ethereum
        │
        ▼
  Attestcoin proves the event to Creditcoin
        │
        ▼
  Covenant verifies it and advances the obligation → CURRENT
```

Every endpoint above is **live, free, unauthenticated, and already serving the Console** — see [Developers](https://covenant-console.vercel.app/#/developers). There is no private API and no privileged tier: the Lens is a pure projection over chain events, so anyone can recompute every figure it reports from the chain itself. That property is deliberate. A registry that asks you to trust its own reporting has already failed at the one job it exists to do.

The eventual users are not people browsing a site. They are lenders, RWA issuers, fintechs, asset managers, underwriters, and other credit protocols — each asking a question they currently have no way to ask.

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

## Research

Findings from operating the protocol against live chains, not marketing copy —
every number below links to a real transaction.

- [**#001 — What does it actually cost to verify a foreign chain?**](docs/research/001-attestcoin-cost-model.md) Five real Ethereum transactions, 20 minutes to 2 years old, measured rather than quoted. Where our number disagreed with the published cost model, and why.
- [**#002 — We watched an obligation default. Nobody reported it.**](docs/research/002-autonomous-default.md) A live trace of an unattended keeper degrading an obligation to default in 2.3 minutes, with linked transactions for every step.

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

Each phase is a capability that the next one depends on, not a feature list.

| | | |
|---|---|---|
| **1 · Evidence** | *Can we prove what happened?* | Ethereum → Creditcoin via Attestcoin. **Done** — measured, [documented](docs/research/001-attestcoin-cost-model.md), reproducible against real mainnet transactions. |
| **2 · Obligations** | *Can we represent a promise to pay?* | The status machine, the inversion, the liveness gate. **Done** — a live autonomous default with [linked transactions](docs/research/002-autonomous-default.md). |
| **3 · Visibility** | *Can anything query those obligations?* | Registry, Solvency, Encumbrance, and the free read API. **Live today**; next is the first external caller — one real venue querying before it lends. |
| **4 · Capital** | *Can markets price and finance them?* | Bonded underwriting with real first-loss capital, and a first proven mainnet default with a real slash. |
| **5 · Shared layer** | *Can any credit protocol build on this state?* | An ERC standard for Obligations, a Registrar Council, attested Register mirrors on other chains, and a second evidence backend behind the same `AscVerify` interface. |

The near-term measure of success is not TVL. It is **one protocol we do not control making a query to this registry before extending credit** — because that is the moment it stops being an application and starts being infrastructure.

## Licence

MIT.
