# ASC Integration

**Covenant · BUIDL CTC 2026 Fall**

> Every number in this document was measured against live CC3 testnet and real
> Ethereum mainnet transactions, across four proofs spanning twenty minutes to
> two years of Ethereum history. Nothing here is quoted from a specification we
> did not exercise ourselves — including the cost model, which we re-derived
> from our own measurements and reconciled against the published one (§3.3).

---

## 0. Three minutes

Covenant uses ASCs as its **only** source of truth about the outside world. No
party can assert that a loan was repaid or defaulted; exactly two things move an
obligation's state — an ASC-verified Ethereum event, or a comparison against the
attested source-chain height.

Five things distinguish this from a single decorative `verify()` call:

| | |
|---|---|
| **Real mainnet evidence** | CC3 testnet attests Ethereum **mainnet** at chainKey 3, confirmed by the precompile. Every proof here is against a real mainnet transaction, not one we sent to Sepolia a minute earlier. |
| **Absence as a primitive** | `SilenceAdapter` uses the oracle to act on what *didn't* happen — permissionless default detection with no reporter anywhere in the loop. |
| **The success-flag guard** | `BlockProver` does not validate transaction success. `AscVerify` asserts it before touching a log, and is published standalone MIT. |
| **Height as the clock** | Nothing in the proven data carries a timestamp, so every deadline is denominated in attested block height. This makes stall protection structural rather than bolted on. |
| **Liveness gate** | Penalties require an unbroken observation record of the attested head. A stalled oracle must never manufacture defaults. |

**Verified end to end on 17 Aug 2026.** One real mainnet USDC transfer, proven on
CC3 testnet through the live precompiles:

```
source tx   0x8090cdb362074647ca6c3d04326d166a93920e9ccf4afe54e5cbe1fe838a8aa9
source blk  25773532        (Ethereum mainnet)
proof tx    0xfb0b852344d2bd1bb9c786e8cce490f38b4558c27ff6f2a631a804b201344e81
gas         380,674         cost 0.000190337 CTC
```

Probe contract, source verified:
[`0x86c41594e9adeccf8c85ba9eee0138c7c9e70dbc`](https://creditcoin-testnet.blockscout.com/address/0x86c41594e9adeccf8c85ba9eee0138c7c9e70dbc)

Reproduce with `npm run prove:one`.

---

## 1. Environment

| Component | Value |
|---|---|
| `BlockProver` precompile | `0x0000000000000000000000000000000000000FD2` |
| `ChainInfo` precompile | `0x0000000000000000000000000000000000000fD3` |
| `EvmV1Decoder` | `@gluwa/usc-contracts@0.1.2` — **`public` library, must be deployed and linked** |
| Our deployed decoder | `0xe701c6ac62c7095a07b46cc2c4ac06fdfa3c7274` |
| Proof Builder | `https://proof-gen-api.cc3-testnet.creditcoin.network` |
| SDK | `@gluwa/usc-sdk@0.18.0` — exports are **namespaced**, not flat |
| CC3 testnet chainId | `102031` |

### 1.1 Chainkeys, read from the chain

Chainkeys are **not portable between environments**, and a wrong one does not
error — it verifies proofs correctly against the wrong chain. Read live from
`ChainInfo.get_supported_chains()`:

| chainKey | chainId | name |
|---|---|---|
| **3** | **1** | Ethereum *(what we use)* |
| 1 | 11155111 | Sepolia ethereum |

`AscVerify.assertChainId()` resolves this at deploy time and reverts on
mismatch. Nothing hardcodes a chainkey.

### 1.2 EVM version — the chain told us what it is

CC3 block headers carry **no `mixHash`**, **no `withdrawalsRoot`**, and
`difficulty: 0x0`. That is a pre-Shanghai header, and it forced a correction:

- Forge's fork header validation demands `prevrandao` and **panics** without it.
- `solc` under Shanghai emits **`PUSH0`**, which this Frontier build is unlikely
  to execute — a deploy that succeeds locally and reverts on chain.

`evm_version = "london"` matches the header evidence and emits no `PUSH0`
(verified: zero PUSH0 prologues across all rebuilt artifacts).

### 1.3 Precompiles cannot be read through a fork

`forge script` executes locally against a fork, and a fork carries only code,
storage and balances. A native Substrate precompile has **no EVM bytecode**, so
revm sees an empty account and returns `0x` — and Solidity's `try/catch` does
**not** catch the resulting decode failure, so a typed call takes the whole
deployment down with it.

Deploy scripts therefore read precompiles via low-level `staticcall`, checking
`ok && data.length > 0`. Anything that must genuinely exercise a precompile runs
as a real `eth_call` against the node, never inside a forge simulation.

---

## 2. Proof lifecycle, measured

```
 [1] Ethereum mainnet   borrower sends USDC to the creditor
 [2] wait MIN_CONFIRMATIONS (64)
 [3] poll ChainInfo until the block is attested        ← lag measured at 34 blocks
 [4] ProofBuilder.getProof(txHash)                     ← 674 ms
 [5] submit to PaymentAdapter on Creditcoin
 [6] AscVerify: liveness → depth → replay → verify →
     receiptStatus == 1 → extract log                  ← 380,674 gas, one block
```

Steps 5–6 happen **synchronously inside one transaction**. No callback, no
request/response round trip, no pending state — which is what makes a status
machine driven purely by evidence tractable at all.

Measured artefacts for the fixture above:

| | |
|---|---|
| encoded transaction | 1,664 bytes |
| transaction type | 2 (EIP-1559) |
| receipt status | 1 |
| tx index in block | 11 |
| merkle siblings | 10 |
| continuity roots | 9 |
| attestation lag | 34 blocks (~7 min) |

**The builder's `txBytes` matched our locally SDK-encoded bytes exactly.**
Everything downstream assumes those agree, and now that is checked rather than
assumed.

---

## 3. How each capability is used

### 3.1 Presence — `PaymentAdapter`

Verifies inclusion of a qualifying ERC-20 `Transfer` and advances the
obligation. Every field is enforced against the **decoded log**, never against a
caller-supplied argument:

```
log.address == lo.sourceToken
topic0      == Transfer(address,address,uint256)
topic1      == lo.sourcePayer
topic2      == lo.sourcePayee
value       >= lo.periodAmount
height      ∈ (windowStart, windowEnd]
```

### 3.2 Absence — `SilenceAdapter`

**What it does not claim.** You cannot prove a negative with an inclusion proof.
There is no ASC primitive for "no transaction matching predicate P exists in
blocks N…M", and this document does not claim one.

**What it proves** — an on-chain fact about Creditcoin state:

> no admissible proof of payment for this window was presented before the
> attested head passed `windowEndHeight + minConfirmations`

**Why that is equivalent to non-payment in practice.** Submission is
permissionless. It costs a fraction of a cent. The borrower is the party most
motivated to submit. And if the inference is ever wrong, it is reversible: a
proof whose *source height* falls inside the missed window restores `Current`
however late it arrives.

The result is a system where nobody has to volunteer bad news and nobody can
suppress it.

### 3.3 Deep history — measured, and better than the model implies

Continuity-proof cost grows with a transaction's age because attestation
checkpoints thin out. **This is the property that decides whether a permanent
registry is economic**, since a registry exists precisely to answer questions
about old facts. So we measured it rather than quoting it.

Every row below is a real Ethereum mainnet USDC transfer, proven on live CC3
testnet. All four are reproducible: `npm run prove:one <txHash>`.

| Age | Blocks back | Roots | Encoded bytes | Gas | CTC | Type |
|---|---|---|---|---|---|---|
| ~20 min | 102 | 9 | 1,664 | 380,674 | 0.000190337 | 2 |
| ~35 min | 162 | 6 | 1,536 | 375,746 | 0.000187873 | **0 (legacy)** |
| ~24 hours | 7,202 | 32 | — | 389,186 | 0.000194593 | 2 |
| ~1 year | 2,628,005 | 232 | — | 478,786 | 0.000239393 | 2 |
| ~2 years | 5,256,008 | 232 | — | 478,786 | 0.000239393 | 2 |

**The headline: 26% more cost for 51,529× the age.**

And note rows three and four are *identical* — same root count, same gas, to the
unit. The continuity proof does not grow without bound; past roughly a year it
saturates at 232 roots, because the walk terminates at a checkpoint a bounded
distance away rather than tracking all the way back. Deep history is therefore
close to flat-cost, not linear. Proving a two-year-old fact costs one twentieth
of a US cent.

That is a stronger claim than the published model suggests, and it is the whole
economic argument for a permanent registry living here.

#### Reconciling with the published model

Creditcoin's readability docs give `CTC ≈ 2.3e-5 + 2.9e-7 × continuityHashes`.
Our measurements are higher, and decomposing them shows exactly where — and that
the docs are not wrong, they are measuring something narrower.

Fitting our own two extremes (9 roots → 232 roots, +98,112 gas):

| | Published | Measured | |
|---|---|---|---|
| Marginal cost per continuity root | 580 gas | **440 gas** | ours is **cheaper** (0.76×) |
| Fixed base cost | 46,000 gas | **376,714 gas** | ours is **8.2× higher** |

*(All at the observed 0.5 gwei base fee.)*

The per-root coefficient agrees closely. The divergence is entirely in the fixed
base, which is the giveaway: the published figure is the cost of the **bare
precompile verification**, while ours is the cost of the **entire guarded path** —
an external call into the 13KB `EvmV1Decoder` library, full receipt decoding, log
extraction, an `SSTORE` for the replay guard, a `ChainInfo` staticcall for the
liveness gate, and an event emit.

In other words we are paying about 330,000 gas for the safety properties in §4,
on top of the verification itself. That is a deliberate trade and worth stating
plainly rather than hiding behind a formula: **the guards cost more than the
proof does.** At 0.5 gwei it is still a fifth of a cent, which is the correct
price for not accepting a reverted transfer as a payment.

#### A second variable, and a bug it exposed

The legacy row initially looked like an outlier — 3,608 gas *below* the model.
It is not noise. That transaction encodes to 1,536 bytes against the type 2
fixture's 1,664, and 3,608 gas over 128 bytes is **28.2 gas/byte**, which is
what decoding costs (16 gas/byte for non-zero calldata, plus memory and decode
overhead). Adding the term:

```
gas ≈ 376,714 + 440 × continuityRoots + 28 × (encodedBytes − 1664)
```

Residuals across all five measurements are ≤ 8 gas on the three points where
byte counts match the fit. The model is not extrapolated; it is fitted to
measurements and checked against the rest.

**What that measurement actually caught.** Chasing the outlier revealed that
*both* Foundry fixtures were EIP-1559 type 2, so the decoder's legacy branch had
never been executed by a single test. The suite would have stayed green while
pre-1559 transactions failed on chain — and Ethereum still carries plenty of
them, so a registry that silently rejected legacy payments would wrongly default
exactly the borrowers who make them. There is now a real type 0 mainnet fixture
and a test asserting it decodes identically
(`test_LegacyTransactionType_DecodesIdentically`).

Worth noting how it surfaced: not from reading the decoder, but from a gas
number that was 1% off.

### 3.4 Liveness

The most dangerous failure in a degrade-by-default system: if the attestor set
halts, **no** proof can be produced for **anyone**, every live obligation blows
through its window simultaneously, and the keeper network mass-defaults the book.

Height-denominated deadlines already make a stall harmless — a frozen head
expires nothing. The hazard is **recovery**: a catch-up jump expires every
pending window at once, and two sparse samples cannot distinguish that from
normal progress.

So the rule is about **observation, not measurement**. Penalties require the head
to have been observed advancing with no coverage gap for `recoveryGrace`. Any
gap — a real stall, or simply nobody watching — resets the timer. An adversary
who withholds observation can only *delay* penalties, never accelerate them.

Measured: attestation lag runs ~34 blocks, comfortably inside the 15-minute
`maxSampleGap`, so a healthy chain sustains the observation record easily.

### 3.5 Batching — measured

Up to **10** proofs share one continuity proof via `verifyBatch()`. Since the
continuity proof is the component that grows with age, a batch pays for it once.

Measured on live CC3, ten real mainnet USDC transfers from one block:

| Queries | Total gas | Per query | Saving |
|---|---|---|---|
| 1 | 403,774 | 403,774 | — |
| 5 | 572,950 | 114,590 | **71.6%** |
| 10 | 870,559 | 87,055 | **78.4%** |

Reproduce with `npm run prove:batch 1,5,10`.

This is what makes a registry sweep tractable. A keeper reconciling thousands of
obligations does not verify them one at a time, and at ten per batch the
per-obligation cost falls by more than three quarters. Combined with §3.3 — deep
history saturating at 232 roots — the cost of maintaining a permanent record does
not grow the way a naive reading of the model suggests.

> **A note on how this was measured.** The first attempt reverted with
> `ProofAlreadyConsumed`. The harness had reused the same transactions across
> batch sizes, and proof keys are global and single-use — so the replay guard
> was working exactly as designed, on the test. Fixed by giving each batch
> disjoint transactions. Worth recording because it is a case of the safety
> property catching the people who wrote it.

## 4. `AscVerify.sol` — the guard layer

Every adapter reaches the precompiles **only** through this contract.

### 4.1 The success-flag footgun

> *"The native verifier precompile does not validate if a transaction was
> successful or not."* — Creditcoin ASC docs

A reverted ERC-20 transfer is still a validly-included transaction with a valid
Merkle proof. Any contract proving a payment without checking receipt status can
be satisfied by a **failed** transfer.

`AscVerify` decodes the receipt and requires `status == 1` **before any log is
touched**. Regression fixture: a real reverted mainnet transaction.

**A correction worth recording.** Mutation-testing our own test showed that
deleting this guard does *not* let the reverted fixture through — it fails later
with `LogIndexOutOfRange(0, 0)`, because a reverted transaction carries no logs
at all. Log-matching adapters have an accidental backstop.

The guard is still load-bearing, for two reasons: adapters matching on
*transaction fields* rather than logs (a native-value repayment, calldata
inspection) have no such backstop and would decode a clean `{from, to, value}`
from a reverted transaction; and failing for the right reason beats failing by
luck. The test asserts the specific error, pinning the ordering so no future
adapter inherits the accident.

### 4.2 Replay protection

`consumed[keccak256(chainKey, height, txIndex, logIndex)]` — **global, not
per-obligation**, so one payment cannot satisfy two obligations. `logIndex` is
included so a multi-transfer transaction decomposes correctly.

### 4.3 Confirmation depth

Proofs are rejected unless `height ≤ attestedHead - minConfirmations` (64).
Measured against a live head to confirm the check fires on real data.

### 4.4 Published standalone

Released MIT, independent of Covenant, so any ASC project can inherit the
guards.

---

## 5. Verification

All deployed contracts are source-verified on Blockscout. `npm run deploy` and
`npm run deploy:probe` verify as part of the deployment; `npm run verify`
re-verifies an existing deployment when only that step failed.

A registry whose entire claim is that nothing can be asserted has no business
shipping bytecode nobody can read.

---

## 6. What we would build next on ASC

- **Multi-source-chain adapters**, the moment ASC attests beyond Ethereum. Each
  new source chain multiplies coverage with no change to `Register`.
- **`EncumbranceAdapter`** proving pledge/lock events, so a lien is registered
  from source-chain evidence rather than asserted.
- **Writability**, if its trust model becomes worth inheriting. Today all
  consequences are local to Creditcoin — slashed bonds, revoked capacity, a
  permanent record. `@gluwa/usc-contracts` ships an outbox/inbox layer secured by
  an attestor signature threshold, materially weaker than the read path, so we
  have deliberately not used it.
- **Attestor decentralisation**, our most important external dependency, and the
  reason `AscVerify` is structured so a second evidence backend can be swapped in
  without touching the registry.

---

## 7. References

- ASC docs — https://docs.creditcoin.org/creditcoin-usc
- Chains & environments — https://docs.creditcoin.org/creditcoin-usc/usc-chains-environments
- Readability gas costs — https://docs.creditcoin.org/creditcoin-usc/readability/gas-costs
- ASC SDK — https://docs.creditcoin.org/creditcoin-usc/dapp-builder-infrastructure/usc-sdk
- Attestor operator guide — https://docs.creditcoin.org/creditcoin-usc/usc-operator-guides/attestor-operator-guide
