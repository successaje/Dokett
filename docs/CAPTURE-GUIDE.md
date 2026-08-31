# Screen capture guide — Part Two (1:00 → 2:53)

The companion to `VOICEOVER.md`. That file is what you *say*; this is what is
*on screen* while you say it.

**Record silent.** Narrate separately and lay it over. Trying to talk and drive
at once produces takes where the click lands three seconds after the sentence,
and you will not notice until the edit.

---

## Setup

| | |
|---|---|
| Capture | 1920×1080, 60fps if available (smooth scrolling matters more than sharpness) |
| Browser | Clean profile. No extensions, no bookmarks bar, no other tabs visible |
| Window | Maximised. Browser zoom **110%** — judges may watch on a phone |
| Theme | **Light.** Survives compression better and reads on a projector |
| Onboarding | Dismiss the panel before you start, and don't clear localStorage after |
| Cursor | Keep it visible. Move deliberately — it is the viewer's eye |

Pre-open these tabs in order, so you can cut between them without typing URLs
on camera:

```
1  terminal (in the repo)
2  https://dokett-console.vercel.app/#/obligation/2
3  https://dokett-console.vercel.app/#/obligation/5
4  https://dokett-console.vercel.app/#/obligation/11
5  https://dokett-console.vercel.app/#/encumbrance
6  https://dokett-console.vercel.app/#/developers
```

### Preflight — run this the morning you record

```bash
curl -s https://dokett-lens.fly.dev/health
curl -s https://dokett-relay.fly.dev/health
curl -s https://dokett-lens.fly.dev/obligation/2  | grep '"status"'   # Current
curl -s https://dokett-lens.fly.dev/obligation/5  | grep '"status"'   # Default
curl -s https://dokett-lens.fly.dev/obligation/11 | grep '"status"'   # Default + slash
```

Then do **one throwaway `prove:one` run** before recording. It is the only live
command in the video and it depends on the proof-builder API, the keeper's
balance, and the attested head all being healthy at once. Confirm it works, note
today's gas figure, then run it again on camera.

---

## A · Evidence · 1:00 → 1:22

**Screen 1 — terminal.** Type and run:

```bash
npm run prove:fresh
```

> ⚠️ **Never reuse a transaction hash from these docs.** Every proof is
> replay-guarded on `(chainKey, height, txIndex, logIndex)` and can be consumed
> exactly once — correct behaviour, since otherwise one real payment could
> satisfy unlimited obligations. A hash written down anywhere is therefore
> already spent, and reusing it reverts with an opaque custom error. Run
> `npm run prove:fresh`, which finds an unproven transaction and proves that.

> *"A real Ethereum mainnet transaction. I'm asking a Creditcoin contract to prove it happened."*

**⚠️ This call takes 20–60 seconds.** That is dead air. Record it in full, then
**speed the wait up 4–8× in post** — keep the command and the result frames at
normal speed. Compressing a wait is a rendering choice; do not cut or alter the
output itself.

> *"Verified — about one hundredth of a cent."*

Let the gas and CTC figures sit on screen. **Read them off the screen, not from
this file** — the number rises as the proven transaction ages, because the
continuity proof walks further back.

**Screen 2 — cut to tab 2 (`#/obligation/2`).** Scroll to *Record of
transitions*.

> *"That's the only thing that moves an obligation here. This one is Current because a payment was proven."*

Let the cursor rest on the **CURRENT** pill as you say "proven."

---

## B · The inversion · 1:22 → 2:00

**This is the scene that wins. Everything here moves slower than feels natural.**

**Cut to tab 3 (`#/obligation/5`).** Start at the top so the **DEFAULT** pill is
the first thing visible.

> *"Now the harder half. Proving a payment is easy. What about proving that nothing happened?"*

Hold on the status pill. Do not scroll yet.

> *"We registered this obligation and did nothing."*

Now scroll slowly to **Record of transitions**. The three entries should arrive
under the words that describe them:

> *"Two minutes and eighteen seconds later it was in default — marked delinquent, then defaulted, by an unattended keeper. Nobody reported it."*

Rest the cursor beside each transition as you name it. Do not click through to
the explorer — it takes the viewer off the page and you cannot get back cheaply.

> *"To be precise: we don't claim to prove a negative. What's proven is narrower — no admissible proof arrived before the deadline."*

**Stop moving entirely for this sentence.** A still frame under a careful caveat
reads as confidence. Motion under it reads as hurrying past something.

> *"Submission is permissionless and costs a fraction of a cent. And a late proof still cures it."*

---

## C · The slash · 2:00 → 2:23

> ⚠️ **Navigate to obligation 11, not 5.** Obligation 5 has no bonds and its
> Underwriting section says *"No bonds posted"* — the exact opposite of this
> narration. 11 is the one that was actually slashed.

**Cut to tab 4 (`#/obligation/11`).** Scroll to *Record of transitions* and stop
on the final entry, which reads that first-loss capital was slashed to the
creditor.

> *"When it defaults, first-loss capital is slashed to the creditor in the same transaction."*

**Cut to `#/underwriter/0x60eF148485C2a5119fa52CA13c52E9fd98F28e87`.** The four
figures at the top are the payoff.

> *"This underwriter's loss rate went from zero to seven point six nine percent."*

Cursor rests on the **LOSS RATE** figure.

> *"Not a score anyone assigned — slashed over posted, recomputed from chain events, editable by nobody."*

Then slowly scroll to the **Positions** table so the individual bonds — including
the slashed one — are visible as the sentence lands.

**Optional, ~5s — the beat that turns a number into a market.** While still on
*"recomputed from chain events, editable by nobody"*, paste a second underwriter
into the lookup:

```
0xC282Cb7cE6c175582B84BF94C61258Bb5cDCA88e
```

A different book appears: three bonds, **0.00%** loss rate. Same page, same
derivation, different address — which is the whole point of the sentence you are
saying. A rating agency assigns; this is computed per address from what actually
happened.

There is no all-underwriters index, so this needs the second lookup rather than
one screen. Costs about five seconds, against fifteen of headroom.

---

## D · The query that doesn't exist · 2:23 → 2:47

**Cut to tab 5 (`#/encumbrance`).** Empty search field, nothing entered yet.

Paste, but **do not submit yet**:

```
0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f
```

> *"A collateral reference — a warehouse receipt. Before lending against it, ask whether anything already has a claim."*

**Now submit.** Results arrive on the beat.

> *"Two live obligations. It's pledged twice."*

Cursor moves down the two rows, one per phrase. Do not click into them.

> *"That question has no answer anywhere else in crypto."*

Hold on the result table.

---

## E · Close · 2:47 → 2:53

**Cut to tab 6 (`#/developers`).** Land on the **Read API** section with the four
endpoints visible.

> *"This console isn't the product. It's how a person reads the register. The product is the record — and that anything can query it. Free, public, live now."*

Scroll slowly through the endpoint list — `/solvency`, `/encumbrance`,
`/obligation`, `/profile`.

> *"Everything here is testnet."*

> *"Dokett. The obligation layer for the open economy."*

**Final frame:** cut to a held card — Dokett wordmark, then:

```
dokett-console.vercel.app
github.com/successaje/Dokett
```

Hold three seconds. Do not fade to black on a scrolling page.

---

## If something breaks mid-record

| Problem | What to do |
|---|---|
| `prove:one` fails or hangs | Skip the terminal. Open `#/obligation/2` and say *"this obligation advanced to Current because a payment was proven at source-chain height 25,773,802."* The proof is already on-chain and needs nothing live. |
| An obligation changed status | Use the live register. Every scene works with **any** obligation in the right state — the script names ids for convenience, not because they are special. Check with `curl .../obligations`. |
| The Lens is unreachable | Stop. Do not film the degraded state. Check `flyctl status -a dokett-lens`. |
| The gas figure differs from what you rehearsed | Read what is on screen. Both numbers are correct; they answer different questions. |

---

## Post

- **Burn in subtitles.** A meaningful share of judging happens in a second
  language, possibly on a phone.
- Speed up only the `prove:one` wait. Nothing else.
- No music under the caveat in Scene B, if you use music at all.
- Export 1080p. Check it once at phone size before submitting — if the mono
  figures are unreadable there, raise the browser zoom and re-record rather than
  shipping it.
- Watch it once with the sound off. If the sequence of screens alone still tells
  the story, the pacing is right.
