# Dokett

**The obligation layer for the open economy.**

A registry where a promise to pay is a first-class on-chain object, and its state advances only on cryptographically verified evidence — never on anyone's word.

Built on **Attestcoin Smart Contracts (ASCs)** · Creditcoin CC3

[Console](https://dokett-console.vercel.app) · [X](https://x.com/dokettlabs)

> Creditcoin knows how to record credit. Attestcoin lets it see across chains.
> **Dokett turns what it can see into a shared, verifiable record of obligations.**

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

For the first time, the performance of a loan is something a contract can **check** rather than something a human tells you. Dokett is what you build once that's true.

## What inspired this

Not a chain, and not a hackathon theme. A wall I hit building something else.

Before Dokett I built [**OmniFuse**](https://omnifuse.vercel.app)
([source](https://github.com/successaje/OmniFuse)), a
cross-chain lending protocol on ZetaChain, written while contributing
upstream to it — supply collateral on one chain, borrow against it on another
through universal apps, with automated liquidation when a position goes
underwater. The cross-chain half worked. The *lending* half had a hole in it I
could not close from inside the protocol.

You can move collateral across chains. You can liquidate a position you can
see. What you cannot do is find out what that same borrower already owes on a
chain your protocol has never spoken to. So a cross-chain lender underwrites
against a partial picture and calls it a complete one — not through
carelessness, but because there is nowhere to send the question. I could add
another chain to OmniFuse and the blind spot would move; I could not remove
it. It was not a missing feature. It was a missing layer.

That gap turned out not to be mine alone. It is what the previous generation
died of.

Goldfinch had real underwriters and real borrowers. Maple had real capital.
Aave shipped credit delegation years ago. None of them failed because the
model was wrong — they failed because **nobody could see anything**. Goldfinch
borrowers reported performance in PDFs. Maple's pool delegates could not
observe exposure at other venues. Every post-mortem was attacked with a better
model; not one was attacked with better evidence.

That reframing is the whole thesis. The industry kept asking *"how do we
underwrite better?"* when the unanswered question — the one I had just spent
months failing to answer inside a lender — was *"how does a contract find out
what actually happened?"*

Two things then made an answer possible, and both are recent enough that this
was not buildable before:

**Repayment became an event.** When loans settle in stablecoins, "did they
pay?" stops being something a borrower tells you at the end of a quarter and
becomes a fact at a specific block height. Goldfinch's fatal flaw is not one
anyone has to accept anymore.

**A contract gained the ability to check it.** Attestcoin means a Creditcoin
contract can verify that Ethereum event itself, in one transaction, with no
bridge and no oracle operator in the path.

The last turn — the one that made this a registry instead of a proof demo, and
the reason Dokett is not simply OmniFuse with more chains bolted on — was
realising the primitive runs **backwards**. Everyone uses inclusion proofs
to show something happened. But the hardest question in credit is not *"did
they pay?"* It is *"did they not pay?"* — and in every existing system,
somebody has to volunteer that bad news. `SilenceAdapter` came from asking
what happens if nobody ever has to.

## Why Creditcoin, specifically

This project is not on Creditcoin because a hackathon required it. Three things had to be true at once for an obligation layer to be buildable, and they are true here and nowhere else:

**1. A chain that already treats credit as its subject.** Creditcoin has spent years building on-chain credit infrastructure rather than retrofitting lending onto a general-purpose chain. A registry belongs on a chain that wants to be the *record*, not a venue that competes with the parties recording on it. Neutrality is a product requirement here, not a preference.

**2. Attestcoin — the missing evidence primitive.** ASC readability means a Creditcoin contract can cryptographically verify that a specific Ethereum event occurred, with no bridge, no messaging layer, and no oracle operator. Creditcoin's own framing of this is a repayment on Ethereum triggering logic on Creditcoin. That is precisely the primitive an obligation layer needs, and it did not exist before.

**3. Verification cheap enough to do continuously, over deep history.** A registry's entire job is answering questions about *old* obligations. We measured this rather than assuming it: proving a two-year-old Ethereum fact costs **26% more** than a twenty-minute-old one — not 26% per year, 26% total across 51,529× the age. History is nearly flat-cost to verify here. That is what makes a *permanent* registry economically possible instead of theoretically nice.

Take any one of the three away and this doesn't work.

## Why Attestcoin, and not the alternatives

"Verify a foreign chain's event" has existing answers. Each one breaks a
property this specific product cannot give up.

| Approach | Why it fails here |
|---|---|
| **Oracle network** (Chainlink et al.) | A committee reports that a payment happened. That is a *claim*, and a registry whose statuses move on claims is a credit bureau with extra steps — exactly the thing the previous generation failed as. |
| **Bridge / messaging layer** | Inherits the bridge's trust model and its failure modes. A cross-chain credit record secured by a multisig is secured by a multisig. |
| **Self-reporting + attestation** | Goldfinch, restated. Someone has to volunteer bad news, and defaulting borrowers do not. |
| **Light client in a contract** | Correct trust model, wrong economics. Verifying deep Ethereum history in EVM gas, continuously, for a permanent registry, does not price out. |
| **Attestcoin** | A Creditcoin contract verifies a specific Ethereum event directly. No reporter, no committee, no bridge. And — measured, not assumed — proving a **two-year-old** fact costs 26% more than a twenty-minute-old one, which is what makes a *permanent* record economically possible rather than theoretically nice. |

The absence case is the one that settles it. Every alternative above can, in
principle, tell you a payment occurred. None of them lets a contract act on a
payment that **never** occurred, without a human deciding to say so.

## What Dokett is

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

Most cross-chain verification proves that something *happened*. Dokett's `SilenceAdapter` acts on the case where nothing did: an obligation **degrades unless proof of payment arrives**. No reporter, no committee, no oracle operator. Default is the default.

What we do *with* the absence is the part worth arguing about. Freezing undrawn capital is one answer; ours is that the obligation itself degrades to delinquent and then default, and named first-loss capital is slashed to the creditor in the same transaction. The cure window is the safety margin: while it is open, a late proof reverses the delinquency. Once it expires, the default and the slash are **final** — an underwriter who could be un-slashed by a proof arriving at any future date could never price the risk.

To be precise, because it matters: *you cannot prove a negative with an inclusion proof.* Dokett does **not** claim to prove that no payment occurred on Ethereum. It proves an on-chain fact about Creditcoin state —

> no admissible proof of payment for this window was presented before the attested head passed `windowEndHeight + minConfirmations`

— which is economically equivalent to non-payment, because submission is permissionless, costs ~$0.000024, and the borrower is the party most motivated to submit. And if it is ever wrong, **the proof still cures it, while the cure window is open**: a payment proof whose *source-chain height* falls inside the missed window restores `Current` even when the proof itself is submitted afterwards. What matters is when the payment happened, not when someone got around to proving it.

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
  Dokett verifies it and advances the obligation → CURRENT
```

Every endpoint above is **live, free, unauthenticated, and already serving the Console** — see [Developers](https://dokett-console.vercel.app/#/developers). There is no private API and no privileged tier: the Lens is a pure projection over chain events, so anyone can recompute every figure it reports from the chain itself. That property is deliberate. A registry that asks you to trust its own reporting has already failed at the one job it exists to do.

The eventual users are not people browsing a site. They are lenders, RWA issuers, fintechs, asset managers, underwriters, and other credit protocols — each asking a question they currently have no way to ask.

---

## How this makes money

The short version: **the lookup is free forever, because coverage is worth more
than rent.** A registry is worth exactly what is registered in it, and coverage
comes from venues integrating the read path. Charging at the door would trade
the network effect for rounding-error revenue — that is why
[`lens/src/api.js`](lens/src/api.js) is unauthenticated and CORS-open, and it is
a go-to-market position expressed in code rather than a feature we have not
finished.

### What already moves value on-chain

These are live in the contracts today, not planned. None of them is *Dokett's*
revenue — they are the protocol's own incentives, and the distinction matters:

| Flow | Who pays | Who earns | Where |
|---|---|---|---|
| **Registrar bond** — 1 CTC, staked against a claim being real | Registrar | Slashed or returned; gives a claim weight in the Lens | `Register.MIN_REGISTRAR_BOND` |
| **Keeper fund** — 0.5 CTC per obligation | Registrar | Keepers, as `BountyPaid`, for poking the lifecycle | `Register.MIN_KEEPER_FUND` |
| **Underwriting premium** — the spread on named first-loss capital | Creditor | Underwriter, **iff the obligation settles**; refunded if the bond is slashed | `Bond.fundPremium` |
| **Slashing** — first-loss capital moved by proof | Underwriter | Creditor, in the same transaction as the default | `Bond.slash` |

The protocol is therefore already self-funding in the narrow sense: keepers are
paid to run it, and underwriters are paid to take risk on it. Nobody has to
subsidise the lifecycle for it to keep turning.

### Where a business sits on top — *proposed, not built*

Per-obligation lookups stay free. The commercial product is the **aggregate**
one, which is exactly what a free per-row API cannot give you:

- **Concentration and correlation** — how much of a lender's book depends on the
  same obligor, the same collateral, or the same underwriter.
- **Portfolio exposure** — the view across many obligations at once, for a
  venue that holds hundreds.
- **Encumbrance monitoring** — a standing subscription to *this asset just
  acquired a second claim*, rather than a lookup you have to remember to run.

The reasoning: the query that makes registering worthwhile must be free, or
coverage never happens and there is nothing to sell. The query an institution
runs against its whole book is worth paying for, and only exists once coverage
does.

**None of this is built, and no one has been charged anything.** Saying so
plainly is the point — this is the reasoning behind a decision already made in
code, not a forecast.

### No token

Dokett has no token and is not planning one. Bonds, keeper funds and premiums
are denominated in **CTC** and the collateral asset. A token would add a
governance surface and a price to defend, on a project whose entire argument is
that state should move on proof rather than on anyone's discretion — including
ours.

## The assets are real

A registry that only records claims against invented assets is a mechanism
demo. So the register carries obligations denominated in **real tokenized
real-world assets**, each advanced `Active → Current` by proving a real
Ethereum mainnet transfer through Attestcoin at chainKey 3. Nobody reported
any of them.

| # | Asset | Class | Proven from mainnet |
|---|---|---|---|
| [14](https://dokett-console.vercel.app/#/obligation/14) | **PAXG** — Paxos Gold | precious metals | 8.0 troy oz of vaulted gold, height 25,948,972 |
| [15](https://dokett-console.vercel.app/#/obligation/15) | **BUIDL** — BlackRock USD Institutional Digital Liquidity Fund | institutional money market | 241.18 shares, height 25,947,634 |
| [16](https://dokett-console.vercel.app/#/obligation/16) | **USDY** — Ondo U.S. Dollar Yield | treasury yield | 2,246.99 tokens, height 25,948,799 |

None of these tokens are ours. PAXG is a troy ounce of London Good Delivery
gold vaulted with Brink's; BUIDL is BlackRock's tokenized fund holding cash,
Treasury bills and repo; USDY is backed by short-term Treasuries and bank
deposits. They trade on Ethereum mainnet, and mainnet is what CC3 attests — so
`PaymentAdapter` proved all three with **no protocol change at all**.

**The plural is the point.** One gold obligation demonstrates gold. Three
across metals, a money-market fund and a treasury-yield token demonstrate that
the registry does not care what the asset is — it never learns. It records what
is owed against a commitment, and the commitment could be anything. That is
what makes it a registry rather than a product for one asset class.

**Tokenized RWA is the stronger demonstration, not the weaker one.** Gold-backed
lending normally needs someone to appraise the metal and take custody of it, and
that someone must be trusted. Tokenized gold is already appraised, custodied and
audited — so proving a gold-backed repayment needs no appraiser in the loop.
The intermediary is removed rather than digitised.

Dokett does not tokenize the asset. **It records what is owed against one** —
and each collateral reference commits to a real position without disclosing
whose it is, the same posture the obligor commitment uses.

> **A note on cost, since it is measurable here.** The three proofs cost 612,766,
> 629,790 and 872,186 gas. The outlier is USDY, whose payment sat at **log index
> 20 of a 24-log receipt** — a DEX settlement. Receipt size drives verification
> cost, not asset value: proving one transfer inside a busy settlement costs
> about 40% more than proving one that arrives alone. Reproduce with
> `npm run seed:rwa <ASSET>` then `npm run prove:payment <id> <txHash>`.

## How ASCs are used

We did not only build on the Attestcoin Protocol. We found a way to misuse it that **silently accepts a failed payment as a successful one**, fixed it, and published the fix under MIT for every other integrator.

Full detail in [`docs/ASC-INTEGRATION.md`](docs/ASC-INTEGRATION.md).

### The footgun — and [`AscVerify.sol`](src/lib/AscVerify.sol), the guard layer

`BlockProver` proves a transaction was **included** in a block. It does not check whether that transaction **succeeded** — and a reverted ERC-20 transfer is still validly included, carrying real-looking `Transfer` logs.

So an integrator who proves inclusion and then reads the logs will accept a payment that never moved a cent, and *the proof will verify correctly while they do it*. There is no error to notice. Our own test says it plainly:

```solidity
assertTrue(prover.accept(), "precompile mock accepts the proof, as the real one would");

vm.expectRevert(abi.encodeWithSelector(AscVerify.TransactionReverted.selector, uint8(0)));
harness.verify(_proof(reverted, 0, bytes32(uint256(2))));
```

The precompile accepts it. `AscVerify` is what rejects it.

It is the single door to the outside world in this codebase, and it does four things every ASC integrator has to get right:

| | |
|---|---|
| **Receipt status** | asserts `status == 0x1` before any log is touched |
| **Replay** | guards every proof on `(chainKey, height, txIndex, logIndex)`, so one real payment cannot satisfy two obligations |
| **Confirmation depth** | enforced against the **attested** head, not an assumed one |
| **Chainkeys** | resolved from `ChainInfo` at runtime — Ethereum mainnet is chainkey 3 on CC3 testnet and 1 on mainnet, and hardcoding that is a bug waiting for a deployment |

None of those are credit-specific. They are what anyone reading another chain's events has to get right, and getting them wrong fails quietly rather than loudly — which is why it is [published standalone under MIT](src/lib/AscVerify.sol) rather than left inside this repo.

### What we exercise on top of it

1. **Real Ethereum mainnet evidence, from testnet.** CC3 testnet attests Ethereum mainnet at chainkey 3. Every proof is against a real mainnet transaction.
2. **Presence** — `PaymentAdapter` verifies inclusion of a qualifying ERC-20 `Transfer` and advances the obligation.
3. **Absence** — `SilenceAdapter` inverts the primitive to drive degradation, enabling permissionless default detection with no reporter.
4. **Deep history** — proofs against transactions over two years old, exercising the continuity-proof cost curve that makes a permanent registry economic.
5. **Batching** — up to 10 queries share one continuity proof.
6. **Liveness gate** — penalties require an unbroken observation record. A stalled oracle must never manufacture defaults.

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
| `app/` | Dokett Console — the protocol explorer. |

End to end: [`docs/USE-CASES.md`](docs/USE-CASES.md) · Design spec: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · Threat model: [`docs/THREAT-MODEL.md`](docs/THREAT-MODEL.md)

## Deployed contracts — CC3 testnet

All source-verified on Blockscout (re-checked 2026-09-09 via its API; every row
returned `is_verified: true`). Chain id **102031**, deployed at block
**5,324,811**.

| Contract | Address | Role |
|---|---|---|
| `Register` | [`0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5`](https://creditcoin-testnet.blockscout.com/address/0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5) | Obligations, status machine, registrar bonds |
| `AscVerifier` | [`0x02406b6d17E743deA7fBbfAE8A15c82e4481E168`](https://creditcoin-testnet.blockscout.com/address/0x02406b6d17E743deA7fBbfAE8A15c82e4481E168) | The single shared evidence instance — one replay map, one observation record |
| `PaymentAdapter` | [`0xA68f1CBff869a7f6c7A9BC9313E0B9E135A79a60`](https://creditcoin-testnet.blockscout.com/address/0xA68f1CBff869a7f6c7A9BC9313E0B9E135A79a60) | Proof present → advance. Also the cure path |
| `SilenceAdapter` | [`0x8e827a12C78dED9459268eb05cce2C5d709FE6AF`](https://creditcoin-testnet.blockscout.com/address/0x8e827a12C78dED9459268eb05cce2C5d709FE6AF) | Proof absent → delinquent → default |
| `Bond` | [`0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e`](https://creditcoin-testnet.blockscout.com/address/0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e) | Named first-loss capital, pro-rata slashing |

**Attestcoin precompiles this build calls:** `BlockProver` at
`0x…0FD2` (single + batch verification, batch limit 10) and `ChainInfo` at
`0x…0fD3` (chainkey resolution at runtime — chainkeys are *not* portable; on
CC3 testnet Ethereum mainnet is chainKey 3, on mainnet it is 1).

### Live services

| | |
|---|---|
| Console | [dokett-console.vercel.app](https://dokett-console.vercel.app) |
| Read API | [dokett-lens.fly.dev](https://dokett-lens.fly.dev) — free, unauthenticated, CORS-open |
| DemoBank | [demobank-credit.vercel.app](https://demobank-credit.vercel.app) — a third party reading the register |
| Cure relay | `dokett-relay.fly.dev` — pays a borrower's gas so curing needs no CTC |
| Demo video | [youtu.be/JbFceGWRdt8](https://youtu.be/JbFceGWRdt8) |
| X | [@dokettlabs](https://x.com/dokettlabs) |

## Research

Findings from operating the protocol against live chains, not marketing copy —
every number below links to a real transaction.

- [**#001 — What does it actually cost to verify a foreign chain?**](docs/research/001-attestcoin-cost-model.md) Five real Ethereum transactions, 20 minutes to 2 years old, measured rather than quoted. Where our number disagreed with the published cost model, and why.
- [**#003 — We had never actually slashed anyone.**](docs/research/003-first-slash.md) The mechanism the whole market thesis rests on had never fired on-chain. Making it fire, and the loss rate that is now non-zero because of it.
- [**#002 — We watched an obligation default. Nobody reported it.**](docs/research/002-autonomous-default.md) A live trace of an unattended keeper degrading an obligation to default in 2.3 minutes, with linked transactions for every step.

---

## What we learned building this

Six things this project taught us that were not obvious going in. Each one is
a real incident with a commit behind it, not a lesson we knew already and
wrote up afterwards.

**The safety guards cost more than the proof.** We expected verification cost
to be dominated by the cryptography. It is not. Our measured cost is ~7.4× the
published formula — and when we decomposed the gap rather than shrugging at
it, the per-root coefficient actually *agreed* (440 gas measured vs 580
published). The entire difference is fixed base cost: decoder, receipt
decoding, the replay-guard `SSTORE`, the `ChainInfo` staticcall, the event
emit. Proving the fact is cheap. Refusing to trust it is what costs.

**History is nearly flat to verify, and that changes what you can build.**
Proving a two-year-old Ethereum fact costs 26% more than a twenty-minute-old
one — *total*, across 51,529× the age — because continuity proofs saturate at
232 roots past roughly a year instead of growing without bound. A registry has
to answer questions about old obligations forever. We did not know this was
affordable until we measured it.

**A constant can have a shelf life, and nothing in your tooling tracks it.**
Our indexer paged the chain in 50,000-block chunks. Correct the hour it was
written, when the contracts were an hour old. Eight days later that page was
wider than the node's 10-second query timeout, and the service could no longer
cold-start. It had been running fine for eleven days — because a warm cursor
never has to do the thing that was broken. **Long uptime is not evidence your
startup path works.** It is time for that path to rot untested.

**Chase the 1% anomaly.** One gas measurement came in 3,608 under the model
fitted to the others — about 1%. Chasing it revealed the transaction was
type-0 legacy, encoding 128 bytes smaller, and that our test suite had never
once exercised a pre-EIP-1559 transaction. A registry that mishandled legacy
transactions would have wrongly defaulted exactly the borrowers who send them.

**We were wrong in public, and fixing it cost nothing.** We claimed CC3 could
not execute `PUSH0`, inferred from a missing field in the block header. Then we
tested it directly: it executes fine. The claim was corrected in the docs as a
visible correction rather than a silent edit. Same with a uniqueness claim —
we wrote that we were the only ASC project acting on absence, discovered
another submission doing something similar, and retracted it. **In a project
whose entire thesis is that assertions should be checkable, getting caught
overclaiming would cost more than any claim is worth.**

**Verify the thing, not the report of the thing.** The Underwriters page was
empty for days. The obvious read was "no bonds posted yet." The actual cause:
the only allowlisted collateral token was Ethereum mainnet's USDC address,
reused as a placeholder — which has no code at all on CC3. `cast code` returned
`0x`. Nobody could ever have posted a bond. The door was configured to
something that was not a door.

## Quickstart

```bash
git clone https://github.com/successaje/Dokett && cd Dokett
npm install
npm test            # 67 contract + 7 projection + 16 relay tests
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
npm run app            # Dokett Console on :5173
```

Regenerate the mainnet fixtures:

```bash
ETH_MAINNET_RPC=https://... npm run fixtures
```

---

## Trust assumptions

Stated plainly, because a reviewer should not have to discover them.

Dokett inherits the trust model of the ASC attestor set. As of 2026 that set is **permissioned** (`AuthorizedOnly` election mode), with a mainnet minimum bond of **0 CTC** and no publicly documented slashing regime. Dokett is therefore, today, a system with a curated federation at its evidence root — materially stronger than a multisig bridge, materially weaker than a ZK light client.

We treat this as the protocol's most important external dependency and design around it: per-obligation exposure caps, and an `AscVerify` abstraction that allows a second evidence backend (ZK storage proofs, an alternate messaging layer) to be swapped in without touching `Register`.

**Privileged functions.** The adapter allowlist, behind a 48-hour timelock, is the *only* privileged surface. No privileged role can transition an obligation's status directly, and no privileged role can prevent a borrower from curing. Both are asserted as invariants in the test suite.

## Known limitations

Deliberately not buried:

- **Privacy is v1.** Identity is a commitment (≥128-bit salt, client-side, never reused), but `sourcePayer`, `sourcePayee` and all amounts are **public by construction**. The roadmap answer is a source-chain payment router giving each obligation an ephemeral payer address, plus ZK selective disclosure. Do not put real people's data in this registry today.
- **One source chain.** Ethereum mainnet only, because that is what ASC attests today.
- **Registry spam is priced, not adjudicated.** Anyone can register an obligation against any address; registrar bonds and Lens weighting make it expensive, and `dispute()` quarantines contested claims, but v1 does not adjudicate bad-faith registration.
- **Wash underwriting is priced, not prevented.** Fabricating a history costs its face value in real on-chain transfers — unlike a self-reported score — but Dokett does not solve identity. It makes identity someone's *priced* problem.
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
| **4 · Capital** | *Can markets price and finance them?* | Bonded underwriting with real first-loss capital, and a first proven mainnet default with a real slash. **First slash demonstrated on testnet** — [linked transactions](docs/research/003-first-slash.md). |
| **4b · Origination UI** | *Can a person create one without an ABI?* | **Done.** `#/register` turns the 16-field struct into seven inputs with a derived-terms panel, and the cure relay's faucet — the dependency that deferred this — is live, so a registrar bond no longer requires already holding CTC. |
| **5 · Shared layer** | *Can any credit protocol build on this state?* | An ERC standard for Obligations, a Registrar Council, attested Register mirrors on other chains, and a second evidence backend behind the same `AscVerify` interface. |

The near-term measure of success is not TVL. It is **one protocol we do not control making a query to this registry before extending credit** — because that is the moment it stops being an application and starts being infrastructure.

## Licence

MIT.
