# Dokett Research #001
### What does it actually cost to verify a foreign chain?

**19 Aug 2026 · every number below is a real transaction, linked, reproducible with `npm run prove:one <txHash>`**

---

## The question

Attestcoin Smart Contracts let a Creditcoin contract verify that a specific
Ethereum event happened, with no bridge and no oracle operator. Creditcoin's
own docs publish a cost formula for this: `CTC ≈ 2.3e-5 + 2.9e-7 × continuityHashes`.

We build a registry ([Dokett](https://github.com/successaje/covenant)) whose
entire economics depend on that curve staying flat as facts age — a registry
exists to answer questions about *old* obligations, so if verifying a two-year-old
fact cost meaningfully more than a twenty-minute-old one, the whole model would
be in question. So instead of taking the published formula on faith, we measured
it: five real Ethereum mainnet transactions, spanning twenty minutes to two years
old, proven live on CC3 testnet.

## What we measured

| Age | Continuity roots | Gas | CTC | Type |
|---|---|---|---|---|
| ~20 min | 9 | 380,674 | 0.000190337 | 2 (EIP-1559) |
| ~35 min | 6 | 375,746 | 0.000187873 | **0 (legacy)** |
| ~24 hours | 32 | 389,186 | 0.000194593 | 2 |
| ~1 year | 232 | 478,786 | 0.000239393 | 2 |
| ~2 years | 232 | 478,786 | 0.000239393 | 2 |

**The headline: 26% more cost for 51,529× the age.** And the last two rows are
identical down to the gas unit — past roughly a year, the continuity proof
saturates at 232 roots rather than growing without bound, because the walk
terminates at a checkpoint a bounded distance back instead of tracking to
genesis. Proving a two-year-old fact costs about **one twentieth of a US cent.**

## Where the published formula disagreed with us, and why

The formula predicts **2.56e-5 CTC** for 9 continuity roots. We measured
**1.90e-4** — about 7.4× higher. Rather than report the discrepancy and move on,
we decomposed it, because a research report that shrugs at its own anomaly isn't
one.

Fitting our own extremes (9 roots → 232 roots):

|  | Published | Measured |
|---|---|---|
| Marginal cost / continuity root | 580 gas | **440 gas** (cheaper) |
| Fixed base cost | 46,000 gas | **376,714 gas** (8.2× higher) |

The per-root coefficient actually agrees closely — our marginal cost is *lower*
than published. The entire gap sits in the fixed base, and that's the tell: the
published number is the cost of the **bare precompile verification call**. Ours
is the cost of the **entire guarded path** a real integration needs — an
external call into the 13KB `EvmV1Decoder` library, full receipt decoding, log
extraction, a replay-guard `SSTORE`, a `ChainInfo` staticcall for liveness, and
an event emit.

Put plainly: **the safety guards cost more than the proof itself.** That's not
a complaint about the chain — it's the honest price of not accepting a reverted
transaction as a payment, which is exactly the footgun we go looking for next.

## The bug a 1% anomaly caught

One of the five points — the type-0 (legacy) transaction — came in 3,608 gas
*under* the model fitted to the other four. Chasing that 1% found something
real: it encodes to 1,536 bytes against the EIP-1559 fixture's 1,664, and
3,608 gas over 128 bytes is 28.2 gas/byte — decoding cost, not noise. Extending
the model with a byte-size term brings every residual to ≤8 gas.

More importantly: chasing it revealed that **our own test suite had never
exercised a legacy transaction.** Every prior fixture was EIP-1559 type 2. A
registry that silently mishandled pre-1559 transactions — and Ethereum still
carries plenty of them — would wrongly default exactly the borrowers who send
them. There's now a real type-0 mainnet fixture and a regression test asserting
it decodes identically to type 2.

That gap was invisible from reading the code. It showed up as a gas number
that was slightly wrong.

## Source transactions

Every row above is reproducible against live CC3 testnet:

```
npm run prove:one 0x8090cdb362074647ca6c3d04326d166a93920e9ccf4afe54e5cbe1fe838a8aa9   # ~20 min
npm run prove:one 0x85234a5dc158c402adfd384be8800969d570357611a1b59f3326098affc18fc4   # ~35 min, legacy
npm run prove:one 0xb7cba530509e5bc7240033aa542e46d9af28c4a0d3c4575da24f575b07ae4f9f   # ~24h
npm run prove:one 0x6b1b58e0345cd5ddcdcea82044a123753c69268ed405f8d72c3805d52832eca1   # ~1yr
npm run prove:one 0xd789c95e6b19f705ea0486cc9b12f69ef8fadfaf766b2fa557e80ea6a37d92e4   # ~2yr
```

Batch amortisation, also measured, also on ten real mainnet transfers sharing
one continuity proof: **78.4% saving at 10 queries** (403,774 gas → 87,055 gas
per query). Full table and methodology: [`docs/ASC-INTEGRATION.md`](../ASC-INTEGRATION.md).

---

*Dokett is a registry where an obligation's status advances only on
cryptographic proof of a foreign-chain event, or a comparison against an
attested foreign-chain height — never on anyone's word. Built on Creditcoin
Attestcoin Smart Contracts. [Source](https://github.com/successaje/covenant).*
