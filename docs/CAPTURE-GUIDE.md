# Screen capture guide — Part Two (1:00 → 3:37)

**Extended cut.** Two scenes were added to the original 2:55 version: a new
Scene B ("Why only here," on the Developers/ASC-integration page) and two new
lines folded into the close of Scene E. See `VOICEOVER.md`'s "On length" note
for why — there is no stated video-length limit on the live DoraHacks rules
page (checked 2026-09-04), and this is a deliberate ~3:40 target, not padding
toward an old 3:00 rule that turned out not to exist.

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
3  https://dokett-console.vercel.app/#/developers/asc-integration
4  https://dokett-console.vercel.app/#/obligation/5
5  https://dokett-console.vercel.app/#/obligation/11
6  https://dokett-console.vercel.app/#/underwriter/0x60eF148485C2a5119fa52CA13c52E9fd98F28e87
7  https://demobank-credit.vercel.app
                              ← a different origin. That it is not
                                dokett-console.vercel.app is the whole point
                                of the scene; do not serve it from a path
                                under the Console.
```

### Preflight — run this the morning you record

```bash
curl -s https://dokett-lens.fly.dev/health
curl -s https://dokett-relay.fly.dev/health
curl -s https://dokett-lens.fly.dev/obligation/2  | grep '"status"'   # Current
curl -s https://dokett-lens.fly.dev/obligation/5  | grep '"status"'   # Default
curl -s https://dokett-lens.fly.dev/obligation/11 | grep '"status"'   # Default + slash
curl -s https://dokett-lens.fly.dev/obligation/13 | grep '"status"'   # Active — the encumbered pledge

# Scene E's strongest decline reason depends on this returning THREE claims
curl -s https://dokett-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f \
  | grep -c '"id"'
```

**Confirm DemoBank is not behind a login wall.** It ships with Vercel
Deployment Protection on by default, which 302s to a Vercel SSO page — fatal
here, since the scene's whole claim is that no account is needed:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://demobank-credit.vercel.app   # want 200, not 302
```

If that returns 302: Vercel dashboard → project **demobank** → Settings →
Deployment Protection → **Vercel Authentication: Disabled** → Save.

> ⚠️ **Re-alias after any redeploy.** `demobank-credit.vercel.app` is a manual
> alias and does **not** follow a new production deployment on its own — a
> redeploy leaves it serving the previous build. After any `vercel deploy`:
>
> ```bash
> vercel alias set <new-deployment-url> demobank-credit.vercel.app
> ```

Then open DemoBank and run one throwaway application before recording. It
makes seven live calls to the Lens; if any of them is slow or the Lens is
mid-restart, you want to know before the camera is on.

Then do **one throwaway `prove:one` run** before recording. It is the only live
command in the video and it depends on the proof-builder API, the keeper's
balance, and the attested head all being healthy at once. Confirm it works, note
today's gas figure, then run it again on camera.

---

## A · Evidence · 1:00 → 1:18

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

## B · Why only here · 1:18 → 1:48

**New scene.** The viewer just watched an ASC proof resolve in Scene A — this
is the moment to say why that was hard to build anywhere else, while it's
still fresh. Verified live at 1440×900: the "0. Three minutes" table and the
"Verified end to end" code block (real tx hashes, real gas) render together
in one screen when you `scrollIntoView({block:'center'})` on the table, so a
single controlled scroll carries the whole scene.

**Cut to tab 3 (`#/developers/asc-integration`).** Land with the page heading
and the pull-quote ("Every number in this document was measured against live
CC3 testnet...") visible — do not start mid-scroll.

> *"Why only here?"*

Hold a beat on the heading. Then begin a slow, continuous scroll — not a
jump-cut — timed to land on the five-row table by the second sentence:

> *"Three things had to be true at once. A chain whose subject is already credit. A way to verify another chain's event with no bridge and no oracle operator. Verification cheap enough, forever, to run continuously."*

Let the cursor drift down the table rows as each condition is named — it
doesn't need to match 1:1, just move in the same direction as the sentence.

> *"Creditcoin is the first. Attestcoin is the second — a Creditcoin contract reading a real Ethereum event with nobody standing between them."*

Continue the scroll to the **"Verified end to end on 17 Aug 2026"** code
block — real source tx, proof tx, gas, cost. This is the strongest single
frame to be holding when the line lands:

> *"Remove any one, and there is no Dokett."*

**Hold on the code block for this line. Do not scroll during it.** A real
transaction hash sitting still under "there is no Dokett" is the visual
argument; a moving screen undercuts it.

---

## C · The inversion · 1:48 → 2:24

**This is the scene that wins. Everything here moves slower than feels natural.**

**Cut to tab 4 (`#/obligation/5`).** Start at the top so the **DEFAULT** pill is
the first thing visible.

> *"Now the harder half. Proving a payment is easy. What about proving that nothing happened?"*

Hold on the status pill. Do not scroll yet.

> *"We registered this obligation and did nothing."*

Now scroll slowly to **Record of transitions**. The three entries should arrive
under the words that describe them:

> *"Two minutes and fifteen seconds later it was in default — marked delinquent, then defaulted, by an unattended keeper. Nobody reported it."*

Rest the cursor beside each transition as you name it. Do not click through to
the explorer — it takes the viewer off the page and you cannot get back cheaply.

> *"To be precise: we don't claim to prove a negative. What's proven is narrower — no admissible proof arrived before the deadline."*

**Stop moving entirely for this sentence.** A still frame under a careful caveat
reads as confidence. Motion under it reads as hurrying past something.

> *"Submission is permissionless and costs a fraction of a cent. And a late proof still cures it."*

---

## D · The slash · 2:24 → 2:44

> ⚠️ **Navigate to obligation 11, not 5.** Obligation 5 has no bonds and its
> Underwriting section says *"No bonds posted"* — the exact opposite of this
> narration. 11 is the one that was actually slashed.

**Cut to tab 5 (`#/obligation/11`).** Scroll to *Record of transitions* and stop
on the final entry, which reads that first-loss capital was slashed to the
creditor.

> *"When it defaults, first-loss capital is slashed to the creditor in the same transaction."*

**Cut to tab 6 (`#/underwriter/0x60eF…8e87`).** The four
figures at the top are the payoff.

> *"This underwriter's loss rate went from zero to seven point six nine percent."*

Cursor rests on the **LOSS RATE** figure.

> *"Not a score anyone assigned — slashed over posted, recomputed from chain events, editable by nobody."*

Then slowly scroll to the **Positions** table so the individual bonds — including
the slashed one — are visible as the sentence lands.

**Optional — but the margin against the ~3:40 target is 3 seconds, not 15.**
Take this only if your read is comfortably under time. The beat that turns a
number into a market: While still on
*"recomputed from chain events, editable by nobody"*, paste a second underwriter
into the lookup:

```
0xC282Cb7cE6c175582B84BF94C61258Bb5cDCA88e
```

A different book appears: four bonds, **0.00%** loss rate. Same page, same
derivation, different address — which is the whole point of the sentence you are
saying. A rating agency assigns; this is computed per address from what actually
happened.

There is no all-underwriters index, so this needs a second lookup rather than
one screen. It costs about five seconds of a three-second margin — so it is
the first thing to drop, not the last.

---

## E · Someone else's application · 2:44 → 3:35

> **An earlier "Scene D" is gone**, not the current one — see the letter note
> in `VOICEOVER.md`'s Scene E header if the lettering here doesn't match an
> older recording. That earlier scene paged through the Encumbrance screen to
> show an asset pledged twice. This scene shows a lender *declining because
> of* that encumbrance instead, which is the same fact doing work rather than
> sitting on screen. The line it was worth keeping moved here.

**Cut to tab 7 — DemoBank**, on its own domain. Land on the form, already
filled:
applicant commitment `0x986a7f70…`, amount `7500`. Nothing queried yet.

> *"This console isn't the product. It's how a person reads the register."*

Say that while still on the Console, then cut. The cut lands on the word
"person" — a visibly different product by a visibly different party.

> *"So here's a different application reading it. We wrote this one, but it has no Dokett account, no key and no permission — because there is nothing to have. One static file."*

**Say "we wrote this one" and do not skip it.** DemoBank is a reference
consumer, not an independent integrator, and your GitHub account is on the
submission form. The claim that survives checking is not *someone else built
this* — it is *this is all it takes*, which is both true and the more
impressive of the two.

**Click "Check Dokett".** The query log fills one line at a time, each showing
its full URL. **Do not talk over this.** Seven public GETs appearing on screen
is the proof; narrating it competes with it.

> *"It asks what this borrower owes — and whether their collateral is already pledged elsewhere."*

The facts panel arrives. Rest the cursor on **prior claims by other lenders —
2 · $60,169**.

> *"It is. Twice. That question has no answer anywhere else in crypto."*

**Hold still here.** Then scroll to the policy checks so the six red crosses
and one green tick are visible, and let the verdict land.

> *"Seven queries. Credit declined — on DemoBank's policy, not Dokett's score."*

Cursor rests on the line under the verdict: *Decision based on 7 public Dokett
queries. No Dokett account. No Dokett permission. No proprietary credit score.*

Finally scroll to **The entire integration** — the whole policy visible as a
few lines of code, opening on *"// No SDK. No auth. No account."*

> *"This isn't a Creditcoin-only problem — every chain that tokenizes a real asset inherits it."*

Hold on that comment line as you say it — it's a real, verified line of the
actual code, not a claim laid over a generic screen. Then let the cursor drift
down through the `fetch()` call and the `POLICY` object as the next line
lands, ending on the closing brace:

> *"Attestcoin is what makes it provable instead of asserted, here first."*

> *"We didn't build a lending protocol. We built the record that lending protocols can finally read."*

**Final frame:** hold a card — Dokett wordmark, then:

```
dokett-console.vercel.app
github.com/successaje/Dokett
```

Hold three seconds. Do not fade to black on a scrolling page.

---

## If something breaks mid-record

| Problem | What to do |
|---|---|
| DemoBank shows fewer than 7 queries | Obligation 13 or its bond is missing. Re-run `npm run seed:encumbered`, wait ~20s for the Lens, reload. |
| DemoBank's encumbrance check passes | The prior claims went inactive. Verify with the `grep -c '"id"'` preflight — it must return 3. |
| `prove:one` fails or hangs | Skip the terminal. Open `#/obligation/2` and say *"this obligation advanced to Current because a payment was proven at source-chain height 25,773,802."* The proof is already on-chain and needs nothing live. |
| An obligation changed status | Use the live register. Every scene works with **any** obligation in the right state — the script names ids for convenience, not because they are special. Check with `curl .../obligations`. |
| The Lens is unreachable | Stop — DemoBank cannot render without it, and neither can the Console. Check `flyctl status -a dokett-lens`. |
| The gas figure differs from what you rehearsed | Read what is on screen. Both numbers are correct; they answer different questions. |
| The ASC-integration page's table or figures look different from this guide | It's a live-rendered markdown doc (`docs/ASC-INTEGRATION.md`), not a static screen — it can be edited between when this guide was written and when you record. Scene B still works with whatever the page currently shows; the scene doesn't depend on the exact wording, only on the table and the verified-tx block existing. |

---

## Post

- **Burn in subtitles.** A meaningful share of judging happens in a second
  language, possibly on a phone.
- Speed up only the `prove:one` wait. Nothing else.
- No music under the caveat in Scene C (the inversion) or under the "remove
  any one, and there is no Dokett" line in Scene B, if you use music at all —
  both are places where a still, quiet frame is doing real work.
- Export 1080p. Check it once at phone size before submitting — if the mono
  figures are unreadable there, raise the browser zoom and re-record rather than
  shipping it.
- Watch it once with the sound off. If the sequence of screens alone still tells
  the story, the pacing is right.
