# Submission — paste-ready field copy

Every field the DoraHacks form asks for, written out, so nothing gets
reconstructed from memory at midnight. **Verify the live-state numbers at the
bottom before pasting** — a few drift.

---

## ✅ Publication checks — cleared

Re-verified `2026-09-03`. The blocker this section used to carry (private
repository, 404ing deck and source links) is resolved.

| check | result |
|---|---|
| `api.github.com/repos/successaje/Dokett` | **200** — public |
| `docs/DOKETT-DECK.pdf` raw URL | **200** |
| `.env` ever committed | never |
| private keys anywhere in history | none |
| `.gitignore` covers `.env` / `.env.*` | yes |

Re-run before pasting anything, since both depend on repository visibility:

```bash
curl -s -o /dev/null -w "repo  %{http_code}\n" https://api.github.com/repos/successaje/Dokett
curl -s -o /dev/null -w "deck  %{http_code}\n" https://raw.githubusercontent.com/successaje/Dokett/main/docs/DOKETT-DECK.pdf
```

---

---

## DoraHacks form — exact fields, in order

Answers for the live form. **Verified `2026-09-03`** — every URL below returned
200 and every image returned a correct `content-type`.

### Project Logo (Image URL)

```
https://raw.githubusercontent.com/successaje/Dokett/main/brand/dokett-mark.png
```

512x512 PNG, `content-type: image/png`. Use `dokett-avatar.png` instead if the
form wants something larger — it is the same mark at 1024x1024. An SVG is at
`brand/dokett-mark.svg` if vector is preferred, but PNG is the safer bet for a
form that may not sanitise and render SVG.

### Project Sector

```
RWA
```

One word, matching the track. If the field takes more than one:

```
RWA · Infrastructure · DeFi (Credit)
```

Do **not** add Oracle. The submission's strongest claim is "no reporter, no
committee, no oracle operator", and the sector field is read before the
description.

### Project Description

Paste the block under **Project description** above, verbatim. 5,290 characters.
If the field caps shorter, drop whole paragraphs in this order: WHY PRIOR
ATTEMPTS DIDN'T FIX IT, then CONTRIBUTED BACK, then NOT AN APPLICATION.

### USC Integration Summary

**Paste the USC-worded block below, not the ASC one.** The form says USC, so the
copy should too — same content, ecosystem's own vocabulary.

```
Dokett uses Universal Smart Contracts (USC / Attestcoin) as its only source of truth about the
outside world. Every status transition in the registry is caused by a USC proof or
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
MIT for any USC integrator, because these are not Dokett-specific problems.

THE INVERSION. PaymentAdapter proves presence: a qualifying ERC-20 Transfer inside
the open window advances the obligation. SilenceAdapter inverts the primitive to
drive degradation — an obligation becomes delinquent, then defaults, when the
attested head passes a deadline with no admissible proof. This enables permissionless
default detection with no reporter. Acting on absence rather than presence is the
unusual part; what a protocol then DOES with that absence is the design question.
Ours degrades the obligation to delinquent and then default, slashes named
first-loss capital to the creditor in the same transaction, and keeps a cure path
open so a late proof reverses it. We are precise about the claim: this
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

### GitHub Repository URL

```
https://github.com/successaje/Dokett
```

Public, README at root returns 200.

### Project Deck or Whitepaper (PDF URL)

```
https://raw.githubusercontent.com/successaje/Dokett/main/docs/DOKETT-DECK.pdf
```

Direct link to the PDF bytes, which is what a "PDF URL" field wants. The
`github.com/.../blob/...` form renders GitHub's viewer instead and is worse here.

### Prototype Demo Video URL

**Not recorded yet.** This is the only field with no answer, and it is the field
most likely to decide the outcome. Scripts are ready: `docs/VOICEOVER.md` (2:54,
6s headroom) and `docs/CAPTURE-GUIDE.md`.

Do not submit this field empty or with a placeholder link.

---

## Project name

```
Dokett
```

## One-liner / tagline

```
The obligation layer for the open economy.
```

## Vision — the problem it solves (≤256 characters)

```
Before lending, every lender asks: what do you already owe? On-chain there is nowhere to send that question — debt hides across chains. Dokett answers it: a registry where an obligation's status moves only on cryptographic proof, never on anyone's word.
```

*253 characters.* Counted, not estimated.

The field asks for the **problem**, so this leads with someone unable to do
something rather than with what Dokett is. The previous version opened *"A
registry where a promise to pay is a first-class on-chain object…"* — an
accurate description of the product, and an answer to a question the form did
not ask.

"Nowhere to send that question" is doing deliberate work: it separates Dokett
from the dozen-odd credit-score submissions without naming them, since a score
is an answer nobody can check rather than an answer that exists.

**Shorter alternative** if the form counts characters differently and 253 is
uncomfortably close to the ceiling (223 chars):

```
A borrower can owe money on five chains and no lender can see any of it. Dokett turns leverage nobody could see into a record anyone can verify: obligations whose status moves only on cryptographic proof, never on a report.
```

---

## Project description

**Verified `2026-09-03` against the live deployment and a full test run.** Every
figure below was measured, not recalled.

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

THE INVERSION. Most cross-chain verification proves that something happened.
Dokett's SilenceAdapter acts on what didn't: an obligation degrades to delinquent,
then default, purely because no admissible proof of payment arrived before an
attested deadline. No reporter, no committee, no oracle operator. We demonstrated
this live — a registered obligation reached default in 2 minutes 18 seconds,
unattended, and first-loss capital was slashed to the creditor in the same
transaction that recorded the default.

We do not claim to prove a negative. What is proven on-chain is narrower and
correct: no admissible proof of payment was presented before the deadline. That
stands in for non-payment economically because submission is permissionless and
costs a fraction of a cent, and it is reversible — a late proof of an in-window
payment still cures the obligation.

THE QUESTION NOTHING ELSE ANSWERS. A borrower pledges a warehouse receipt. Is it
already pledged? On the live register that asset carries three claims across two
lenders, neither of whom could see the other's book. No credit score can produce
that answer, because it isn't a fact about the borrower — it's a fact about the
asset, held by strangers.

WHAT IT LOOKS LIKE WHEN SOMETHING READS IT. A record nobody acts on is just data,
so we built the thing that acts on it. DemoBank is a separate application on a
separate domain that underwrites a loan application by querying Dokett over public
HTTP — no account, no API key, no permission, one static file with no build step and
no SDK. It issues seven queries, assembles what the borrower owes and whether their
collateral is already encumbered, and declines the application on six of its own
seven policy checks. Crucially, Dokett returns no score and no recommendation: the
verdict is DemoBank's, computed from DemoBank's policy, and a lender with more
appetite would set it differently and approve. The moment a registry ships a verdict
it has become a credit score with extra steps.

NOT AN APPLICATION. The Console is how a person reads the register. The product is
the record, and that anything can query it. Every endpoint is free, live and
unauthenticated, and the read layer is a pure projection over chain events — so
anyone can recompute every figure from the chain itself. A registry that asks you to
trust its own reporting has already failed at the one job it exists to do.

CONTRIBUTED BACK. AscVerify.sol is published standalone under MIT because the
problems it solves are not ours alone. BlockProver does not check whether the proven
transaction succeeded, so an integrator reading logs without checking the receipt
will accept a failed payment as proof of payment. Our library asserts receipt status
first, replay-guards every proof on (chainKey, height, txIndex, logIndex), and
resolves chainkeys at runtime rather than hardcoding them.

STATUS, MEASURED TODAY. Contracts deployed and source-verified on CC3 testnet.
Keeper running unattended on Fly.io. Free read API live. Console live. A cure relay
that pays gas so a borrower needs no account, no wallet and no CTC to restore their
own record. 90 tests passing: 67 contract, 7 projection, 16 relay. The register
carries 13 obligations across 10 distinct borrowers and every state of the
lifecycle — Active, Current, Delinquent, Default and Settled — with 12 of 13 backed
by a registrar bond.

Testnet with synthetic data. No real borrower information appears anywhere, and
obligors are stored as commitments, never as identities.
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
default detection with no reporter. Acting on absence rather than presence is the
unusual part; what a protocol then DOES with that absence is the design question.
Ours degrades the obligation to delinquent and then default, slashes named
first-loss capital to the creditor in the same transaction, and keeps a cure path
open so a late proof reverses it. We are precise about the claim: this
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

> **Fill in your teammate's name and channels before pasting.** The `[NAME]`
> placeholders below are the only unverified thing in this file.

```
Two people.

Engineering — Success Aje. Contracts, keeper, indexer, cure relay and Console,
end to end. The working method is one the project itself demonstrates: read the
shipped ABIs and precompile behaviour rather than the prose docs, measure real
costs on real transactions instead of trusting a published formula, and when
something renders blank, trace it to actual chain state rather than caption
around it. That is how a 1% gas anomaly surfaced an untested legacy-transaction
path, and how an empty Underwriters page turned out to be a collateral token
with no code deployed on this chain at all.

Growth and communications — [NAME]. Owns how the work reaches people who did not
build it: positioning, the written argument, and the case that a registry is
worth registering on. That is not decoration on an infrastructure project, it is
the hard half. A registry's value is its coverage, and coverage is a
distribution problem, not an engineering one — every prior attempt at on-chain
credit shipped working contracts and still died for want of anyone using them.
```

**Why this framing.** The instinct on a technical submission is to list the
engineer and mention marketing at the end. That gets it backwards for *this*
project specifically: the read API is free and unauthenticated precisely because
coverage beats revenue, which is a go-to-market position expressed in code.
Saying so makes the team composition look deliberate rather than incidental.

---

## Team information — paste-ready variants

> **Everything in `[BRACKETS]` is a placeholder.** Nothing about the second
> person is written here, because inventing a background for a real teammate is
> the one failure this project cannot survive: the whole argument is that claims
> should be checkable, and a judge who checks is exactly the reader you want.

### Team name

`Dokett` — same as the project. On a two-person entry a separate studio name
invents an entity that does not exist and reads as padding. Prefer it unless
[NAME] already ships under a shared banner.

### One-line team descriptor (~90 chars)

```
Two people building the obligation layer for the open economy — one on protocol, one on reach.
```

### Short team bio (~55 words)

```
Two people. Success Aje builds the protocol — contracts, keeper, indexer, cure
relay and Console, end to end. [NAME] owns growth and communications: positioning,
the written argument, and the case for registering on a registry. Coverage is what
makes a registry worth anything, and coverage is a distribution problem.
```

### Long team bio (~150 words)

```
Two people, split along the line that actually decides whether an obligation
registry works.

Success Aje builds the protocol: Solidity contracts, the unattended keeper, the
projection indexer, the cure relay and the Console. The method shows up in the
artifacts — read the shipped ABIs and precompile behaviour rather than the prose
docs, measure real gas on real mainnet transactions instead of trusting a published
formula, and when a page renders blank, trace it to chain state rather than caption
around it. A 1% gas anomaly turned out to be an untested legacy-transaction path.
An empty Underwriters page turned out to be an allowlisted collateral token with no
code deployed on this chain at all.

[NAME] owns growth and communications. Every prior attempt at on-chain credit
shipped working contracts and died for want of anyone using them. A registry is
worth exactly its coverage, and coverage is won by argument, not by throughput.
```

### Member entries

```
Success Aje — Protocol engineering
Contracts, keeper, indexer, cure relay, Console. github.com/successaje ·
medium.com/@finishr

[NAME] — Growth and communications
[ROLE DETAIL: what they own — positioning, partnerships, content, community]
[LINKS: X / LinkedIn / site]
```

### What to fill in

| placeholder | what it needs |
|---|---|
| `[NAME]` | your teammate's name as they want it published |
| `[ROLE DETAIL]` | one clause on what they actually own |
| `[LINKS]` | their handle — on a growth role, the account *is* the credential |

Add them as a member on the BUIDL page too. The page shows a member count
publicly, and a Team field describing two people beside `Members 1` is a visible
inconsistency in a submission arguing that claims should be checkable.

---

## Links

```
Live Console      https://dokett-console.vercel.app
Read API          https://dokett-lens.fly.dev
Source            https://github.com/successaje/Dokett
Deck (PDF)        https://raw.githubusercontent.com/successaje/Dokett/main/docs/DOKETT-DECK.pdf
Developer docs    https://dokett-console.vercel.app/#/developers
Research          https://dokett-console.vercel.app/#/posts
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
  curl https://dokett-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f
```

---

## Before you paste — re-verify these

Some of these drift. Check the morning you submit.

```bash
# every service healthy
curl -s https://dokett-lens.fly.dev/health
curl -s https://dokett-relay.fly.dev/health          # balance should be > 1 CTC

# a standing curable delinquency still exists (for the demo + judges to try)
curl -s https://dokett-lens.fly.dev/obligations | grep -c Delinquent

# the register still shows a spread of states
curl -s https://dokett-lens.fly.dev/obligations \
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
