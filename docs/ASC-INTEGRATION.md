# ASC Integration

**Covenant · BUIDL CTC 2026 Fall**

> Every number in this document was measured against live CC3 testnet and real
> Ethereum mainnet transactions. Nothing here is quoted from a specification we
> did not exercise ourselves — including, importantly, the one place where the
> published cost model turned out not to match reality (§4).

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

### 3.3 Deep history

Continuity-proof cost grows with a transaction's age, because checkpoints thin
out. **This is the property that decides whether a permanent registry is
economic**, since a registry exists precisely to answer questions about old
facts.

| Age | Continuity roots | Gas | CTC | Notes |
|---|---|---|---|---|
| ~20 min (102 blocks) | 9 | 380,674 | 0.000190337 | measured |
| ~24 h | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | `npm run prove:one <txHash>` |
| ~1 year | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | |
| ~2 years | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | |

> **⚠️ The published cost model does not match measurement.**
>
> Creditcoin's readability docs give `CTC ≈ 2.3e-5 + 2.9e-7 × continuityHashes`,
> which predicts **2.56e-5 CTC** for 9 roots. We measured **1.90e-4 CTC** —
> about **7.4× higher**.
>
> We have not diagnosed the gap and are not going to guess at it publicly. It may
> be gas price (1.5 gwei at the time), a decode cost the formula omits, or a
> model written against an earlier release. It is recorded here because a
> document whose argument rests on cost cannot quote a formula it has watched
> fail. Every figure in the table above is measured, and the remaining rows will
> be measured too rather than extrapolated.

Even at the measured figure, proving a real mainnet transaction costs about
**one fiftieth of a US cent**. The argument survives; the arithmetic behind it
just has to be ours.

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

### 3.5 Batching

Up to **10** proofs share one continuity proof via `verifyBatch()`. Batches form
per source block, since that is the granularity at which a continuity proof is
shared.

| Queries | Total gas | Per query | Saving |
|---|---|---|---|
| 1 | 380,674 | 380,674 | — |
| 5 | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| 10 | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |

---

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
