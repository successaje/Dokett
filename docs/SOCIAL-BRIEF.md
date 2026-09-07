# Social brief — for whoever is posting

Not a script. Everything below is either a **verified live fact** (checked the
day this file was written, with the command to re-check it) or a **rule about
what not to claim**. Post in your own voice; just don't post a number you
haven't re-verified, and don't cross a line marked ⚠️.

Re-run the "before you post" block below before anything with a number in it
goes out — figures here drift as the register keeps running.

---

## What Dokett is, in one breath

A registry on Creditcoin where a promise to pay is an on-chain object, and its
status changes only when a Creditcoin contract verifies a real Ethereum event
via Attestcoin — never because someone reported it. It also runs the inverse:
if the expected proof never arrives, the obligation degrades to delinquent and
then default **on its own**, and named first-loss capital gets slashed to the
creditor in the same transaction.

If you need one line: **"the obligation layer for the open economy."**

---

## Before you post anything with a number in it

```bash
curl -s https://dokett-lens.fly.dev/health
curl -s https://dokett-console.vercel.app -o /dev/null -w "%{http_code}\n"
curl -s https://demobank-credit.vercel.app -o /dev/null -w "%{http_code}\n"
```

Want `"ok":true` and two `200`s. If any of these fail, hold the post — don't
guess that it's "probably fine."

---

## This week's posting calendar

Five posts, one per day is fine, order isn't rigid — post whichever fits the
day. All character counts below use X's rule that any URL counts as 23
characters regardless of its real length, and all were re-verified live on
2026-09-05.

**Day 1 — "why only here."** New this week, ties directly to the video's new
Scene B:

```
Why does this only work on Creditcoin?

Three things had to be true at once: a chain whose subject is
already credit, no bridge or oracle standing between chains, and
verification cheap enough forever to run continuously.

Remove one, and there's no Dokett.
```

257 chars. Good screenshot: the `/developers/asc-integration` page's "0. Three
minutes" table.

**Day 2 — the encumbrance fact.** See #1 below — unchanged, still the
strongest concrete fact.

**Day 3 — DemoBank.** ⚠️ The version further down this file (§2) is **364
characters — over X's limit, never actually postable.** Use this one instead:

```
Nobody outside this project had queried Dokett's API. So we built
something that would.

DemoBank: separate app, no account, no key, no SDK. It reads the
register and declines a loan on its own policy, not Dokett's.

Facts, never a score.

demobank-credit.vercel.app
```

266 chars, verified.

**Day 4 — build-in-public: a bug caught before it hit video.** Shows the
rigor rather than asserting it:

```
Caught before it hit video: a demo scene said "three bonds, 0.00%
loss rate" for an underwriter. Checked it live — it's four now, from
a seed script we ran days earlier.

Every number gets re-verified against the chain the morning we
record. Not once, at the start.
```

265 chars. No screenshot needed — this one's about process, not a feature.

**Day 5 — the cost-curve nugget.** Same fact as the Medium post draft, standalone:

```
We measured it instead of trusting the spec: proving a 2-year-old
Ethereum fact on Creditcoin costs 26% more than a 20-minute-old one.

Not per year — total, across 51,529x the age.

That's what makes a permanent registry economically possible.
```

244 chars, re-verified against `docs/ASC-INTEGRATION.md` §3.3.

---

## Ready-to-post, verified today

### 1 — the encumbrance fact (best one right now)

```
A warehouse receipt on our testnet register carries three claims from
two lenders who cannot see each other's books.

"Is this collateral already pledged?" has no answer anywhere else in
crypto. Ours does — live, free, no account needed.

dokett-console.vercel.app
```

264 chars. Verified: asset `0x99bb578d…` carries claims #6, #7, #13, across
2 distinct creditor commitments. Re-check:

```bash
curl -s https://dokett-lens.fly.dev/encumbrance/0x99bb578da8417b0bb7adb587fb6e31712a4e123d8b1ff520fbb58c13834aad3f
```

Good screenshot: the Encumbrance page on the Console with that hash pasted in.

### 2 — DemoBank (the newest thing, and the most concrete)

> ⚠️ **This version is 364 characters — over X's 280 limit.** It was written
> before anyone actually counted it, so it was never postable as-is. Use the
> 266-char version in the Day 3 calendar entry above instead. Left here only
> so nobody re-derives the same too-long draft from the same idea.

Live and working. Click "Check Dokett" on that page, screenshot the query log
(7 requests, each shown with its URL) and the CREDIT DECLINED verdict.

### 3 — the engineering story

`docs/blog/medium-cold-start.md` is written and ready — a real bug (a page
size constant that was correct on day one and silently wrong eight days
later), told straight, no hype. Post the hook, link the rest:

```
My indexer ran fine for eleven days. It couldn't have survived a restart.

A constant that was correct when I wrote it, wrong eight days later,
with nobody touching the code.

[Medium link — ask Success for it once published]
```

---

## Things that are true but need exact wording

- **Test count: 90 passing** — 67 contract (Foundry) + 7 projection (Lens) + 16
  relay. Don't round up or say "100+."
- **The default-speed number is 2 minutes 15 seconds**, not 18 — this was
  corrected after measuring the actual on-chain timestamps. If you're quoting
  "how fast does it default," use 2m15s.
- **The gas/cost figures change** as the proven transaction ages (continuity
  proofs grow over time). Never memorize a gas number — screenshot it live or
  don't state it.
- Obligation IDs, underwriter loss rates, and claim counts are **live state**,
  not fixed. Re-pull before quoting one.

---

## Lines that would be false if posted — do not use

⚠️ **Never say Dokett is the only project doing X.** We said this once
("every other ASC project proves that something happened") and had to walk it
back after cybort360's COVENANT turned out to do the same inversion. The
current framing is comparative, not exclusive: *"most cross-chain verification
proves presence; we act on absence — and what you do with the absence is the
real design question."* Stick to that shape.

⚠️ **Never claim Dokett verifies anything on Base, Arbitrum, or any chain
other than Ethereum.** The build proves facts on exactly one source chain:
Ethereum mainnet, Attestcoin chainkey 3. This came up because the intro
animation names Base and Arbitrum as *examples of fragmentation* (the
problem) — that's fine — but the line proving them working is dashed, not
solid, specifically so nobody walks away thinking we verify those chains.
Same rule applies to posts: fragmentation examples are fine, verification
claims are not.

⚠️ **Don't name competing projects publicly**, even to say we're better.
Comparing ourselves by name to COVENANT, CovenantX, or index41 reads as
punching sideways in a 46-project field and isn't worth the risk. If you want
to differentiate, describe what Dokett does rather than what someone else
doesn't.

⚠️ **This is testnet with synthetic data.** Every post implying real money or
real borrowers should instead say "testnet" or "live testnet deployment."
Nothing here touches a real borrower's information.

⚠️ **Don't post the DoraHacks submission link until Success confirms it's
actually submitted.** As of this writing it isn't yet.

---

## Live links (safe to use anytime, all return 200 as of today)

```
Console      https://dokett-console.vercel.app
DemoBank     https://demobank-credit.vercel.app
Repo         https://github.com/successaje/Dokett
Read API     https://dokett-lens.fly.dev  (free, unauthenticated — /health,
                                            /obligation/:id, /solvency/:addr,
                                            /encumbrance/:ref, /underwriter/:addr)
```

## Brand assets

```
Mark (PNG, 512x512)     brand/dokett-mark.png
Avatar (PNG, 1024x1024) brand/dokett-avatar.png
Mark (SVG)              brand/dokett-mark.svg
```

All in the repo root under `brand/`.

---

## If you want to say something we haven't drafted

Run it by the two ⚠️ rules above — no exclusivity claims, no chain claims
beyond Ethereum — and otherwise you don't need approval. The project's whole
positioning is "claims should be checkable," so the actual bar is just: could
someone verify this by pasting a URL? If yes, post it.
