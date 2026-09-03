# Animation brief — Dokett, Part One (0:00–1:00)

Paste this whole file into your animation tool. It is written to stand alone.

**Attachments:** `dokett-mark.svg` (or the PNG avatar) and the Creditcoin logo.

---

## 1 · What this is for

A 60-second animated opening to a hackathon demo video. It runs **before** any
screen recording. There is a voiceover; the animation illustrates it and must
not compete with it.

**Dokett** is a credit registry built on Creditcoin. In one line: *a registry
where a promise to pay is a first-class on-chain object, and its status changes
only on cryptographic proof — never because someone said so.*

The argument the animation has to carry:

1. A lender asks a borrower "what do you already owe?"
2. Traditional finance has institutions that answer it.
3. On-chain, the borrower's debts sit in separate systems that cannot see one another.
4. So the question has nowhere to go.
5. Dokett is the shared record that answers it.

---

## 2 · Tone — read this before designing anything

This is **not** a crypto product launch. It is closer to a **documentary title
sequence** or the opening of a financial institution's annual report.

The product's own design system is built against crypto-marketing aesthetics.
Its stated rules are: *monochrome except where colour carries meaning; rules and
hairlines, not floating cards; serif for authority, mono for fact.* The animation
must obey the same rules or it will look like a different product.

**Reference feeling:** a ledger page, a court docket, a bureau file. Restrained,
precise, unhurried. Confidence through stillness.

### Hard bans

- ❌ No glowing blockchains, chain-link imagery, or floating cubes
- ❌ No neon, no purple-blue gradients, no glassmorphism
- ❌ No rocket, moon, upward arrows, coins, vaults, padlocks
- ❌ No stock footage of people, cities, or handshakes
- ❌ No particle swarms or "data streams"
- ❌ No fast cuts — nothing shorter than 2 seconds
- ❌ No camera shake, lens flare, or bloom

---

## 3 · Visual system

### Palette — use these exact values

| Role | Hex | Use |
|---|---|---|
| Ground | `#131418` | Background for the entire sequence |
| Ink | `#ece9e2` | Primary text and rules (warm off-white — **not** pure white) |
| Muted | `#8a867d` | Labels, secondary text |
| Faint | `#3d3f48` | Hairlines, inactive boundaries |
| Proven | `#1c6b48` → on dark use `#4fbc8a` | **Only** for verified/proof moments |

**Colour discipline:** the sequence is monochrome except for the proven-green,
which appears **twice at most** — when proof lands (shot 7) and on the final
connecting line (shot 8). If green appears anywhere else, it stops meaning
anything.

### Typography

- **Serif** — headline moments and the question. Georgia, Iowan Old Style, or
  any transitional serif with real weight contrast.
- **Monospace** — every number, address, amount, and label. Numbers must be
  tabular.
- **Small caps / letterspaced sans** — tiny labels above elements
  (`LOAN REQUEST`, `ETHEREUM`), ~10px equivalent, letterspacing 0.15em, in Muted.

### Motion

- Everything **draws, wipes, or fades**. Nothing bounces, springs, or overshoots.
- Easing: slow-out, gentle-in. Think ink absorbing into paper.
- Lines draw left-to-right or top-to-bottom, never randomly.
- Typical element entrance: 500–700ms. Nothing snappier.
- The camera is **static** unless a shot says otherwise. One slow pull-back is
  allowed, in shot 5.

---

## 4 · The Dokett mark

The mark is an **open C held by a vertical rule** — the promise stays open; the
rule is what holds it. Geometry (32×32 viewBox, stroke only, no fill,
round caps, stroke-width 2.4):

```
M21.8 9.8a9.2 9.2 0 1 0 0 12.4     ← the open C
M26.2 4.8v22.4                      ← the vertical rule
```

**When it appears (shot 7) it must draw, not fade** — the C first, then the rule
descending through it. That draw is the single most brand-specific moment in the
sequence. Give it a full second.

Wordmark: **Dokett** in the serif, with `REGISTER OF OBLIGATIONS` beneath in
letterspaced small caps, Muted.

---

## 5 · Shot list

Timings are from a measured voiceover at 150 wpm. `//` in the VO is a one-second
pause — hold the frame through it, do not fill it.

---

### Shot 1 · 0:00–0:08.5

> *"A business wants to borrow a million dollars. Before approving it, the lender asks the oldest question in finance."* //

Black ground. A single hairline rule draws horizontally across the lower third.
Above it, in mono, an amount types on character by character: **`$1,000,000`**.
A letterspaced label fades in beneath the rule: `LOAN REQUEST`.

Calm, centred, a lot of empty space. This should feel like a form, not a pitch.

---

### Shot 2 · 0:08.5–0:11.5

> *"What do you already owe?"* //

The amount and rule **dim to Faint** but stay visible. The question fades up
large and centred in **serif**, in Ink:

> **What do you already owe?**

This is the hero typographic moment of the sequence. Hold it. Nothing else moves.

---

### Shot 3 · 0:11.5–0:16

> *"In traditional finance, an apparatus exists to answer it."* //

Beneath the question, four small ruled boxes fade in **in sequence**, each
labelled in small caps: `BUREAUS` · `REGISTRIES` · `AUDITORS` · `COURTS`.

Thin lines draw from each box and **converge to a single point** below them. The
convergence completes cleanly.

The meaning to convey: *the question has an address. Something answers it.*

---

### Shot 4 · 0:16–0:25

> *"Now move that borrower on-chain. A loan on Ethereum. Collateral on a second chain. A tokenized asset on a third."* //

**Hard cut.** The converged structure vanishes — do not transition it, cut it.

Three larger boxes appear, **widely separated**, each entering exactly as the VO
names it:

| Box | Label (small caps) | Contents (mono, small) |
|---|---|---|
| Left | `ETHEREUM` | `LOAN · 1,000,000 USDC` |
| Centre | `BASE` | `COLLATERAL · LOCKED` |
| Right | `ARBITRUM` | `TOKENIZED ASSET` |

**Name the chains — and put their logos in these boxes, small, monochrome, at
the same weight as the label.** Naming them here is accurate and stronger than
`CHAIN B`: this shot is the *problem*, a borrower whose position really is
scattered across venues that cannot see each other. Concrete names make a judge
picture a real borrower instead of an abstraction.

> ⚠️ **These three names carry a constraint into shot 8.** Dokett proves facts
> on **one** source chain — Ethereum mainnet, Attestcoin chainkey 3. Nothing in
> this build touches Base or Arbitrum. They are honest as a depiction of
> fragmentation and dishonest the moment a proof line connects them. See the
> warning in shot 8, which is not optional.

Each box is lit faintly **from inside** — its own contents are legible and
crisp. Crucially: **no line connects any box to any other.** The empty space
between them is the subject of the shot.

---

### Shot 5 · 0:25–0:31.5

> *"Each system sees its own slice perfectly. None of them can see the others."* //

Slow pull-back (10% at most). Inside each box, small ledger rows resolve into
sharp focus — each system's own data is perfect.

Then: a thin line attempts to draw from the left box toward the centre box. It
reaches the boundary and **stops, then fades out.** Repeat once between centre
and right, slightly offset in time.

The failed connection is the entire point. Do not let any line complete.

---

### Shot 6 · 0:31.5–0:38

> *"So the question gets asked — and there is nowhere to send it."* //

The question from shot 2 returns, small, at the top of frame in serif.

A single query line travels down from it, passes through the empty space
*between* the boxes touching none of them, and terminates in open dark. At its
end, a blinking mono cursor with nothing after it.

Hold on the cursor. Let it blink two or three times. This is the emptiest frame
in the sequence and it should feel like one.

---

### Shot 7 · 0:38–0:50

> *"This is Dokett. A registry where a promise to pay is a first-class on-chain object, and its status changes only on cryptographic proof. Never because someone said so."* //

Everything clears to black. One full beat of nothing.

**The mark draws** — open C first, then the vertical rule descending through it.
Wordmark resolves beside it: **Dokett**.

Then the mark moves up and out of the way, and a **record card** builds beneath
it as ruled rows — a document, not a UI panel:

```
OBLIGOR       0x7f3a…c21b        (mono, Muted)
PRINCIPAL     1,000,000 USDC
SCHEDULE      3 periods
STATUS        ACTIVE
```

On *"cryptographic proof"*: a small proof glyph — a seal, or a checked box —
lands on the card in **Proven green**, and `STATUS` transitions `ACTIVE →
CURRENT`. The status word changes **only** when the glyph lands. Nothing else
in frame is green.

On *"Never because someone said so"*: everything holds still.

---

### Shot 8 · 0:50–1:00

> *"Creditcoin knows how to record credit. Attestcoin lets it see across chains. Dokett turns what it can see into a shared, verifiable record of obligations."*

The three isolated boxes from shot 4 return, dimmed to Faint, in their original
positions.

- On **"Creditcoin"** — the Creditcoin logo (attached) fades in at the lower
  left, small and understated.
- On **"lets it see across chains"** — a line draws left to right beneath the
  boxes in Proven green. This is the payoff of the whole sequence and the only
  long green element. Let it take the full length of the phrase.

  > ⚠️ **The line is solid under `ETHEREUM` and dashed under `BASE` and
  > `ARBITRUM`.** Dokett proves one source chain: Ethereum mainnet, chainkey 3.
  > A solid line under all three states, in the most memorable form available,
  > that this build verifies Base and Arbitrum. It does not. The same reasoning
  > keeps both chains out of the submission's Layer-2 field.
  >
  > Dashing them costs nothing and gains something: it distinguishes what ships
  > from what the primitive extends to, which is the distinction a judge is
  > looking for and rarely finds.

- As the line passes under **`ETHEREUM`**, that box brightens from Faint to full
  **Ink** and takes the proof seal from shot 7. `BASE` and `ARBITRUM` lift only
  part-way — visibly reached, not yet verified.
- One caption, Muted mono, beneath the line, held for the phrase:

  ```
  ETHEREUM · CHAINKEY 3 · LIVE          BASE · ARBITRUM — AS ATTESTCOIN ATTESTS THEM
  ```
- On **"a shared, verifiable record of obligations"** — the boxes and line
  recede, and the Dokett wordmark resolves centred with
  `REGISTER OF OBLIGATIONS` beneath.

Final frame holds two seconds on the wordmark, then cuts to the screen recording.

---

## 6 · Logo usage

- **Dokett mark** — Ink `#ece9e2` on the dark ground. Never recoloured, never
  on a filled shape, never with a glow. It draws once, in shot 7.
- **Creditcoin logo** — attached. Use its own official colours, but keep it
  **small and secondary**. It appears once, in shot 8, and is never larger than
  the Dokett wordmark. This is a Dokett video that credits Creditcoin, not a
  co-branded one.
- Do not place the two logos side by side at equal size at any point.
- **Chain logos (Ethereum, Base, Arbitrum)** — shots 4–6 and 8 only, inside
  their boxes, small and monochrome so they read as labels rather than
  endorsements. Pull them from each project's official brand kit rather than an
  image search: these are live trademarks, and the usable versions are published
  precisely so nobody has to guess. Never larger than the Dokett wordmark, and
  never on the final frame — the last thing on screen is Dokett alone.

---

## 7 · Failure modes to check before delivering

**Check this one first.** Freeze on the last frame of shot 8. If a viewer who
knows nothing about the project would conclude that Dokett verifies Base and
Arbitrum today, the shot is wrong regardless of how good it looks. Solid line
and proof seal on Ethereum only; dashed elsewhere.

- Does anything bounce or overshoot? → wrong, it should absorb
- Is green used anywhere other than shot 7's proof and shot 8's line? → remove it
- Do any of the three boxes connect before shot 8? → the whole argument breaks
- Is any cut shorter than 2 seconds? → slow it down
- Is the background pure black `#000` or the text pure white `#fff`? → use
  `#131418` and `#ece9e2`; the warmth is the brand
- Does it look like it could be advertising an exchange? → start over
