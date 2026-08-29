# Dokett — Architecture Specification

**Version** 0.2 · supersedes 0.1 (pre-build design)
**Target** BUIDL CTC 2026 Fall — RWA track — CC3 Testnet
**Status** `AscVerify` implemented and tested; `Register` in progress

> **v0.2 changelog.** Written after reading the shipped ABIs in `@gluwa/usc-sdk@0.18.0`
> and `@gluwa/usc-contracts@0.1.2` rather than the prose docs. Four things in v0.1
> were wrong. See [§10 Corrections log](#10-corrections-log) — it is kept in the
> document deliberately, because a design doc that hides where it was wrong is
> worth less than one that shows its work.

---

## 0. One-paragraph summary

Dokett is a registry of **obligations**. Each obligation is an on-chain object on Creditcoin whose state advances only when an Attestcoin Smart Contract (ASC) proof of the corresponding Ethereum event is verified by the `BlockProver` precompile — never on a party's word. When no admissible proof of payment is presented before a window closes, the obligation degrades to delinquent and then to default, and a named third party's staked first-loss capital is slashed to the creditor atomically. Two lenders who have never met can see each other's claims on the same borrower before they lend.

---

## 1. Design invariants

| # | Invariant | Why |
|---|---|---|
| **I1** | **Consequence is local.** Dokett never moves or seizes value on a source chain. Source chains are evidence; Creditcoin is the ledger of record and the venue of consequence. | Not because writability is impossible — it exists (§10, C1) — but because the read path's trust model is strictly stronger, and a registry's job is to *record*, not to custody. |
| **I2** | **No privileged reporter.** No party can assert a state transition. Every advance is either an ASC-verified event, or a comparison against the **attested source-chain height**. | This is the thesis. A registry with a trusted reporter is a spreadsheet. |
| **I3** | **Degradation is the default.** Obligations do not stay healthy by inertia; they decay unless proof arrives. | Nobody volunteers bad news. |
| **I4** | **Every false negative is curable; no false positive is final.** A wrongly-marked delinquency is always reversible by presenting the proof that should have arrived. Only cure expiry makes default final. | Makes permissionless marking safe to hand to strangers. |
| **I5** | **No PII on chain, ever.** Identity appears only as a high-entropy commitment. | GDPR/FCRA survivability. |
| **I6** | **The clock is attested source-chain height, never wall time.** | Forced by reality: no timestamp is available anywhere in the proven data (§10, C2). It is also the better design — see §4.4. |
| **I7** | **Penalties require continuous observation.** No obligation may be penalised unless the attested head has been observed advancing, without a coverage gap, for `recoveryGrace`. | A stalled or unobserved oracle must never become a mass-liquidation event (§10, C3). |
| **I8** | **Registration is permissionless; weight is bonded.** Anyone may register an obligation. How much the Lens *believes* it depends on the registrar's bond and record. | Spam is priced, not gatekept. |

---

## 2. System diagram

```
 ETHEREUM MAINNET   chainkey 3 on CC3 testnet · chainkey 1 on CC3 mainnet (§5.1)
 ─────────────────────────────────────────────────────────────────────────────
   ERC-20 Transfer(borrower → creditor)  ·  pledge/lock events  ·  liquidations
                              │ observed by
                              ▼
                   ┌──────────────────────┐
                   │  ASC attestor set    │  BLS-aggregated consensus on
                   │  (permissioned v1)   │  Ethereum history, gossiped P2P
                   └──────────┬───────────┘
                              ▼ attestations committed to Creditcoin state
 CREDITCOIN CC3 ─────────────────────────────────────────────────────────────
                   ┌────────────────────────────────────────┐
   keeper ────────►│ ChainInfo   0x…0fD3  heights only       │
   (proof)         │ BlockProver 0x…0FD2  verify / batch ≤10 │
                   │ EvmV1Decoder (linked library)           │
                   └──────────┬─────────────────────────────-┘
                              ▼
   ┌───────────────────────────────────────────────────────────────────────┐
   │  AscVerify.sol   ── the only door to the outside world  [IMPLEMENTED] │
   │   · receiptStatus == 1 before any log is touched                      │
   │   · global replay key (chainKey, height, txIndex, logIndex)           │
   │   · confirmation depth vs. attested head                              │
   │   · observation-continuity liveness gate (I7)                         │
   │   · chainId assertion — chainkeys are not portable                    │
   └──────────────────────────┬────────────────────────────────────────────┘
                              │ verified facts
        ┌─────────────────────┼──────────────────────┐
        ▼                     ▼                      ▼
  PaymentAdapter        SilenceAdapter         EncumbranceAdapter*
  (proof present)       (proof absent)         (*stretch)
        └─────────────────────┼──────────────────────┘
                              ▼
                     ┌─────────────────┐  slash   ┌──────────────┐
                     │   Register.sol  │◄────────►│   Bond.sol   │
                     └────────┬────────┘          └──────────────┘
                              ▼ events
                     ┌─────────────────┐
                     │  Lens indexer   │  getSolvency() · getEncumbrance()
                     └─────────────────┘
```

---

## 3. Data model

### 3.1 The Obligation

Every schedule field is denominated in **source-chain block height** (I6).

```solidity
enum Status {
    None,        // 0 unregistered
    Active,      // 1 registered, first window open
    Current,     // 2 last due window satisfied by verified proof
    Delinquent,  // 3 a window closed with no admissible proof; cure open
    Default,     // 4 cure expired; triggers slashing
    Settled,     // 5 schedule fully satisfied
    ChargedOff   // 6 defaulted and written off
}

struct Obligation {
    // identity — commitments only (I5)
    bytes32 obligor;
    bytes32 creditor;
    address creditorPayout;   // Creditcoin address that receives slashed bond value

    // source-chain binding — public by construction, see §7
    uint64  chainKey;
    address sourceToken;
    address sourcePayer;
    address sourcePayee;

    // economics
    uint128 principal;
    uint128 outstanding;
    uint128 periodAmount;     // minimum qualifying payment per window
    uint16  aprBps;

    // schedule, in SOURCE-CHAIN BLOCK HEIGHT
    uint64  startHeight;
    uint64  periodBlocks;     // window length, e.g. 216_000 ≈ 30d at 12s
    uint64  windowEndHeight;  // current window closes at this source height
    uint64  cureBlocks;       // grace after windowEndHeight before default
    uint64  lastProvenHeight;
    uint8   periodsTotal;
    uint8   periodsSatisfied;

    // lifecycle
    Status  status;

    // registry weighting (I8)
    address registrar;
    uint128 registrarBond;
    uint8   seniority;
    bytes32 collateralRef;    // 0x0 if unsecured
}
```

**Why height and not time.** Three independent reasons, in increasing order of importance:

1. **It is the only option.** `CommonTxFields` is `{nonce, gasLimit, from, toIsNull, to, value, data}` and `ChainInfo` returns heights. No timestamp exists in anything the proof binds. A caller-supplied timestamp would be an unverified argument — exactly the "privileged reporter" I2 forbids.
2. **It is the honest unit.** The question a payment window asks is "did this happen before the deadline *on the chain where the money moved*." Source height answers that natively; Creditcoin's local clock only approximates it.
3. **It makes I7 structural.** If attestation stalls, the attested head stops advancing, so no window can expire and no obligation can be penalised. The protection falls out of the design rather than being bolted on.

Ethereum's ~12s block time makes height a stable proxy for duration. Where a human-readable term matters (a "30-day" loan), the UI converts; the contract only ever sees blocks.

### 3.2 Status machine

`head` = `attestedHead(chainKey)`. `conf` = `minConfirmations`.

| From | To | Trigger | Caller |
|---|---|---|---|
| `None` | `Active` | `register()` with registrar bond | anyone |
| `Active`/`Current` | `Current` | ASC-verified qualifying transfer at `height ≤ windowEndHeight` | anyone |
| `Active`/`Current` | `Delinquent` | `head ≥ windowEndHeight + conf` **and** no proof consumed for the window **and** `penaltiesEnabled(chainKey)` | anyone (bounty) |
| `Delinquent` | `Current` | proof at `height ≤ windowEndHeight`, submitted before cure expiry | anyone |
| `Delinquent` | `Default` | `head ≥ windowEndHeight + cureBlocks` **and** `penaltiesEnabled(chainKey)` | anyone (bounty) |
| `Default` | `Current` | **not permitted** — workout is a new obligation referencing the old | — |
| `Default` | `ChargedOff` | after workout window, or on bond exhaustion | anyone |
| `Current` | `Settled` | `periodsSatisfied == periodsTotal && outstanding == 0` | automatic |

The cure case needs no special code path: a proof is admissible whenever its **proven height** falls inside the missed window, regardless of when it is submitted. That is I4 in one comparison.

---

## 4. Contracts

### 4.1 `lib/AscVerify.sol` — implemented

The only door to the outside world; published standalone MIT. Responsibilities, in execution order:

1. **`pokeHead(chainKey)`** — record `(height, observedAt)` and maintain `healthySince`. Permissionless; every state-changing proof path calls it.
2. **Confirmation depth** — reject proofs at `height > head - minConfirmations` (default 64) to stay clear of reorgs.
3. **Replay reservation** — `keccak256(chainKey, height, txIndex, logIndex)`, reserved *before* the external precompile call so a reentrant caller cannot double-consume; a failed verification reverts and rolls it back. The key is **global, not per-obligation** — one payment must not be able to satisfy two obligations.
4. **Verify** — `verifyAndEmit`, single or batch (≤10 sharing one continuity proof).
5. **`receiptStatus == 1`** — asserted *before any log is touched*. See §10, C4 for what this does and does not protect against.
6. **Log extraction and matching** — `_requireErc20Transfer` enforces emitter, topic0, both parties and a minimum value. The emitter check is not optional: without it anyone can deploy a contract that emits a well-formed `Transfer` with arbitrary arguments and prove it.

Configuration surface: `minConfirmations`, `maxSampleGap`, `recoveryGrace` (all immutable).

### 4.2 `Register.sol`

- `register(ObligationInit)` — payable, requires `MIN_REGISTRAR_BOND` in CTC, escrows a `keeperFund` for §4.4 bounties, asserts the source chain's id matches its chainKey.
- `provePayment(id, Proof)` → `PaymentAdapter`.
- `markDelinquent(id)` / `finalizeDefault(id)` → `SilenceAdapter`.
- `dispute(id, reasonCode)` — obligor-side flag; does not change status, surfaces in the Lens. The beginning of the consumer-rights layer.
- Adapter allowlist behind a 48h timelock — the only privileged surface.

### 4.3 `adapters/PaymentAdapter.sol`

```
provePayment(id, proof):
    require(status ∈ {Active, Current, Delinquent})
    log   = AscVerify._verify(proof)
    value = AscVerify._requireErc20Transfer(log, sourceToken, sourcePayer, sourcePayee, periodAmount)

    windowStart = windowEndHeight - periodBlocks
    require(proof.height > windowStart && proof.height <= windowEndHeight)

    covered           = min(value / periodAmount, periodsTotal - periodsSatisfied)
    outstanding      -= min(value, outstanding)
    periodsSatisfied += covered
    lastProvenHeight  = proof.height
    windowEndHeight  += covered * periodBlocks
    status            = done ? Settled : Current
```

### 4.4 `adapters/SilenceAdapter.sol` — the crux

**What it does not claim.** You cannot prove a negative with an inclusion proof. There is no ASC primitive for "no transaction matching predicate P exists in blocks N…M," and Dokett does not claim one.

**What it proves.** An on-chain fact about Creditcoin state:

> No admissible proof of payment for window W was presented before the attested head passed `windowEndHeight + conf`.

**Why that is economically equivalent to non-payment.** Submission is permissionless — borrower, creditor, keeper, or any bot. It costs ~$0.000024, three orders of magnitude below any payment it would evidence. The borrower is the party most motivated to submit. And if the inference is ever wrong, the cure path reverses it (I4).

```
markDelinquent(id):
    require(penaltiesEnabled(chainKey))                        // I7
    require(attestedHead(chainKey) >= windowEndHeight + conf)
    require(lastProvenHeight <= windowEndHeight - periodBlocks)
    status = Delinquent
    pay(msg.sender, keeperBounty)

finalizeDefault(id):
    require(penaltiesEnabled(chainKey))                        // I7
    require(status == Delinquent)
    require(attestedHead(chainKey) >= windowEndHeight + cureBlocks)
    status = Default
    bond.slash(id, outstanding, creditorPayout)
    pay(msg.sender, finalizerBounty)
```

**Liveness, and why height alone is not enough.** A stall freezes the head, so windows cannot expire — protection for free. But recovery is the dangerous half: when a stalled head catches up, it jumps, and every pending window becomes expired *simultaneously*, with nobody having had a chance to submit. Height cannot distinguish that from normal progress, and neither can two sparse samples.

So the rule is about **observation, not measurement**: penalties require the head to have been observed advancing with no coverage gap for `recoveryGrace`. Any gap — a real stall, or simply nobody watching — resets the timer. An adversary who withholds observation can only *delay* penalties, never accelerate them, which is the correct direction to fail.

### 4.5 `Bond.sol` — implemented

Named first-loss capital, staked against **one obligation** rather than a pool. Pooling is what let correlated risk hide inside a single APY and is why the delegate model died; aggregation belongs in the Lens, as a view, where the concentration is visible.

- `post(id, collateral, amount, spreadBps)` — permissionless. Anyone may underwrite anyone: the credit decision belongs to whoever holds the information, not whoever holds the deposits.
- `fundPremium(bondId, amount)` — normally the creditor, buying protection. Escrowed separately from the bond so the underwriter never has to trust the creditor to pay later, and **refunded to the funder if the bond is slashed** — they received the payout, they should not also keep the fee. This closes the economic loop entirely on Creditcoin, with no dependency on source-chain interest.
- `slash(id, amount, payee)` — **two independent authorisations**: the caller must be a Register-allowlisted adapter, *and* the Register must itself report `Default`. The second is not redundant; it means a compromised or buggy adapter cannot invent a default and drain first-loss capital. The contract that moves money re-derives the fact rather than trusting the caller who asserts it.
- `release(bondId)` on `Settled` — permissionless to call but always pays the underwriter, so nobody can strand an underwriter's capital by declining to act.

Slashing is **pro-rata across live bonds**, computed in two passes (size the pool, then take proportionally) so list order never decides who absorbs the loss.

`MAX_BONDS_PER_OBLIGATION = 16` is a liveness guard, not a policy preference: `slash` walks the list, and uncapped, an attacker could post dust bonds until slashing exceeds the block gas limit — making a defaulted obligation permanently unslashable, the exact outcome the protocol exists to prevent.

Underwriter statistics are derived in the Lens, never stored — reputation is a view over history, not a mutable number.

Bonds are stablecoin-denominated by allowlist. A credit system collateralised in its own volatile token is a reflexive death spiral: the collateral falls precisely when defaults rise. Collateral allowlisting is timelock-only but immediate, unlike the 48h adapter delay — each position stores the collateral it was posted with, so allowlisting a hostile token cannot touch an existing bond, and only an underwriter who then voluntarily posts in it is exposed.

### 4.6 Keeper — implemented

Three jobs on **independent timers**, and the independence is the design:

1. **poke** — keep the attested-head observation record continuous
2. **prove** — find qualifying repayments, wait for confirmations + attestation, submit
3. **sweep** — mark delinquencies, finalize defaults

(1) never waits on (2) or (3). That is a correctness requirement, not tidiness: `AscVerify` refuses penalties unless the head has been observed advancing without a coverage gap, so a keeper that only poked when it had other work would manufacture gaps and disable the protocol's own enforcement. **`pokeIntervalMs` is therefore a correctness parameter** — poke slower than `maxSampleGap` and the keeper's laziness reads as an oracle outage. Default 120s against a 15-minute gap.

The scanner never looks shallower than `minConfirmations`, since a proof inside the confirmation window is rejected on-chain anyway — fetching it early only burns a proof-builder request and risks acting on a reorged log. `logIndex` is resolved against the transaction's **own** receipt logs, not the block-wide index ethers reports.

Proof builders are a **list**, tried in order. A builder can censor but never forge — every proof is verified on-chain — so withholding is the entire attack surface, and it matters because a withheld proof is indistinguishable from a missed payment right up until the cure window closes. All-builders-failed is raised loudly rather than swallowed, because it is operationally identical to the evidence layer being down and must never be mistaken for "no payment happened."

Permissionless and bounty-funded; the demo runs two against different builders. `DRY_RUN=1` observes without sending.

### 4.7 Lens — implemented

A **pure projection over on-chain events**. It holds no privileged state, decides nothing, and can be rebuilt from genesis by any stranger with an RPC endpoint — the property that makes it credible as a public record rather than a vendor database. `sync()` re-reads obligations in full rather than mutating incrementally, so a missed event cannot leave the index skewed.

`GET /solvency/:entity` · `/encumbrance/:asset` · `/obligation/:id` · `/underwriter/:addr` · `/obligations` · `/health`. Free, unauthenticated, CORS-open, read-only — strategic, not unfinished: coverage comes from venues integrating the read path, and charging at the door would trade the network effect for rounding-error revenue. The paid tier is the aggregate institutional product (concentration, correlation, portfolio exposure), not the per-obligation lookup that makes registering worthwhile.

**The one editorial decision it makes:** bonded and unbonded claims are returned in separate buckets and are *never* summed. There is deliberately no `total` field. Registration is permissionless — a registry that gatekeeps registration is just a private database — but that means anyone can register fictional debts against a competitor, and a naive total would make that attack free. Weighting by registrar bond is what gives the number meaning. A test asserts the combined total does not exist.

Underwriter reputation is likewise **derived, never stored** — a view over history rather than a mutable score someone can be talked into adjusting, which is the failure mode of every on-chain credit score that came before.

---

## 5. ASC integration reference

| Item | Value |
|---|---|
| `BlockProver` | `0x0000000000000000000000000000000000000FD2` |
| `ChainInfo` | `0x0000000000000000000000000000000000000fD3` (note the checksum — `0FD3` will not compile) |
| Decoder | `EvmV1Decoder` from `@gluwa/usc-contracts@0.1.2` — **`public` library functions, so it must be deployed and linked** |
| Proof Builder (testnet) | `https://proof-gen-api.cc3-testnet.creditcoin.network/` (Swagger) |
| SDK | `@gluwa/usc-sdk@0.18.0` — exports are **namespaced** (`encoding`, `queryBuilder`, `proofProvider`, `chainInfo`, `blockProver`, `utils`), not flat |
| `encodedTransaction` | `abi.encode(['uint8','bytes[]'], [txType, chunks])` — chunk 1 common fields, last chunk receipt |
| Batch limit | 10 queries per shared continuity proof |
| Cost model | `CTC ≈ 2.3e-5 + 2.9e-7 × continuityHashCount` |

### 5.1 Chainkey gotcha

| Environment | Ethereum mainnet | Sepolia |
|---|---|---|
| CC3 **testnet** | **3** | 1 |
| CC3 **mainnet** | **1** | — |

Never hardcode. `AscVerify.assertChainId(chainKey, expectedChainId)` resolves via `get_chain_by_key` and reverts on mismatch; deploy scripts call it.

---

## 6. Demo scenario

| Step | Action | Proves |
|---|---|---|
| 1 | Venue A registers a $5,000 obligation | Registration is permissionless and near-free |
| 2 | Venue B queries solvency **before lending** and sees it | *The query that does not exist in crypto today* |
| 3 | Underwriter posts $500 named first-loss at 340bps | Credit as a market, not a score |
| 4 | Period 1 repaid on Ethereum **mainnet** → keeper proves → `Current` | ASC readability, happy path |
| 5 | Period 2: silence. Head passes the window. Keeper marks delinquent | **Degradation by default** |
| 6 | Cure height passes → `finalizeDefault()` → **bond slashed in the same block** | Enforcement with no court, committee, or reporter |
| 6b | *(alt)* Late proof at an in-window height → back to `Current`, cured-late | I4 |
| 7 | Verify a real 2-year-old mainnet transaction; show the gas | Deep history at fractions of a cent |
| 8 | *(alt)* Freeze the attested head → every penalty path refuses | I7 |

---

## 7. Out of scope for the hackathon

- ZK selective disclosure. v1 identity is a commitment, but `sourcePayer`, `sourcePayee` and amounts are **public by construction**. Documented, not hidden; the v2 answer is a source-chain payment router giving each obligation an ephemeral payer address.
- `EncumbranceAdapter` (stretch; ship encumbrance as a Lens read over `collateralRef` if time runs short).
- Multi-source-chain support — blocked on ASC, not on us.
- Native-value (non-ERC-20) repayment adapters. Note this is where the `receiptStatus` guard does real work (§10, C4).
- Legal lien perfection; cohort bonds; tranching; secondary trading of capacity; mainnet.

---

## 8. Build order

| Days | Deliverable | Done when |
|---|---|---|
| ✅ | `AscVerify` + real mainnet fixtures + 15 tests | Passing, and mutation-tested |
| 13–16 Aug | Same, verified against **live CC3 testnet** with a real Proof Builder proof | One real mainnet tx verified on-chain |
| 17–20 Aug | `Register` + status machine + `PaymentAdapter` | Happy path green |
| ✅ | `AscVerifier` + `PaymentAdapter` + `SilenceAdapter` + I7 liveness gate + cure | 14 integration tests green, incl. stall-recovery |
| ✅ | `Bond` + pro-rata slashing + premium escrow | 13 tests green, INV-1 fuzzed at 1025 runs |
| 21–28 Aug | Re-verify the whole path against live CC3 testnet | Real proof, real head, real slash |
| ✅ | Keeper (poke/prove/sweep) + Lens (projection + API) | 7 projection tests green; both smoke-tested |
| 29 Aug–1 Sep | Unattended end-to-end run against live CC3 testnet | Keeper proves and defaults with no human in the loop |
| 2–3 Sep | Demo UI | §6 runs start to finish |
| 4–6 Sep | Video, README, technical doc, deck | Submitted ≥24h early |

---

## 9. Repository layout

```
dokett/
├── src/
│   ├── interfaces/{INativeQueryVerifier,IChainInfo}.sol   transcribed from shipped ABIs
│   ├── lib/AscVerify.sol                                  ← publish standalone, MIT
│   ├── Register.sol · Bond.sol
│   └── adapters/{Payment,Silence,Encumbrance}Adapter.sol
├── test/            Foundry: unit + fork + invariant, mocks at the real precompile addresses
├── demo/            gen-fixtures.js + real mainnet fixtures
├── worker/ lens/ app/
└── docs/
```

**First commit: 13 Aug 2026.**

---

## 10. Corrections log

Kept in the document on purpose. Each entry is a claim v0.1 made, what the shipped code actually says, and what changed.

### C1 — "Readability only; writability does not exist"
**Wrong.** `@gluwa/usc-contracts@0.1.2` ships a write-ability layer: `SimpleOutbox`/`SimpleOutboxFactory` (source-side publishing), `SimpleInbox` (destination delivery), `EOAValidator` (ECDSA recover + attestor allowlist + `2N/3+1` threshold), and `AcknowledgementValidator` (proof-based acknowledgment via the block-prover precompile).
**Effect:** none on the design — I1 is now justified by trust model rather than by impossibility. Destination-side writability is secured by an attestor signature threshold, materially weaker than the read path. Writability moves from "impossible" to "roadmap, once its trust model is worth inheriting."

### C2 — "Match payments on source-chain timestamp"
**Unimplementable.** No timestamp exists in anything the proof binds: `CommonTxFields` carries none, and `ChainInfo` exposes heights only. A caller-supplied timestamp would be an unverified argument, violating I2.
**Effect:** the entire schedule is now denominated in attested source-chain block height (§3.1). Strictly better — see the three reasons there.

### C3 — "A staleness check on the attested head is sufficient liveness protection"
**Insufficient.** Height-based windows already make a stall harmless (a frozen head expires nothing). The real hazard is *recovery*: a catch-up jump expires every pending window at once. Two sparse samples cannot distinguish that from normal progress.
**Effect:** replaced with observation continuity (I7). Penalties require an unbroken observation record of `recoveryGrace`; any gap resets it. Failure direction is now "penalties are delayed," never "penalties are accelerated."

### C4 — "Without the receiptStatus guard, a reverted transfer clears a payment window"
**Overstated, and caught by mutation-testing our own test.** Removing the guard does not let the reverted fixture through — it fails later with `LogIndexOutOfRange(0, 0)`, because **a reverted transaction carries no logs at all** (logs are discarded on revert). Log-matching adapters have an accidental backstop.
**The guard is still load-bearing**, for two reasons: adapters matching on *transaction fields* rather than logs — a native-value repayment, calldata inspection — have no backstop and would decode a clean `{from, to, value}` from a reverted transaction; and failing for the right reason beats failing by luck. The test now asserts the specific error, pinning the ordering so no future adapter inherits the accident.
