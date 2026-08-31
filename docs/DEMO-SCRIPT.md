# Dokett — demo video script

**Target 2:50, hard ceiling 3:00.** Every figure and transaction below is real and
live as of writing; nothing in this script requires a staged or mocked moment.

**The one rule.** Record each scene as a *replay of state that already exists*, not
as a live gamble against a testnet. The only genuinely live command is Scene 3's
`prove:one`, which is deliberately chosen because it takes seconds and is
re-runnable if a take fails. Everything else is already on-chain and cannot break
mid-recording.

---

## Before you record

| | |
|---|---|
| Browser | Clean profile, no extensions, no bookmarks bar. Zoom 110% — judges may watch on a phone. |
| Console theme | **Light.** Higher contrast when compressed by YouTube/DoraHacks. |
| Onboarding panel | Dismiss it before recording, then don't clear localStorage. |
| Terminal | Large font (~18pt), light background to match the Console, `clear` between takes. |
| Tabs to pre-open | `#/`, `#/obligation/2`, `#/obligation/5`, `#/encumbrance`, `#/developers` |
| Audio | Record narration separately from screen capture if you can. Easier to fix one bad sentence. |
| Subtitles | **Burn them in.** A meaningful share of judging happens in a second language. |

Verify these are still live the morning you record:

```bash
curl -s https://dokett-lens.fly.dev/obligation/2 | grep periodsSatisfied   # → 1
curl -s https://dokett-lens.fly.dev/obligation/5 | grep '"status"'         # → Default
curl -s https://dokett-lens.fly.dev/underwriter/0x60eF148485C2a5119fa52CA13c52E9fd98F28e87 | grep bondsWritten  # → 2
curl -s https://dokett-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f | grep -c '"id"'  # → 2
curl -s https://dokett-relay.fly.dev/health                                # → ok:true, balance > 1 CTC
curl -s https://dokett-lens.fly.dev/obligation/10 | grep '"status"'        # → Delinquent (only if filming Cut B)
```

**And do one throwaway `prove:one` run before recording.** It is the only live
command in the video and the only step that depends on the keeper's balance, the
proof-builder API, and the attestation head all being healthy at once. Confirm it
succeeds, note the gas figure it returns *today*, then run it again on camera.

```bash
npm run prove:fresh
```

> ⚠️ **Never reuse a transaction hash from these docs.** Every proof is
> replay-guarded on `(chainKey, height, txIndex, logIndex)` and can be consumed
> exactly once — correct behaviour, since otherwise one real payment could
> satisfy unlimited obligations. A hash written down anywhere is therefore
> already spent, and reusing it reverts with an opaque custom error. Run
> `npm run prove:fresh`, which finds an unproven transaction and proves that.

If the proof-builder API is down, Scene 3 falls back to `#/obligation/2` alone —
the proven payment is already on-chain and needs nothing live. Say "this
obligation advanced because a payment was proven at height 25,773,802" and carry
on. Don't let a flaky third-party API stall the take.

---

## Scene 1 — The question · 0:00–0:22

**Screen.** Nothing yet, or the Dokett cover page held still.

> A business wants to borrow a million dollars. Before approving it, the lender
> asks the oldest question in finance: **what do you already owe?**
>
> In traditional finance, an entire apparatus exists to answer that. Credit
> bureaus. Lien registries. Auditors. Courts.
>
> Now move that borrower on-chain. A loan on Ethereum. Collateral locked on a
> second chain. A tokenized asset on a third. Every one of those systems sees its
> own slice perfectly — and none of them can see the others.

**Beat. Then:**

> So the oldest question in finance gets asked, and there is nowhere to send it.

*Do not put a statistic on screen here. The scene is the argument.*

---

## Scene 2 — Why this chain · 0:22–0:45

**Screen.** Scroll the landing page slowly through "Why this could not have been
built anywhere else." Let the three numbered conditions land.

> Two things changed recently enough that this wasn't buildable before.
>
> Loans started settling in stablecoins — so a repayment stopped being something
> a borrower *reports*, and became something that provably *happened*, at a
> specific block height.
>
> And with Attestcoin, a Creditcoin contract can now verify that Ethereum event
> **itself** — no bridge, no messaging layer, no oracle operator.

**Land the thesis line cleanly. This is the sentence judges should remember:**

> Creditcoin knows how to record credit. Attestcoin lets it see across chains.
> **Dokett turns what it can see into a shared, verifiable record of obligations.**

---

## Scene 3 — Evidence, live · 0:45–1:18

**Screen.** Terminal, then the Console.

This is the only live command in the video. Run it for real:

```bash
npm run prove:fresh
```

> This is a real transaction on Ethereum mainnet. I'm asking a contract on
> Creditcoin to prove it happened.

**Let the output appear. Point at the cost — and read the gas figure off the
screen rather than from this script. See the note below.**

> Verified. About one hundredth of a US cent. No bridge involved, no
> Ethereum-side contract, nobody's API being trusted.

> ⚠️ **Do not hardcode the gas number into your narration.** It legitimately
> drifts upward as the proven transaction ages, because the continuity proof
> walks further back. The same transaction measured 375,746 gas at ~35 minutes
> old and **441,770 gas / 0.000220885 CTC at five days old** — 6 continuity roots
> versus 96. Both are correct; they are different questions.
>
> Say the qualitative cost ("about a hundredth of a cent") and let the exact
> figure appear on screen. Expect **380k–480k gas** depending on the day.
>
> If you want the cheapest, most impressive number, prove a *recent* transaction:
> grab any USDC transfer from ~200 blocks below the Ethereum head. If you'd
> rather make the age point explicitly, this is a natural place to add six
> seconds: *"and proving a two-year-old fact costs only 26% more than a
> twenty-minute-old one — which is the entire economic argument for a permanent
> registry."*

**Cut to `#/obligation/2`.** Scroll to the docket.

> And that is the only thing that moves an obligation here. This one advanced to
> **Current** because a payment was proven at source-chain height 25,773,802 —
> not because anyone said it was paid.

*Optional, if pacing allows: hover the status pill to show the tooltip meaning.*

---

## Scene 4 — The inversion · 1:18–1:58

**This is the scene that wins. Slow down. Do not rush it.**

**Screen.** `#/obligation/5`. Status pill reads **Default**.

> Now the harder half. Proving a payment is easy. What about proving that
> *nothing* happened?

**Scroll to the record of transitions. Let the three entries sit on screen.**

> We registered this obligation and then did nothing at all. No payment. No
> report. No intervention.
>
> Two minutes and eighteen seconds later it was in default. Delinquent, then
> defaulted — by an unattended keeper watching the attested Ethereum head.

**Beat.**

> Nobody reported the missed payment. No committee voted. No oracle operator was
> involved. Three transactions, all on-chain, all linkable.

**Then immediately give the honest caveat — do not let a judge think we're
overclaiming:**

> To be precise: you can't prove a negative with an inclusion proof, and we don't
> claim to. What's proven on-chain is narrower — that **no admissible proof of
> payment was presented before the deadline**. That works economically because
> submission is permissionless and costs a fraction of a cent, so the borrower is
> the party most motivated to submit it. And if we're ever wrong, a late proof of
> an in-window payment still cures it.

*That paragraph is the technical high point of the whole video. Rehearse it until
it's exact — judges who know this space will be listening for the overclaim, and
not making it is the credibility moment.*

---

## Scene 4b — The borrower can save themselves · optional, +25s

**Include this if you can afford the time. It is the most sympathetic moment in
the product and the only one with a human in it.**

**Screen.** `#/obligation/10` — standing **Delinquent**, cure window open.

> One more thing about that default, because the asymmetry matters. A borrower
> can be marked delinquent when they *did* pay — if nobody submitted the proof.
>
> So the record is reversible. Here's an obligation in exactly that state.

**Paste the anchor hash into the cure form and submit:**

```
0x4949688a3bcadfcccf0a87b0a8d3f0aff7ff1f432fc6968140f1bf1097f75945
```

**It goes to Current, 1 of 3 proven.**

> Cured. And notice what I didn't need: an account, a wallet, or a single token
> of gas. The relay paid for it.
>
> That matters, because the person most likely to be wrongly marked delinquent is
> the least likely to be holding CTC. "Anyone can cure" is only true if it's true
> for them.

> ⚠️ **This is a one-shot scene — curing it consumes it.** Re-seed before each
> take with `npm run seed:curable`, wait ~60s for the keeper to mark it
> Delinquent, and use the new obligation id and anchor hash it prints. Check
> `deployments/seed-curable-102031.json` for the current pair.
>
> Worth saying on camera if you have the seconds: the relay **cannot forge**.
> Every proof it submits is independently verified by the precompile against the
> obligation's own binding, so a compromised relay can only refuse to help —
> never fabricate a payment or cure the wrong obligation.

---

## Scene 5 — The query that doesn't exist · 1:58–2:28

**Screen.** `#/encumbrance`. Paste the collateral reference and submit:

```
0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f
```

**Two live claims come back. This is real — not staged for the video.**

> Here's what that record is *for*. This is a collateral reference — a warehouse
> receipt. Before lending against it, ask the registry whether anything else
> already has a claim on it.
>
> Two live obligations. That asset is already pledged twice.

**Beat.**

> That question — *is this already encumbered* — does not have an answer anywhere
> else in crypto today. Neither does *what does this counterparty already owe*.

**Optional 6s if pacing allows — `#/underwriter/0x60eF…8e87`:**

> And this is where capital prices it. Underwriters stake first-loss capital
> against a named borrower — not a pool, not a score — and are slashed by proof
> when that borrower defaults.

---

## Scene 6 — Not an application · 2:28–2:48

**Screen.** `#/developers`. Scroll the four endpoints.

> One thing to be clear about: **this console is not the product.** It's how a
> person reads the register.
>
> The product is the record — and that anything can query it. No lending protocol
> should have to build its own cross-chain payment verification, default
> detection and encumbrance registry. That's plumbing, the same way no website
> implements its own DNS.

**Show a curl in the terminal — real, live, no auth:**

```bash
curl -s https://dokett-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f
```

> Free, public, unauthenticated, live right now. Same data the console runs on.
> There's no private tier — the read layer is a pure projection, so anyone can
> recompute every figure from the chain itself.

---

## Scene 7 — Close · 2:48–3:00

**Screen.** Landing page, "What this does not do yet."

> Everything here is testnet with synthetic data, the attestor set is
> permissioned today, and privacy is version one. Those are on the front page,
> not buried — because a registry whose whole claim is that nobody can assert
> anything into it has to be the first to say what it can't prove.

**Final card. Hold 3 seconds:**

```
dokett-console.vercel.app
github.com/successaje/Dokett
```

> Dokett. The obligation layer for the open economy.

---

## Timing check

Two cuts. Pick one before you record — don't try to decide while filming.

**Cut A — the tight 3:00 (safest).**

| Scene | Runs | Cumulative |
|---|---|---|
| 1 · The question | 0:22 | 0:22 |
| 2 · Why this chain | 0:23 | 0:45 |
| 3 · Evidence, live | 0:33 | 1:18 |
| 4 · The inversion | 0:40 | 1:58 |
| 5 · The query | 0:30 | 2:28 |
| 6 · Not an application | 0:20 | 2:48 |
| 7 · Close | 0:12 | 3:00 |

**Cut B — with the cure, if the ceiling is 3:30.** Insert Scene 4b (+0:25) and
trim the underwriter beat from Scene 5 (−0:06) and the curl from Scene 6 (−0:08).
Lands at **3:11**.

I'd film **Cut B** if the submission allows it. Scene 4b is the only moment with a
person in it, and "you didn't need an account, a wallet, or any gas" is the line
most likely to be remembered by a non-technical judge.

**If you run long, cut in this order:** the underwriter beat in Scene 5, then the
curl in Scene 6, then Scene 4b, then tighten Scene 1. **Never cut Scene 4** — and
never cut the caveat inside it.

---

## What not to do

- **Don't open with the dashboard.** Screens are not an argument; the lender's
  question is.
- **Don't lead with $14B.** It's supporting evidence, not the story.
- **Don't say "revolutionary", "seamless", or "the future of finance."** The tone
  is infrastructure: specific, unarguable about the mechanism, boring in the
  right places.
- **Don't claim we prove a payment didn't happen.** Scene 4's caveat exists
  precisely to avoid this. It is the difference between a credible protocol and
  one a technical judge stops believing at minute two.
- **Don't cite a statistic you haven't personally verified from its primary
  source.** Everything in this script is checkable — keep it that way.
