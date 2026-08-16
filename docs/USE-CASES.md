# Covenant — End to End

**What the system does, who it is for, and what is actually load-bearing today.**

Companion to [ARCHITECTURE.md](./ARCHITECTURE.md) (how it is built) and
[THREAT-MODEL.md](./THREAT-MODEL.md) (how it fails). This document is the *why*.

To watch the lifecycle below without a chain, run `npm run demo` — the seeded
projection covers every state described here, including a defaulted obligation
with a slashed bond and an unbonded claim registered in bad faith.

---

## 1. The walkthrough

**Adaeze** imports electronics in Lagos. She needs **$5,000** for 90 days. She has
no bank credit file and no collateral worth pawning — which makes every
overcollateralised lending protocol on earth useless to her, because if she had
$7,500 of ETH to lock up she would not need the loan.

**Kredi** is a fintech lender that already serves her. **Chidi** is their loan
officer; he has known her business for two years and holds information no model
has. **Vault B** is a DeFi lender on Base that has never heard of Kredi.

### Step 1 — Registration: the claim becomes an object

Kredi disburses $5,000 in USDC on Ethereum and calls:

```solidity
register(ObligationInit{
  obligor:       keccak256(identityRef, salt),   // a commitment, never a name
  sourceToken:   USDC,
  sourcePayer:   0xAdaeze…,                      // her public payment address
  sourcePayee:   0xKredi…,
  principal:     5_000e6,
  periodAmount:  1_700e6,
  periodsTotal:  3,
  startHeight:   <ethereum height>,              // the clock is block height
  periodBlocks:  216_000,                        // ~30d at 12s
  cureBlocks:    50_400                          // ~7d
}, /* expectedChainId */ 1) payable            // 1 CTC bond + 0.5 CTC keeper fund
```

Obligation **#412** exists, status `Active`. The chain never learns who Adaeze
is. The registrar bond is what gives the claim weight — registration itself is
permissionless, because a registry that gatekeeps registration is a private
database.

### Step 2 — Underwriting: reputation becomes a price

Chidi stakes **$500 of first-loss capital against Adaeze specifically**:

```solidity
bond.post(412, USDC, 500e6, /* spreadBps */ 340);
bond.fundPremium(bondId, premium);   // Kredi buys the protection
```

Not a pool. Not a rating. A named bet, by the person who actually holds the
information — and one that costs him real money if he is wrong.

This is the mechanism that makes unsecured credit possible **without solving
identity**: global capital never had to acquire local knowledge, it only had to
price a bonded promise. Adaeze's cost of credit becomes the observable market
price of underwriting her, which is strictly better information than any score.

### Step 3 — The query that does not exist anywhere else

Vault B, considering a second loan to the same borrower, asks **before** lending:

```
GET /solvency/0xAdaeze…
→ bonded:   { count: 1, outstanding: "5000000000" }
  unbonded: { count: 0, outstanding: "0" }
  adverse:  { count: 0 }
```

Two lenders who have never spoken now share a fact. Vault B prices for it or
declines.

This is the moment the registry becomes load-bearing, and it is the query that
was missing in every credit blowup of the last cycle. Note there is no combined
total: bonded and unbonded claims are never summed, because registration is
permissionless and a single figure would make defamation-by-registration free.

### Step 4 — Repayment: proven, not reported

Adaeze pays period 1 in USDC on Ethereum. A keeper — Kredi's, hers, or a
stranger farming bounties — observes the `Transfer`, waits 64 confirmations,
waits for the block to be attested on Creditcoin, pulls a proof from a builder,
and submits:

```solidity
payment.provePayment(412, proof);
```

`AscVerify` checks confirmation depth, verifies the proof at the precompile,
asserts `receiptStatus == 1`, guards replay, and matches the decoded log against
the obligation's own binding. Verified in one block for about **$0.000024**.
Status → `Current`.

Nobody reported anything. No PDF, no committee, no oracle operator.

### Step 5 — Silence: the inversion

Period 2 passes. No proof arrives. Once the **attested Ethereum head** crosses
`windowEnd + minConfirmations`, any keeper may call:

```solidity
silence.markDelinquent(412);   // bounty paid from the obligation's own escrow
```

Status → `Delinquent`, cure window open for 50,400 blocks.

Every other credit protocol needs someone to report a missed payment, and every
one of them has been lied to. Here **nobody has to volunteer bad news, and
nobody can suppress it.**

What this does *not* claim: that no payment occurred. You cannot prove a negative
with an inclusion proof. It proves an on-chain fact — that no admissible proof
was presented before the deadline — which is equivalent in practice because
submission is permissionless, costs a fraction of a cent, and the borrower is
the party most motivated to submit.

### Step 6a — The cure: no false positive is final

Adaeze *had* paid; her rail was slow and nobody submitted. She submits the proof
herself. Its **proven height** falls inside the missed window, so it is
admissible however late it arrives:

```solidity
payment.provePayment(412, lateProof);   // → Current, recorded as cured-late
```

This is the property that makes it safe to hand `markDelinquent` to strangers:
the worst a wrong mark can do is embarrass the marker.

### Step 6b — Or the default

No proof by cure expiry:

```solidity
silence.finalizeDefault(412);
// → status Default
// → bond.slash(412, outstanding, creditorPayout)  — same transaction
```

Chidi's $500 moves to Kredi atomically. His loss rate updates in the Lens,
derived from bond events — there is no stored score for anyone to lobby him into
adjusting. Adaeze's record shows a default reached by evidence, and the next
lender can see it.

### Step 7 — The compounding

Six months later Adaeze applies to Vault B directly. Her record shows 11 of 12
periods proven on-chain. She needs no permission from Kredi and no bureau's API.

**That portability is the asset she could never take with her before.** It is
also the original 2017 Creditcoin promise, finally given a mechanism rather than
a mission statement.

---

## 2. Who this is for

| Actor | What they get | Why they would bother |
|---|---|---|
| **Emerging-market lenders** (Aella-type) | A loan book that is independently verifiable | Cheaper capital — performance can be *proven*, not asserted |
| **DeFi venues, RWA vaults** | Pre-lend solvency and encumbrance checks | They are one double-pledge away from a nine-figure loss today |
| **Underwriters** | A new asset class: named credit risk, priced and slashable | Paid for local knowledge they currently give away free |
| **Borrowers** | An owned, portable record, and enforceable cure rights | The only asset the underbanked build and cannot currently keep |
| **Keepers** | Bounties for proving payments and sweeping deadlines | Permissionless; creditors and underwriters run their own |
| **Risk desks, auditors, exchanges** | Cross-venue concentration and correlation | The query that would have flagged 3AC |
| **Regulators, CBDC programmes** | Auditable obligations with no PII on chain | Precisely the eNaira credit-profile brief Gluwa signed with the CBN |

The first three are the ones that make the flywheel turn. Everything else is
downstream of coverage.

---

## 3. What is load-bearing today

Stated plainly, because a reader evaluating this deserves to know where the
edges are.

**Real and tested**
- The full obligation lifecycle: register → prove → degrade → cure → default → settle
- `Bond`: pro-rata slashing, premium escrow, INV-1 fuzzed at 1025 runs
- Deploy → bootstrap → wiring, rehearsed on anvil with every link verified on-chain
- Keeper (poke / prove / sweep on independent timers), Lens, Console, landing
- 66 contract tests, 7 lens projection tests
- Fixtures are **real Ethereum mainnet transactions**, encoded with the real SDK

**Mocked**
- The ASC precompiles. Every test installs fakes at `0x0FD2` / `0x0FD3`.
  The logic is proven; our *reading* of the precompiles is not, until
  `npm run prove:one` runs against live CC3 testnet. That is the single
  outstanding gate, and it is deliberately isolated so a failure there points at
  the evidence layer rather than at the business logic.

**Does not exist**
- Real users, real capital, a live deployment
- Legal enforceability — registration is not lien perfection in any jurisdiction
- ZK privacy — payment addresses and amounts are public by construction
- Any source chain but Ethereum mainnet

---

## 4. The potential

**The wedge is deliberately small and boring.** Not "credit bureau" — nobody
buys a bureau at 0% coverage. The opening product is one free query: *is this
collateral already pledged?* Creditors register to protect their own claim
priority, not to be helpful, and coverage that arrives through self-interest is
the only kind a registry has ever accumulated.

**The endgame is that no meaningful credit decision happens without querying the
Register.** Credit bureaux are among the most durable businesses in finance —
Experian, Moody's, the DTCC — precisely because coverage compounds into a
monopoly that cannot be forked. Copy these contracts and you get an empty
registry with no history, no bonded underwriters and no reason for a lender to
read it. You cannot fork elapsed time.

**Why it might work now, when it did not before.** The thing blocking
undercollateralised lending was never modelling — it was evidence. Goldfinch did
not misjudge its borrowers; it could not *see* them, because performance arrived
as self-reported PDFs. Two things changed: repayments moved on-chain, so a
repayment is now an event rather than a report; and ASC made foreign-chain
evidence cost about $0.000024, so a contract can continuously *check* loan
performance instead of being told about it.

Roughly $14B of tokenized private credit and $20B of tokenized real-world assets
are sitting on top of no registry at all.

> ⚠️ Both figures are third-party, dated May 2026, and unverified. They should be
> re-sourced or softened before appearing in any judged or investor-facing
> material — a page whose entire credibility rests on precision cannot afford a
> stale headline number.

---

## 5. Why Creditcoin specifically

1. **Neutrality is the product.** A registry that competes with its registrants
   is dead on arrival. Base is Coinbase; Plume and Ondo are venues for tokenized
   assets. Creditcoin is the only credible chain that wants to be the *record*
   rather than the market.
2. **The cost curve.** Continuously verifying thousands of obligations against
   deep history is only economic where proof verification is a native precompile
   costing microcents. On Ethereum it is a gas-cost non-starter; on a ZK
   coprocessor it is a per-proof bill and minutes of latency.
3. **Permanence.** A credit record that can be reset is not a credit record.
4. **Cold start.** Credal's existing loan-level history and the Gluwa–CBN eNaira
   relationship are origination reality no competitor can replicate by shipping
   faster.
