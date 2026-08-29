# Submission — paste-ready field copy

Every field the DoraHacks form asks for, written out, so nothing gets
reconstructed from memory at midnight. **Verify the live-state numbers at the
bottom before pasting** — a few drift.

---

## ⛔ BLOCKER — the repository is still private

Checked `2026-08-26`: `api.github.com/repos/successaje/covenant` returns
**Not Found** to an unauthenticated request. Everything below that points at
GitHub currently 404s for a judge:

- the **deck PDF** in the submission form (verified: HTTP 404)
- **"Read the source"** on the landing page
- all four design-doc links on the **Developers** page
- the `AscVerify.sol` link — and the claim that it is *"published standalone,
  MIT, for the whole ecosystem"*, which is not true while nobody can read it
- every `docs/research/` link in the README and in the Posts pages

**It is safe to publish.** History was scanned before writing this:

| check | result |
|---|---|
| `.env` ever committed | never |
| private keys anywhere in history | none |
| `.env.example` contents | no real values |
| `.gitignore` covers `.env` / `.env.*` | yes |

Flip it to public in **Settings → General → Danger Zone → Change visibility**,
then re-run the deck check:

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  https://raw.githubusercontent.com/successaje/covenant/main/docs/DOKETT-DECK.pdf   # want 200
```

---

## Project name

```
Dokett
```

## One-liner / tagline

```
The obligation layer for the open economy.
```

## Vision (≤250 characters)

```
A registry where a promise to pay is a first-class on-chain object, and its status moves only on cryptographic proof — never on anyone's word. Turning leverage nobody could see into a record anyone can verify.
```

*209 characters.*

---

## Project description

```
Dokett is a registry where a promise to pay is a first-class on-chain object, and
its status only ever changes on proof — never on anyone's word.

THE PROBLEM. A lender about to extend credit asks the oldest question in finance:
what do you already owe? In traditional finance an apparatus exists to answer it —
bureaus, lien registries, auditors, courts. Move that borrower on-chain and they may
hold a loan on Ethereum, collateral on a second chain, a tokenized asset on a third,
and a facility with a protocol that has never spoken to any of the others. Each
system sees its own slice perfectly. None can see the others. The question gets
asked and there is nowhere to send it — and fragmentation compounds with adoption,
because every new chain and every newly tokenized asset adds another silo.

WHY PRIOR ATTEMPTS DIDN'T FIX IT. Credit scores are an opinion about a borrower.
Self-reporting is a claim by a borrower. Goldfinch did not fail at underwriting; it
failed at observability, because performance arrived as a PDF. Every prior attempt
was attacked with a better model. None was attacked with better evidence.

WHY CREDITCOIN. Three conditions had to hold at once. A chain whose subject is
already credit, because a registry belongs on the record rather than on a venue that
competes with its registrants. Attestcoin, which lets a Creditcoin contract
cryptographically verify a specific Ethereum event with no bridge, messaging layer,
or oracle operator. And verification cheap enough over deep history to be worth
doing continuously — we measured this rather than assuming it: proving a two-year-old
Ethereum fact costs 26% more than a twenty-minute-old one. Not per year; in total,
across 51,529x the age. Remove any one condition and this does not work.

THE INVERSION. Every other ASC project proves that something happened. Dokett's
SilenceAdapter acts on what didn't: an obligation degrades to delinquent, then
default, purely because no admissible proof of payment arrived before an attested
deadline. No reporter, no committee, no oracle operator. We demonstrated this live —
a registered obligation reached default in 2 minutes 18 seconds, unattended, with
every transition linked to a real transaction.

We do not claim to prove a negative. What is proven on-chain is narrower and
correct: no admissible proof of payment was presented before the deadline. That
stands in for non-payment economically because submission is permissionless and
costs a fraction of a cent, and it is reversible — a late proof of an in-window
payment still cures the obligation.

NOT AN APPLICATION. The Console is how a person reads the register. The product is
the record, and that anything can query it: a lender before underwriting, an RWA
platform checking whether collateral is already pledged, any protocol advancing an
obligation on a proven repayment. Every endpoint is live, free and unauthenticated,
and the read layer is a pure projection over chain events — so anyone can recompute
every figure from the chain itself. A registry that asks you to trust its own
reporting has already failed at the one job it exists to do.

STATUS. Contracts deployed and source-verified on CC3 testnet. Keeper running
unattended on Fly.io. Free read API live. Console live. A cure relay that pays gas
so a borrower needs no account, no wallet and no CTC to restore their own record.
66 contract tests and 7 projection tests passing. The register currently carries
obligations in every state of the lifecycle: Active, Current, Delinquent, Default
and Settled.

Testnet with synthetic data. No real borrower information appears anywhere.
```

---

## ASC Integration Summary

**This field is scored. It is dense on purpose — most submissions write two
sentences.**

```
Dokett uses Attestcoin Smart Contracts as its only source of truth about the
outside world. Every status transition in the registry is caused by an ASC proof or
by a comparison against an attested source-chain height. Nothing else can move a
status, including us.

WHAT WE CALL. The BlockProver precompile at
0x0000000000000000000000000000000000000FD2 for single and batch verification (batch
limit 10), and ChainInfo at 0x0000000000000000000000000000000000000fD3 to resolve
chainkeys at runtime rather than hardcoding them — chainkeys are not portable, and
on CC3 testnet Ethereum mainnet is chainKey 3 while on mainnet it is 1. We deploy
and link the EvmV1Decoder library from @gluwa/usc-contracts, which is a public
Solidity library and cannot be inlined.

REAL MAINNET EVIDENCE, FROM TESTNET. CC3 testnet attests Ethereum mainnet at
chainkey 3, so every proof in this build is against a real Ethereum transaction —
not a Sepolia transaction we sent ourselves minutes earlier.

THE FOOTGUN WE FIXED. BlockProver does not validate whether the proven transaction
succeeded. A reverted ERC-20 transfer is still a validly-included transaction, so an
integrator that reads logs without checking the receipt will happily accept a failed
payment as proof of payment. AscVerify.sol asserts receipt status == 0x1 before any
log is touched. It also replay-guards every proof on (chainKey, height, txIndex,
logIndex), enforces confirmation depth against the attested head rather than
assuming it, and resolves chainkeys from ChainInfo. It is published standalone under
MIT for any ASC integrator, because these are not Dokett-specific problems.

THE INVERSION. PaymentAdapter proves presence: a qualifying ERC-20 Transfer inside
the open window advances the obligation. SilenceAdapter inverts the primitive to
drive degradation — an obligation becomes delinquent, then defaults, when the
attested head passes a deadline with no admissible proof. This enables permissionless
default detection with no reporter, and to our knowledge is the only ASC integration
that acts on absence rather than presence. We are precise about the claim: this
proves no admissible proof was presented before the deadline, not that no payment
occurred. It is economically equivalent because submission is permissionless and
costs a fraction of a cent, and it is reversible by a late proof.

LIVENESS GATE. Penalties require an unbroken observation record — penaltiesEnabled
checks healthySince covers recoveryGrace (3600s) with no sample gap exceeding
maxSampleGap (900s). Without this, an attestation stall followed by a catch-up jump
would mass-default every obligation at once. A stalled oracle must never manufacture
defaults, and this is enforced in the contract rather than in the keeper.

HEIGHT, NOT TIME. No timestamp exists in anything an ASC proof binds, so every
deadline is denominated in attested source-chain block height. This also makes stall
protection structural: a frozen attested head expires nothing.

MEASURED, NOT QUOTED. We measured the cost curve on five real mainnet transactions
spanning 20 minutes to 2 years old. Proving a 2-year-old fact costs 26% more than a
20-minute-old one — 478,786 gas versus 380,674 — because the continuity proof
saturates at 232 roots past roughly a year rather than growing without bound. That
near-flat curve is what makes a permanent registry economic. Batching amortises it
further: 10 queries sharing one continuity proof cost 87,055 gas each, a 78.4%
saving over 403,774 for a single query. Our measured cost is ~7.4x the published
formula, and we decomposed why rather than shrugging at it — the per-root
coefficient actually agrees (440 gas measured vs 580 published); the entire gap is
fixed base cost, because the published figure is the bare precompile call while ours
is the full guarded path including decoder, receipt decoding, replay-guard SSTORE,
ChainInfo staticcall and event emit. The safety guards cost more than the proof.

A BUG A 1% ANOMALY CAUGHT. One measurement came in 3,608 gas under the model fitted
to the others. Chasing it revealed the transaction was type-0 legacy, encoding 128
bytes smaller — and that our test suite had never exercised a pre-EIP-1559
transaction. A registry that mishandled legacy transactions would wrongly default
exactly the borrowers who send them. There is now a real type-0 mainnet fixture and
a regression test.

Reproduce any of it: npm run prove:one <txHash>, npm run prove:batch 1,5,10.
Full methodology: docs/ASC-INTEGRATION.md.
```

---

## Team

```
Solo build. Contracts, keeper, indexer, relay and Console built end to end by one
engineer, with a working method the project itself demonstrates: read the shipped
ABIs and precompile behaviour rather than the prose docs, measure real costs on real
transactions instead of trusting a published formula, and when something renders
blank, trace it to actual chain state rather than caption around it. That is how a
1% gas anomaly surfaced an untested legacy-transaction path, and how an empty
Underwriters page turned out to be a collateral token that had no code deployed on
this chain at all.
```

---

## Links

```
Live Console      https://covenant-console.vercel.app
Read API          https://covenant-lens.fly.dev
Source            https://github.com/successaje/covenant
Deck (PDF)        https://raw.githubusercontent.com/successaje/covenant/main/docs/DOKETT-DECK.pdf
Developer docs    https://covenant-console.vercel.app/#/developers
Research          https://covenant-console.vercel.app/#/posts
Demo video        [fill in]
```

### Deployed contracts — Creditcoin CC3 testnet (chain 102031)

```
AscVerifier       0x02406b6d17E743deA7fBbfAE8A15c82e4481E168
Register          0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5
Bond              0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e
PaymentAdapter    0xA68f1CBff869a7f6c7A9BC9313E0B9E135A79a60
SilenceAdapter    0x8e827a12C78dED9459268eb05cce2C5d709FE6AF
```

All source-verified on Blockscout.

### Evidence a judge can check in 30 seconds

```
Autonomous default, three transactions, 2m18s, zero humans:
  0x7da80af3fcedc969167c1ad4cc818f513e30deef555581ad7a195f83e9eb9fc8   registered
  0x72127e0d2db87c381e266be69f6c9dac90585d04b471a0cd57c0425bf7202789   → Delinquent
  0x7ce07a2ec62b1b41bce4565784c51a97d57b6a1b7b5933a84724960759a61f7d   → Default

A real Ethereum transfer verified inside a Creditcoin contract:
  0x85234a5dc158c402adfd384be8800969d570357611a1b59f3326098affc18fc4

Collateral pledged twice — the query that exists nowhere else:
  curl https://covenant-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f
```

---

## Before you paste — re-verify these

Some of these drift. Check the morning you submit.

```bash
# every service healthy
curl -s https://covenant-lens.fly.dev/health
curl -s https://covenant-relay.fly.dev/health          # balance should be > 1 CTC

# a standing curable delinquency still exists (for the demo + judges to try)
curl -s https://covenant-lens.fly.dev/obligations | grep -c Delinquent

# the register still shows a spread of states
curl -s https://covenant-lens.fly.dev/obligations \
  | python3 -c "import json,sys,collections; print(collections.Counter(o['status'] for o in json.load(sys.stdin)['obligations']))"
```

**Known drift, and why none of it breaks anything.** Obligations whose windows
close during judging will move to Delinquent on their own — that is the protocol
working, and it adds delinquencies rather than removing them. Obligation #2 stays
Current well past the deadline; #3 and #5 are terminal Defaults; #9 and #10 stay
curable for roughly four more weeks. If a specific id in the demo script has moved,
use the live register rather than the script's id — the script names ids, but every
scene works with any obligation in the right state.

**Gas figures drift upward with the age of the transaction being proven**, because
the continuity proof walks further back. Quote the qualitative cost ("about a
hundredth of a cent") on camera and let the exact figure appear on screen. Both the
old and new numbers are correct; they answer different questions.
