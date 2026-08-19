# Social drafts

Not for the repo's technical audience — these are copy-paste-ready for X /
Discord. Every number is pulled from a real transaction; don't edit the
figures without re-verifying against the source (`npm run prove:one <tx>`).

---

## 1. The standalone proof post (post this first)

> We just verified a real Ethereum mainnet USDC transfer inside a smart
> contract on Creditcoin.
>
> No bridge. No Ethereum-side contract. No centralized oracle.
>
> Attestcoin proof → Creditcoin verification, in one block.
>
> 375,746 gas. 0.000187873 CTC. ~$0.0001.
>
> tx: 0x85234a5dc158c402adfd384be8800969d570357611a1b59f3326098affc18fc4
>
> This is the evidence layer we're building [Covenant] on top of — a registry
> where an obligation moves only when a foreign-chain event is proven, never
> because someone said so.
>
> [screen recording of the verification]

*Thread continuation (optional second tweet):*

> The interesting part isn't that it works once. It's that we measured the
> cost curve as facts get older — 20 minutes vs 2 years old — and it barely
> moves. Full writeup: [link to Research #001]

---

## 2. Research #001 teaser (cost model)

> Creditcoin publishes a cost formula for verifying a foreign-chain event
> through Attestcoin. We didn't take it on faith — we measured it, on 5 real
> Ethereum transactions spanning 20 minutes to 2 years old.
>
> Result: proving a 2-year-old fact costs 26% more than a 20-minute-old one.
> Not 26% per year. 26% total.
>
> That's the whole economic argument for building a permanent registry here.
>
> We also found where our own number disagreed with Creditcoin's published
> one (7.4x higher) — and why that's not an error, it's a scope difference
> worth explaining.
>
> Full report: [link]

---

## 3. Research #002 teaser (autonomous default)

> We registered an obligation, then did nothing.
>
> 2.3 minutes later it was in default — marked delinquent, then defaulted,
> entirely by an unattended keeper watching Ethereum. No one reported the
> missed payment. No committee voted. No oracle operator was involved.
>
> Two transactions, one bot, zero humans:
> [delinquent tx] → [default tx]
>
> This is what "nobody has to volunteer bad news" looks like on-chain.
>
> Full trace: [link]

---

## 4. If asked "is this just a hackathon project"

> We'd rather show you than tell you. Every number we post is a real
> transaction you can check yourself — that's deliberate. A credit registry
> that asks you to trust its own claims has already failed at the one thing
> it exists to do.

---

## Style notes for future posts in this series

- Every claim needs a linked tx hash or a `curl`-able endpoint. No exceptions.
- Never call a heuristic pattern an "obligation." That word means one specific
  thing in this system: a registered, bonded claim. Don't dilute it for a
  better headline.
- State the honest limitation in the same post as the finding, not as a
  follow-up. (See Research #002's "slashed: 0" section — that's the model.)
- No "🚀 introducing" energy. The brand is "we investigated this," not
  "believe us."
