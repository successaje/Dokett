# Dokett — voiceover script

**Measured, not estimated.** Word-counted at 150 wpm with the beats included.

**On length.** The live DoraHacks rules page (checked 2026-09-04, in full —
Rules and Requirements plus every collapsed section) states no video-length
limit anywhere. The earlier "3:00 hard ceiling" in this file's history was a
self-imposed target, not a submission rule. Target here is **~3:40**,
deliberate rather than default: judges are reading 48 submissions, so density
still matters more than a longer runtime — this isn't "no limit, so pad it,"
it's "no limit, so spend the extra 40 seconds on the two things Part One and
the original cut couldn't fit: why this only works on Creditcoin + Attestcoin
(Scene B, new), and why the pattern isn't Creditcoin-only (folded into Scene
E's close). Both are direct answers to a stated scoring criterion — "depth of
Attestcoin Protocol utilization" — not padding.

Two parts. **Part One is animated** (no UI — typography, motion, diagram).
**Part Two is screen capture** of the live Console.

---

## How to read this

- Pace **~150 wpm**. Measured, not brisk. This is a registry, not a launch.
- `//` is a **beat** — about one second. They are counted in the timing, so
  taking them does not put you over.
- **Bold** takes the stress.
- Read numbers as the *[spoken: …]* notes say. "2m15s" out loud is worse than
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

# PART TWO — SCREEN CAPTURE · 1:54

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

## B · Why only here — `#/developers/asc-integration` · new

**Added for the extended cut.** Cut to `#/developers/asc-integration` right after
Scene A's proof resolves — the viewer just watched an ASC proof happen; this is
the moment to say why that was hard to build anywhere else. Scroll slowly
through the "Three minutes" table as you speak, landing on the precompile
addresses and the "Verified end to end" block by the close of the beat.

> Why only here? //
>
> Three things had to be true at once. A chain whose subject is already credit.
> A way to verify another chain's event with no bridge and no oracle operator.
> Verification cheap enough, forever, to run continuously. //
>
> Creditcoin is the first. Attestcoin is the second — a Creditcoin contract
> reading a real Ethereum event with nobody standing between them. //
>
> Remove any one, and there is no Dokett.

## C · The inversion — `#/obligation/5` · 0:36

**Slow down. This is the scene that wins.**

> Now the harder half. Proving a payment is easy. What about proving that
> **nothing** happened? //
>
> We registered this obligation and did nothing.
>
> Two minutes and fifteen seconds later it was in default — marked delinquent,
> then defaulted, by an unattended keeper. Nobody reported it. //
>
> To be precise: we don't claim to prove a negative. What's proven is narrower —
> no admissible proof arrived before the deadline. //
>
> Submission is permissionless and costs a fraction of a cent. And a late proof
> **still cures it**.

> The caveat is not a disclaimer to rush past. It is the most credible thing in
> the video. Rehearse it until it is exact.

> ⚠️ **2m15s, not 2m18s.** Measured from the three `StatusChanged` events on
> obligation 5: registered at t=0, Delinquent at +15s, Default at +135s. An
> earlier draft said 2m18s, which nothing on chain supports. A judge who pulls
> those transactions gets 135 seconds, and being caught inflating the one number
> the scene turns on would cost more than the three seconds are worth.
>
> This number belongs to obligation **5** alone. Obligation 11 took **21m15s**,
> so Scene C cannot inherit the line.

## D · The slash — `#/obligation/11`, then `#/underwriter/0x60eF…8e87` · 0:20

> ⚠️ **Navigate to obligation 11.** Scene C leaves you on 5, which carries no
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
> book appear: four bonds, 0.00% loss rate. Same page, same derivation,
> different address. It shows what the sentence claims instead of asserting it.
> Costs ~5s, and there are 3 to spare. Screen direction is in
> CAPTURE-GUIDE.md.

## E · Someone else's application — `demobank` · 0:51

**The close.** (A note on the letter D: an *earlier* Scene D — displaying a
twice-pledged asset on the Encumbrance page — was folded into this scene rather
than shortened, since showing a lender act on the encumbrance beats showing
the encumbrance itself. The letter D was later reused for a different, unrelated
scene — the slash — once the extended cut added two new beats. If you're
comparing against an old recording or an earlier version of this file, that's
why the letters don't line up.)

> This console isn't the product — it's how a *person* reads the register. //
>
> Here's a different application reading it. We wrote it, but it holds no key
> and no permission — there's nothing to hold. One static file. //
>
> It asks what this borrower owes, and whether their collateral is pledged
> elsewhere. //
>
> It is. Twice. **No answer to that exists anywhere else in crypto.** //
>
> Seven queries. Credit declined — DemoBank's policy, not Dokett's score. //
>
> This isn't a Creditcoin-only problem — every chain that tokenizes a real asset
> inherits it. Attestcoin is what makes it provable instead of asserted, here
> first. //
>
> We didn't build a lending protocol. **We built the record lending protocols
> can finally read.**

> Dokett returns facts and never a recommendation. If you ad-lib one sentence
> here, make it that one — it is the difference between a registry and a credit
> bureau, and the whole README argues for it.

---

## Timing

```bash
python3 script/time-voiceover.py
```

Counted **by script, from this file** — narration words at 150 wpm plus one
second per `//` beat. Do not hand-count it; three separate hand-counts of this
file have now been wrong.

| | Runs | Cumulative |
|---|---|---|
| Part One · animated | 1:00 | 1:00 |
| Part Two · screen | 2:37 | **3:37** |

**Against the ~3:40 target** (not a rule — see "On length" above), this is 3
seconds under. Read at a deliberate 135 wpm this becomes ~4:00, so if your
natural pace is slow, take cut 1 below *before* recording rather than
discovering it in the edit.

### Why there is now a script

Every hand-count of this file has been wrong, in both directions, because
narration and director's notes are both blockquotes and the eye does not
separate them reliably.

- The original count swallowed the continuation lines of ⚠️ notes and reported
  **2:45**.
- Three figures then disagreed at once: the Part Two header said 1:53, the
  table said 1:45, the scene headings summed to 2:12.
- The recount that caught that swallowed a whole 24-word note inside Scene B
  and reported **3:28**, which triggered trims that were not needed.

`script/time-voiceover.py` classifies note blocks explicitly instead of
guessing. Re-run it after any edit to narration; the numbers above came from
it, not from a person.

**On the extended cut (~3:37):** two beats are new — Scene B ("Why only
here") and the "isn't a Creditcoin-only problem" pair inside Scene E. Both
answer the stated scoring criterion on Attestcoin depth directly rather than
padding, but they're also the least battle-tested lines in the script — cut
them first if a take runs long, before touching anything in A, C, or D, which
have already survived several passes of trimming and are tuned tight.

If a take still runs long, cut in this order:

1. Scene B in full ("Why only here"). ~0:30. The extended cut's newest
   addition and the easiest to lose cleanly — it's a self-contained beat with
   its own scene cut on either side, so removing it doesn't require touching
   anything else.
2. The "isn't a Creditcoin-only problem" pair in E. ~0:12. Also new; loses the
   generalization argument but keeps everything else in the close intact.
3. "In traditional finance, an apparatus exists to answer it." — Part One.
   Cut animation shot 3 with it rather than holding 4.5 seconds of silent
   boxes; the brief builds that shot around this line. ~0:04
4. "It's how a *person* reads the register." — E. The contrast survives on
   the cut alone. ~0:03
5. "Submission is permissionless and costs a fraction of a cent." — C (the
   inversion). Weakens the caveat's economics, so it is a real loss, and
   should be the last thing touched of the original cut's content. ~0:05

**Never cut** the caveat itself in C, the "no score, facts only" line in E, or
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

# Scene E's decline depends on this returning THREE claims
curl -s https://dokett-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f | grep '"id"'
```

Console in **light theme**, onboarding dismissed, zoom 110%, clean browser
profile. **Burn in subtitles** — a meaningful share of judging happens in a
second language.

If an id has drifted, use the live register rather than this script. Every scene
works with any obligation in the right state.
