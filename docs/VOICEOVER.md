# Dokett — voiceover script

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
> Now move that borrower on-chain. A loan on Ethereum. Collateral on a second
> chain. A tokenized asset on a third. //
>
> Each system sees its own slice **perfectly**. None of them can see the
> others. //
>
> So the question gets asked — and there is **nowhere to send it**. //
>
> This is Dokett. A registry where a promise to pay is a first-class on-chain
> object, and its status changes only on cryptographic **proof**. Never because
> someone said so. //
>
> Creditcoin knows how to record credit. Attestcoin lets it see across chains.
> **Dokett turns what it can see into a shared, verifiable record of
> obligations.**

**Animation note.** The strongest beat is the fourth: isolated boxes, each lit
from inside, no line between any of them — then one line drawn underneath,
connecting all of them, as the thesis lands. Hold the logo until "This is
Dokett."

---

# PART TWO — SCREEN CAPTURE · 1:59

## A · Evidence — `prove:fresh`, then `#/obligation/2` · 0:18

> A real Ethereum mainnet transaction. I'm asking a Creditcoin contract to prove
> it happened. //
>
> Verified — about one hundredth of a cent. //
>
> That's the **only** thing that moves an obligation here. This one is
> Current because a payment was **proven**.

> ⚠️ Run **`npm run prove:fresh`**, never a hash copied from these docs. Every
> proof can be consumed only once, so any hash written down is already spent and
> will revert on camera. `prove:fresh` finds an unproven transaction and proves
> that.
>
> ⚠️ Read the gas figure off the screen. Do not memorise one — it rises as the
> proven transaction ages, because the continuity proof walks further back.
> Today's fresh run measured **409,962 gas · 0.000204981 CTC**.

## B · The inversion — `#/obligation/5` · 0:45

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

## C · The slash — `#/obligation/11`, then `#/underwriter/0x60eF…8e87` · 0:18

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

> **Optional screen beat, no extra words (~5s).** While saying that last
> sentence, look up a second underwriter — `0xC282Cb7c…` — and let a different
> book appear: three bonds, 0.00% loss rate. Same page, same derivation,
> different address. It shows what the sentence claims instead of asserting it.
> Costs ~5s, and there are 15 to spare. Screen direction is in
> CAPTURE-GUIDE.md.

## E · Someone else's application — `demobank` · 0:38

**The close. D was folded into this scene — showing a lender act on the
encumbrance beats showing the encumbrance.**

> This console isn't the product. It's how a *person* reads the register. //
>
> So here's a different application reading it. We wrote this one, but it has
> no Dokett account, no key and no permission — because there is nothing to
> have. One static file. //
>
> It asks what this borrower owes — and whether their collateral is already
> pledged elsewhere. //
>
> It is. Twice. **That question has no answer anywhere else in crypto.** //
>
> Seven queries. Credit declined — on DemoBank's policy, not Dokett's score. //
>
> We didn't build a lending protocol. **We built the record that lending
> protocols can finally read.**

> Dokett returns facts and never a recommendation. If you ad-lib one sentence
> here, make it that one — it is the difference between a registry and a credit
> bureau, and the whole README argues for it.

---

## Timing

**Counted by script, per scene, from this file** — not estimated. Narration
words at 150 wpm plus one second per `//` beat, excluding ⚠️ notes and their
continuation lines.

| | Runs | Cumulative |
|---|---|---|
| Part One · animated | 0:55 | 0:55 |
| Part Two · screen | 1:59 | **2:54** |

**6 seconds of headroom against the 3:00 ceiling.** That is thin. Read at a
deliberate 135 wpm this becomes 3:11, so take a cut below *before* recording
rather than discovering it in the edit.

### Two corrections to what this file used to claim

**The old numbers were wrong, and wrong in the dangerous direction.** Three
figures in this file disagreed with each other: the Part Two header said 1:53,
the timing table said 1:45, and the scene headings summed to 2:12. Measured,
Part Two was **2:06** — so the advertised 2:45 total was really ~3:06, over the
ceiling, in a file whose whole purpose is to keep the video under it.

**Scene D was cut, not shortened.** It displayed a twice-pledged asset on the
Encumbrance page. Scene E now shows a *lender declining because of* that
encumbrance, which is the same fact doing work instead of sitting on screen.
Its best line — *"that question has no answer anywhere else in crypto"* —
moved into E, where it lands on a decision rather than a table.

If a take still runs long, cut in this order:

1. "Submission is permissionless and costs a fraction of a cent." — B.
   Weakens the caveat's economics, so it is a real loss. ~0:05
2. "It's how a *person* reads the register." — E. The contrast survives
   without it. ~0:03

**Never cut** the caveat itself in B, the "no score, facts only" line in E, or
the closing line.

---

## Before you record

```bash
curl -s https://dokett-lens.fly.dev/health
curl -s https://dokett-relay.fly.dev/health
curl -s https://dokett-lens.fly.dev/obligation/2  | grep '"status"'   # want Current
curl -s https://dokett-lens.fly.dev/obligation/5  | grep '"status"'   # want Default
curl -s https://dokett-lens.fly.dev/obligation/11 | grep '"status"'   # want Default — the slash
curl -s https://dokett-lens.fly.dev/obligation/13 | grep '"status"'   # want Active — the encumbered pledge

# Scene D wants THREE claims; Scene E's decline depends on two of them
curl -s https://dokett-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f | grep '"id"'
```

Console in **light theme**, onboarding dismissed, zoom 110%, clean browser
profile. **Burn in subtitles** — a meaningful share of judging happens in a
second language.

If an id has drifted, use the live register rather than this script. Every scene
works with any obligation in the right state.
