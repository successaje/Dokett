# Covenant — Deck Outline

**Format** 12 slides + 3 appendix · PDF for submission, same deck drives the demo video
**Audience** Credit Labs (investors) + Creditcoin engineers (technical judges)
**Rule** One idea per slide. The deck's job is to make the demo inevitable, not to explain the system.

---

## Slide 1 — Title

> # COVENANT
> ### The obligation layer for the open economy
> *BUIDL CTC 2026 Fall · RWA track · built on Attestcoin Smart Contracts*

Logo, name, one line, testnet link, GitHub. Nothing else.

**Say:** "I'm going to show you a smart contract that puts someone into default because *nothing happened*."

---

## Slide 2 — The gap

> **$14B of on-chain private credit.**
> **$20B of tokenized real-world assets.**
> **Zero credit bureaus. Zero lien registries. Zero bankruptcy courts.**

**Say:** Every promise to pay in crypto is invisible to everyone except the counterparty holding it — and it stays invisible until it breaks. Three Arrows, Celsius, Alameda: all the same failure. Not fraud we couldn't punish. Leverage we couldn't *see*.

*Visual: two lending venues side by side, one borrower in the middle, a dotted line between the venues that doesn't exist.*

---

## Slide 3 — Why every previous attempt failed

| | Why it died |
|---|---|
| Credit scores (Spectral, Cred, ARCx, RociFi) | A number with no recourse and no sybil cost. Nobody lends against an opinion. |
| Aave credit delegation | The delegator got no upside and no enforcement. Delegation without payment is charity. |
| Goldfinch | **Not an underwriting failure — an observability failure.** Borrowers reported performance in PDFs. |
| Maple v1 | Pool delegates with no cross-venue visibility → correlated blowups. |

**Say:** Every one of these was solved by better *models*. None of them was solved by better *evidence*. That's the gap.

---

## Slide 4 — What changed

> **Repayments moved on-chain.** Stablecoin settlement means repayment is now an *event*, not a report.
> **ASC shipped to Creditcoin mainnet, June 2026.** A contract here can verify an Ethereum event cryptographically, in one block, for **$0.000024**.

**Say:** For the first time, the underlying performance of a loan is a thing a contract can *check* instead of a thing a human tells you. That is the missing input, and it landed six weeks ago.

---

## Slide 5 — The primitive

> **The Liability Object.** A promise to pay, as a first-class on-chain object.
> Obligor (commitment, never PII) · principal · schedule · seniority · collateral ref · **status machine**
> `Active → Current → Delinquent → Default → Settled`
> **Status advances only on ASC-verified evidence. Never on anyone's word.**

*Visual: the struct, then the state machine, with every arrow labelled by what proves it.*

---

## Slide 6 — The inversion ← **the slide that wins**

> Every ASC demo proves that **something happened.**
> Covenant proves that **nothing did.**

> `SilenceAdapter`: an obligation degrades unless proof of payment arrives.
> No reporter. No committee. No oracle operator. **Default is the default.**

**Say, precisely — do not overclaim:** "We don't claim to prove a negative on Ethereum; you can't do that with an inclusion proof. We prove an on-chain fact about Creditcoin: *no admissible proof of payment was presented before the window closed*. Submission is permissionless, it costs two thousandths of a cent, and the borrower is the person most motivated to submit it. And if we're ever wrong, the proof still cures it during the cure window. Nobody has to volunteer bad news, and nobody can suppress it."

That paragraph is the technical high point of your pitch. Rehearse it until it's exact.

---

## Slide 7 — The market on top

> **Bonded underwriters.** Stake first-loss capital against a **named** borrower. Not a pool. Not a score.
> Earn the spread when they pay. **Slashed by proof** when they don't.

**Say:** This puts the credit decision where the information actually is — the loan officer in Lagos, the employer, the co-op, the merchant acquirer. Global capital never had to acquire local knowledge. It just has to price a bonded promise. And the borrower's cost of credit becomes a *live market price* instead of a model's opinion.

---

## Slide 8 — Demo

Live or recorded. Seven beats, no narration over the mechanics — let the state transitions speak.

1. Venue A registers a $5,000 obligation
2. **Venue B queries solvency before lending and sees it** — *"this query does not exist anywhere in crypto today"*
3. Underwriter posts $500 named first-loss at 340bps
4. Period 1 repaid on **Ethereum mainnet** → ASC verifies → `Current`
5. Period 2: silence. Window closes. Keeper marks delinquent, earns the bounty
6. Cure expires → **bond slashed to Venue A in the same block**
7. Deep-history flex: verify a **2-year-old Ethereum mainnet transaction**, show the cost

---

## Slide 9 — ASC depth (the scored slide)

> **Real Ethereum mainnet evidence, from testnet.** CC3 testnet attests mainnet at chainkey 3 — this demo reads reality, not a Sepolia transaction we sent ourselves five minutes ago.
> **Absence as a primitive.** `SilenceAdapter` uses the oracle to detect what *didn't* happen.
> **Deep history at fractions of a cent.** `2.3e-5 + 2.9e-7 × continuityHashes` CTC — the cost curve that makes a permanent registry economic.
> **We fixed the footgun.** `BlockProver` does not validate transaction success. `AscVerify.sol` asserts `status == 0x1` and replay-guards every proof — **published standalone, MIT, for the whole ecosystem.**
> **Liveness circuit breaker.** If attestation stalls, degradation pauses. A stalled oracle must never manufacture defaults.

**Say:** Four of these five are things you can only do if you read the docs adversarially. The fifth is a bug half this hackathon is going to ship.

---

## Slide 10 — Why Creditcoin, and why nobody can copy it

> **Neutrality is the product.** A registry that competes with its registrants is dead on arrival. Base is Coinbase. Plume and Ondo are venues. Creditcoin is the only credible chain that wants to be the *record*, not the market.
> **The cost curve.** Continuously verifying thousands of obligations against deep history is only economic where proof verification is a native Rust precompile.
> **Permanence.** A credit record that can be reset is not a credit record. This chain has been recording loans since 2017.
> **Cold start already solved.** Credal: 5M+ loans, 337k borrowers, $100M+ originated. Plus Gluwa's Central Bank of Nigeria eNaira partner-agent status.

**Say:** Fork the contracts and you get an empty registry. You can't fork elapsed time, and you can't fork a central bank relationship.

---

## Slide 11 — What this does for the ecosystem

> Every other submission **consumes** Creditcoin blockspace.
> Covenant makes every future credit app in this ecosystem an **integrator**.
> It reunites what Creditcoin is currently *selling* (ASC) with what it's currently *hiding* (Credal, the origination, the regulator relationship).

*This is the CEIP slide. It is the sentence that gets you to Seoul.*

---

## Slide 12 — Roadmap and the ask

| | |
|---|---|
| 0–3 mo | Mainnet v0 · import Credal history as commitment-form LOs → coverage on day one |
| 3–6 mo | Free encumbrance API · 3 venues querying · `AscVerify` adopted as ecosystem standard |
| 6–12 mo | Real underwriting capital in the Nigeria corridor · first proven mainnet default |
| 12–24 mo | ERC standard for Liability Objects · Registrar Council · attested mirrors on Ethereum/Base |

> **Ask:** CEIP fast-track. 12 months of two engineers to ship the Register to mainnet and land the first three registrars.

---

## Appendix A — Architecture diagram
Full stack from ARCHITECTURE.md §2. For the questions, not the pitch.

## Appendix B — Threat model summary
The seven threats that matter, the trust statement verbatim, and the ten invariants. **Volunteering your weakest assumption before a judge finds it is the strongest credibility move available.**

## Appendix C — Honest limitations
ASC attestors are permissioned today (`AuthorizedOnly`, 0 CTC min bond, no documented slashing) · v1 privacy is commitments, not ZK — payment addresses and amounts are public · one source chain · registration spam is priced, not adjudicated · on-chain registration is not legal lien perfection.

---

# Delivery notes

**Demo video (≤3 min).** 20s problem → 25s the inversion → 90s demo → 20s why-Creditcoin → 15s ask. Record the demo as a *replay of pre-seeded state*, not a live gamble. Shoot a backup take. Subtitle it — a chunk of the judging happens in Seoul, in a second language, possibly on a phone.

**ASC Integration Summary field.** Paste the paragraph from the earlier draft verbatim. It is scored, most teams will write two sentences, and yours names the precompile, the failure mode, the batch limit, and the chainkey.

**Slides 6 and 9 carry the submission.** If you have one hour left before the deadline, spend it on those two.

**Tone.** No moonshot language, no "revolutionary," no roadmap past 24 months on the main deck. You are pitching a registry — the pitch should sound like infrastructure: specific, boring in the right places, and unarguable about the mechanism.
