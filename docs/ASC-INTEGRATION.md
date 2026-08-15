# ASC Integration — Technical Documentation

**Covenant · BUIDL CTC 2026 Fall**
Submission requirement: *"Technical documentation detailing your setup and explaining how the project uses ASCs."*
Scoring note: *"Depth of ASCs utilization will be evaluated as one of the core scoring criteria."*

> Draft skeleton written 29 Jul 2026. Prose is final; every `<!-- FILL -->` is a measurement or address produced during the build.

---

## 0. Summary for a reviewer with three minutes

Covenant uses ASCs as its **sole source of truth about the outside world**. No party can assert that a loan was repaid or defaulted; the only two things that can move an obligation's state are (a) an ASC-verified Ethereum event, and (b) the expiry of a deadline in Creditcoin block time.

Five things distinguish this integration from a single decorative `verify()` call:

| | |
|---|---|
| **Real mainnet evidence from testnet** | CC3 testnet attests Ethereum **mainnet** at chainkey 3. Every proof in this project is against a real mainnet transaction. |
| **Absence as a primitive** | `SilenceAdapter` uses the oracle to act on what *didn't* happen — permissionless default detection with no reporter. |
| **Deep history** | Proofs against transactions >2 years old, exercising the continuity-proof cost curve that makes a permanent registry economic. |
| **The success-flag guard** | `BlockProver` does not validate transaction success. `AscVerify.sol` does, and is published standalone MIT. |
| **Liveness circuit breaker** | Degradation halts when the attested head goes stale. A stalled oracle must never manufacture defaults. |

---

## 1. Environment and configuration

### 1.1 Addresses

| Component | Address / URL |
|---|---|
| `BlockProver` precompile | `0x0000000000000000000000000000000000000FD2` |
| `ChainInfo` precompile | `0x0000000000000000000000000000000000000fd3` |
| Decoder (CC3 testnet) | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |
| Proof Builder (CC3 testnet, hosted) | `https://proof-gen-api.cc3-testnet.creditcoin.network/` — Swagger available |
| Proof Builder (self-hosted fallback) | <!-- FILL: our deployment --> |
| USC/ASC dashboard | `https://dashboard.cc3-testnet.creditcoin.network/` |
| SDK | `@gluwa/usc-sdk` (peer dep: ethers v6) |

### 1.2 Chainkeys — resolved, never hardcoded

Chainkeys are **not stable across environments**:

| Environment | Ethereum mainnet | Sepolia |
|---|---|---|
| CC3 **testnet** | **3** | 1 |
| CC3 **mainnet** | **1** | — |

Covenant resolves chainkeys through `PrecompileChainInfoProvider` at deploy time, stores them per-network in `config/networks.json`, and asserts the resolved genesis hash matches the expected chain before any contract is initialised. A hardcoded chainkey is a silent cross-chain verification against the wrong chain — the deploy script fails loudly instead.

<!-- FILL: paste the deploy-script assertion output showing resolved chainkey + genesis -->

### 1.3 Chain parameters relied upon

15s block time · finality in 1–3 blocks · 75,000,000 block gas limit · 0.5 gwei base fee · CTC as gas. Window arithmetic uses Creditcoin `block.timestamp`; all *evidence* timestamps come from the source chain and are never mixed with local time (see §3.3).

---

## 2. Proof lifecycle

```
 [1] Ethereum mainnet: borrower sends USDC to the creditor's address
              │
 [2] Keeper observes the Transfer log; waits MIN_CONFIRMATIONS (64 blocks)
              │
 [3] Keeper polls ChainInfo (0x…0FD3) until that block is attested on Creditcoin
              │
 [4] ProofBuilder.getProof(txHash) → { txBytes, merkleProof, continuityProof }
              │
 [5] Keeper submits to PaymentAdapter on Creditcoin
              │
 [6] AscVerify: circuit breaker → confirmation depth → BlockProver.verify()
     → decode receipt → assert status == 0x1 → replay guard → extract log
              │
 [7] Adapter matches (token, from, to, value ≥ periodAmount, timestamp ∈ window)
              │
 [8] Register advances the obligation. One block. ~15 seconds.
```

Steps 6–8 happen **synchronously inside a single transaction**. There is no callback, no request/response round trip, and no pending state — which is what makes a status machine driven purely by evidence tractable at all.

<!-- FILL: a real end-to-end trace — tx hashes on both chains, timestamps, gas used -->

---

## 3. How each ASC capability is used

### 3.1 Presence — `PaymentAdapter`

Verifies inclusion of a qualifying ERC-20 `Transfer` on Ethereum mainnet and advances the obligation.

Match predicate, all enforced on the **decoded** log rather than on caller-supplied arguments:

```
log.address == lo.sourceToken
topic0      == Transfer(address,address,uint256)
topic1      == lo.sourcePayer
topic2      == lo.sourcePayee
value       >= lo.periodAmount
sourceTs    ∈ (windowStart - GRACE_BEFORE, lo.windowEndsAt]
```

Overpayment covers `value / periodAmount` future windows, capped at the remaining schedule.

<!-- FILL: contract excerpt + the mainnet tx used as the fixture -->

### 3.2 Absence — `SilenceAdapter` ← the core of the integration

**What it does not claim.** You cannot prove a negative with an inclusion proof. There is no ASC primitive for "no transaction matching predicate P exists in blocks N…M," and this document does not claim one.

**What it does prove.** An on-chain fact about Creditcoin state:

> No admissible proof of payment for window W was presented to this contract before `windowEndsAt + attestationBuffer`.

**Why that is economically equivalent to non-payment.** Proof submission is permissionless — the borrower, the creditor, a keeper, or any bot may submit. It costs ~$0.000024, three orders of magnitude below any payment it would evidence. The borrower is the party with the strongest incentive to submit. And if the inference is ever wrong, it is **reversible**: a payment proof whose *source-chain* timestamp falls inside the missed window restores `Current` at any point before the cure window closes, and the obligation is recorded as *cured-late* rather than defaulted.

The result: nobody has to volunteer bad news, and nobody can suppress it.

```
markDelinquent(loId):
    require(chainLive(lo.sourceChainKey))                     // §3.4
    require(block.timestamp > lo.windowEndsAt + attestationBuffer)
    require(lo.lastProvenAt  < lo.windowEndsAt - lo.periodSeconds)
    lo.status     = Delinquent
    lo.cureEndsAt = block.timestamp + CURE_PERIOD             // 7 days
    pay(msg.sender, keeperBounty)

finalizeDefault(loId):
    require(lo.status == Delinquent && block.timestamp > lo.cureEndsAt)
    require(chainLive(lo.sourceChainKey))
    lo.status = Default
    bond.slash(loId, lo.outstanding, lo.creditorPayout)       // same block
```

`attestationBuffer` (45 min) covers attestation lag plus proof-build time, so a payment made in the last minute of a window is still provable.

### 3.3 Deep history

Continuity-proof cost grows with a transaction's age because checkpoints thin to roughly one per 1,000 blocks. Documented model:

```
CTC ≈ 2.3e-5 + 2.9e-7 × continuityHashCount
```

Measured on CC3 testnet against Ethereum mainnet:

| Transaction age | Continuity hashes | Gas | CTC | ≈ USD |
|---|---|---|---|---|
| ~10 minutes | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| ~24 hours | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| ~1 year | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| **~2 years** | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| Large-tx decode | — | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |

This is not a benchmark for its own sake. A credit registry must verify obligations and liens that are *old* — that is what registries are for. The cost of proving a two-year-old fact is the parameter that decides whether a permanent registry is economic, and on Creditcoin it is a fraction of a cent. No bridge or messaging protocol offers this at all; ZK coprocessors offer it at orders of magnitude more cost and minutes of latency.

<!-- FILL: the actual mainnet tx hashes used at each age, so a judge can reproduce -->

### 3.4 Liveness circuit breaker

The most dangerous failure mode in a degradation-by-default system: if the attestor set halts, **no** payment proof can be produced for **anyone**, every live obligation blows through its window simultaneously, and the keeper network mass-defaults the entire book.

`AscVerify.chainLive(chainKey)` reads the attested head timestamp from `ChainInfo` and returns false when it is staler than `STALE_THRESHOLD` (2h). While false:

- `markDelinquent()` and `finalizeDefault()` **revert**
- live windows extend by the stall duration once the head recovers
- **payment proving and cures continue to work normally**

A stalled oracle must never manufacture a default, and must never block a borrower from curing one.

<!-- FILL: fork test output — freeze head, assert every degradation path reverts, unfreeze, assert extension -->

### 3.5 Batching

The registry sweep groups up to **10** proofs sharing a continuity proof into `verifyBatch()`. Measured amortisation:

| Queries per batch | Total gas | Gas per query | Saving |
|---|---|---|---|
| 1 | <!-- FILL --> | <!-- FILL --> | — |
| 5 | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |
| 10 | <!-- FILL --> | <!-- FILL --> | <!-- FILL --> |

Batches are formed per source block, since that is the granularity at which a continuity proof is shared.

---

## 4. `AscVerify.sol` — the guard layer

Every adapter reaches the precompiles **only** through this contract. It exists so no integrator on this team, or in this ecosystem, can forget the following.

### 4.1 The success-flag footgun

> *"The native verifier precompile does not validate if a transaction was successful or not."* — Creditcoin ASC docs

A reverted ERC-20 transfer is still a validly-included transaction with a valid Merkle proof. Any contract that proves a payment without checking the receipt status can be satisfied by a **failed** transfer, for free. We regard this as the single most likely real bug in ASC integrations shipped this season.

`AscVerify` decodes the receipt from the verified `txBytes` and requires `status == 0x1` before any adapter logic runs. Regression fixture: a real reverted Ethereum mainnet transaction. <!-- FILL: tx hash -->

### 4.2 Replay protection

`consumed[keccak256(chainKey, txHash, logIndex, loId)]`. Keyed with `loId` so one payment cannot satisfy two obligations, and with `logIndex` so multi-transfer transactions decompose correctly.

### 4.3 Confirmation depth

Proofs are rejected unless `sourceBlockNumber ≤ attestedHead - MIN_CONFIRMATIONS` (64 Ethereum blocks), keeping consumed evidence clear of reorgs. Per-chain configurable.

### 4.4 Published standalone

`AscVerify.sol` is released MIT as a standalone contract, independent of Covenant, so any ASC project can inherit the guards. <!-- FILL: repo/package link -->

---

## 5. Off-chain components

### 5.1 Keeper (permissionless)

TypeScript, `@gluwa/usc-sdk`. Subscribes to `Register` events, watches the source chain for qualifying logs, waits for confirmations and attestation, builds proofs, submits. On window expiry with no match, marks delinquent; after cure, finalises.

Anyone can run one — the bounty is the incentive, and the demo runs two instances against **two different proof builders** (hosted + self-hosted) so no single endpoint is load-bearing. A proof builder can censor but never forge, since proofs are verified on-chain.

### 5.2 Lens (indexer + free public API)

Built entirely from `Register` events; holds no privileged state. `GET /solvency/:entity` · `GET /encumbrance/:asset` · `GET /obligation/:id` · `GET /underwriter/:addr`.

Bonded and unbonded claims are returned in **separate buckets** and never summed into one number — registration is permissionless, so a naive total would be trivially poisoned.

---

## 6. Reproducing the demo

```bash
pnpm demo:seed      # register obligation, post named first-loss bond
pnpm demo:pay       # prove period 1 against a real Ethereum mainnet transfer
pnpm demo:silence   # window expires → markDelinquent → cure expires → slash
pnpm demo:cure      # alternate branch: late proof restores Current (cured-late)
pnpm demo:history   # verify a >2-year-old mainnet transaction, print gas
pnpm demo:stall     # simulate a stalled attested head; assert no defaults occur
```

<!-- FILL: expected output for each, so a judge can diff -->

Every transaction referenced by the demo is listed in `demo/fixtures.json` with its Etherscan link, so a reviewer can confirm the evidence is real mainnet history and not synthetic.

---

## 7. What we would build next on ASC

- **Multi-source-chain adapters** the moment ASC attests beyond Ethereum — each new source chain multiplies what the registry can cover, with no change to `Register`.
- **`EncumbranceAdapter`** proving pledge/lock events so a lien is registered from source-chain evidence rather than asserted.
- **Writability**, if it ever ships: today Covenant's consequences are entirely local to Creditcoin (slashed bonds, revoked capacity, a permanent record). Source-chain writability would let a registered lien be enforced where the collateral actually lives — the single largest capability unlock on the roadmap.
- **Attestor decentralisation**, which we treat as our most important external dependency, and the reason `AscVerify` is designed so a second evidence backend can be swapped in without touching the registry.

---

## 8. References

- ASC docs — https://docs.creditcoin.org/creditcoin-usc
- Architecture overview — https://docs.creditcoin.org/usc/overview/usc-architecture-overview
- Chains & environments — https://docs.creditcoin.org/creditcoin-usc/usc-chains-environments
- Readability gas costs — https://docs.creditcoin.org/creditcoin-usc/readability/gas-costs
- dApp design patterns — https://docs.creditcoin.org/creditcoin-usc/dapp-builder-infrastructure/dapp-design-patterns-readability
- ASC SDK — https://docs.creditcoin.org/creditcoin-usc/dapp-builder-infrastructure/usc-sdk
- Attestor operator guide — https://docs.creditcoin.org/creditcoin-usc/usc-operator-guides/attestor-operator-guide
