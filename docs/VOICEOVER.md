# Covenant — voiceover script

**Measured, not estimated.** Word-counted at 150 wpm with the beats included.
Comfortably under the 3:00 ceiling with room for a natural read.

Two parts. **Part One is animated** (no UI — typography, motion, diagram).
**Part Two is screen capture** of the live Console.

---

## How to read this

- Pace **~150 wpm**. Measured, not brisk. This is a registry, not a launch.
- `//` is a **beat** — about one second. They are counted in the timing, so
  taking them does not put you over.
- **Bold** takes the stress.
- Read numbers as the *[spoken: …]* notes say. "2m18s" out loud is worse than
  useless.
- *CRED-it-coin · at-TEST-coin · COV-en-ant*
- Record audio separately from the screen. One bad sentence then costs one
  sentence, not the whole take.

---

# PART ONE — ANIMATED · 1:00

> A business wants to borrow a million dollars. Before approving it, the lender
> asks the oldest question in finance. //
>
> **What do you already owe?** //
>
> In traditional finance, an apparatus exists to answer it. //
>
> Now move that borrower on-chain. A loan on Ethereum. Collateral on a second
> chain. A tokenized asset on a third. //
>
> Each system sees its own slice **perfectly**. None of them can see the
> others. //
>
> So the question gets asked — and there is **nowhere to send it**. //
>
> This is Covenant. A registry where a promise to pay is a first-class on-chain
> object, and its status changes only on cryptographic **proof**. Never because
> someone said so. //
>
> Creditcoin knows how to record credit. Attestcoin lets it see across chains.
> **Covenant turns what it can see into a shared, verifiable record of
> obligations.**

**Animation note.** The strongest beat is the fourth: isolated boxes, each lit
from inside, no line between any of them — then one line drawn underneath,
connecting all of them, as the thesis lands. Hold the logo until "This is
Covenant."

---

# PART TWO — SCREEN CAPTURE · 1:53

## A · Evidence — `prove:one`, then `#/obligation/2` · 0:22

> A real Ethereum mainnet transaction. I'm asking a Creditcoin contract to prove
> it happened. //
>
> Verified — about one hundredth of a cent. //
>
> That's the **only** thing that moves an obligation here. This one is
> Current because a payment was **proven**.

> ⚠️ Read the gas figure off the screen. Do not memorise one — it rises as the
> proven transaction ages, because the continuity proof walks further back.

## B · The inversion — `#/obligation/5` · 0:38

**Slow down. This is the scene that wins.**

> Now the harder half. Proving a payment is easy. What about proving that
> **nothing** happened? //
>
> We registered this obligation and did nothing.
>
> Two minutes and eighteen seconds later it was in default — marked delinquent,
> then defaulted, by an unattended keeper. Nobody reported it. //
>
> To be precise: we don't claim to prove a negative. What's proven is narrower —
> no admissible proof arrived before the deadline. //
>
> Submission is permissionless and costs a fraction of a cent. And a late proof
> **still cures it**.

> The caveat is not a disclaimer to rush past. It is the most credible thing in
> the video. Rehearse it until it is exact.

## C · The slash — `#/obligation/11`, then `#/underwriter/0x60eF…8e87` · 0:23

> ⚠️ **Navigate to obligation 11.** Scene B leaves you on 5, which carries no
> bonds and displays "No bonds posted" — the exact opposite of what this VO
> says. 11 is the obligation that was actually slashed.

> When it defaults, first-loss capital is slashed to the creditor **in the same
> transaction**. //
>
> This underwriter's loss rate went from zero to **seven point six nine
> percent**.
> *[spoken: "seven point six nine percent"]*
>
> Not a score anyone assigned — slashed over posted, recomputed from chain
> events, editable by nobody.

## D · The query that doesn't exist — `#/encumbrance` · 0:24

Paste: `0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f`

> A collateral reference — a warehouse receipt. Before lending against it, ask
> whether anything already has a claim. //
>
> **Two live obligations.** It's pledged twice. //
>
> That question has no answer anywhere else in crypto.

## E · Close — `#/developers` · 0:25

> This console isn't the product. It's how a person reads the register.
> The product is the record — and that **anything** can query it. Free, public,
> live now. //
>
> Everything here is testnet. //
>
> **Covenant. The obligation layer for the open economy.**

---

## Timing

Word-counted at 150 wpm, beats included.

| | Runs | Cumulative |
|---|---|---|
| Part One · animated | 1:00 | 1:00 |
| Part Two · screen | 1:53 | **2:53** |

**7 seconds of headroom against the 3:00 ceiling.**

Read at a slower 135 wpm this becomes **3:12** — over. So if you naturally read
slowly, take the cuts below *before* recording rather than discovering it in the
edit.

If a take still runs long, cut in this order:

1. "In traditional finance, an apparatus exists to answer it." — Part One. The
   animation can show bureaus and registries without you naming them. ~0:04
2. "Everything here is testnet." — E. The footer and landing page both say it. ~0:03
3. "Submission is permissionless and costs a fraction of a cent." — B. Weakens
   the caveat's economics, so take this one last. ~0:05

**Never cut** the caveat itself in B, or the closing line.

---

## Before you record

```bash
curl -s https://covenant-lens.fly.dev/health
curl -s https://covenant-relay.fly.dev/health
curl -s https://covenant-lens.fly.dev/obligation/2  | grep '"status"'   # want Current
curl -s https://covenant-lens.fly.dev/obligation/5  | grep '"status"'   # want Default
curl -s https://covenant-lens.fly.dev/obligation/11 | grep '"status"'   # want Default — the slash
```

Console in **light theme**, onboarding dismissed, zoom 110%, clean browser
profile. **Burn in subtitles** — a meaningful share of judging happens in a
second language.

If an id has drifted, use the live register rather than this script. Every scene
works with any obligation in the right state.
