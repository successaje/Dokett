# Dokett Research #002
### We watched an obligation default. Nobody reported it.

**19 Aug 2026 · live CC3 testnet, real transactions linked below**

---

## The claim we needed to test

Dokett's core mechanism is an inversion. Every ASC-based project we've seen
proves that something *happened*. Dokett's `SilenceAdapter` is built to act
on what *didn't* — an obligation degrades to delinquent, and then to default,
purely because no admissible proof of payment arrived before a deadline. No
reporter, no committee, no oracle operator, no human in the loop at any point.

That's a claim worth being skeptical of, so we didn't just ship it — we watched
it happen, end to end, on a deployment we don't touch by hand.

## The setup

Dokett only ever *reads* foreign-chain evidence — it never needs to originate
a payment to demonstrate a scenario. So we registered an obligation whose
window was already closed at the moment of registration: a real economic
promise, just with deliberately short terms (an ~8-minute window, ~7-minute
cure — a payday-loan-style schedule, not the ~30-day terms our other seeded
obligations use). Everything downstream — the liveness gate, the keeper, the
proof of absence — runs the identical code path either way; only the schedule
differs.

Critically, this was only possible because our keeper — running unattended on
Fly.io, watching the attested Ethereum head every ~2 minutes — had already
built an unbroken hour of observation. Dokett's liveness invariant
(`penaltiesEnabled`) refuses to allow any penalty at all until that record is
continuous; a keeper that stalls or restarts mid-record has to start the clock
over. We didn't route around that requirement to make this demo convenient —
we waited for it, honestly, like any real deployment would have to.

## What happened, with no one watching

```
12:25:45Z  Obligation #5 registered — window already past minConfirmations
12:26:00Z  Delinquent  — keeper sweep, first cycle after registration
12:28:00Z  Default     — keeper sweep, cure window expired
```

**2.3 minutes, two autonomous sweeps, one keeper address
(`0x9BACF134…5a032`), zero manual transactions.**

| Transition | Tx |
|---|---|
| Registered | [`0x7da80af3…9eb9fc8`](https://creditcoin-testnet.blockscout.com/tx/0x7da80af3fcedc969167c1ad4cc818f513e30deef555581ad7a195f83e9eb9fc8) |
| → Delinquent | [`0x72127e0d…7202789`](https://creditcoin-testnet.blockscout.com/tx/0x72127e0d2db87c381e266be69f6c9dac90585d04b471a0cd57c0425bf7202789) |
| → Default | [`0x7ce07a2e…9a61f7d`](https://creditcoin-testnet.blockscout.com/tx/0x7ce07a2ec62b1b41bce4565784c51a97d57b6a1b7b5933a84724960759a61f7d) |

## What Dokett does *not* claim here, and why that matters

You cannot prove a negative with an inclusion proof. There is no cryptographic
primitive for "no transaction matching X exists in blocks N…M," and Dokett
does not pretend otherwise. The `Delinquent` transition is not a proof that no
payment happened — it's a verifiable, on-chain fact: *no admissible proof of
payment was presented before the deadline passed.* That's a narrower claim, and
it's the correct one.

It's also economically sound as a stand-in for non-payment. Proving a payment
costs a fraction of a cent (see [Research #001](./001-attestcoin-cost-model.md)) — cheap enough that the
borrower, the creditor, or a stranger farming keeper bounties all have reason
to submit one if it exists. And it's reversible: a proof whose *source-chain
height* falls inside the missed window still cures the obligation however late
it's submitted. Nobody has to volunteer bad news, and nobody can suppress it —
but if the record is wrong, it fixes itself.

## The honest gap this run exposed

`Defaulted` reports `slashed: 0`. No underwriter had posted first-loss capital
against this specific obligation, so there was nothing to slash — the
(synthetic) creditor simply absorbed the loss directly, exactly as the
protocol is designed to represent when no one has priced the risk. We caught
our own Console asserting a slash had occurred on a different, similarly
unbonded default before this one shipped — a hardcoded docket line that never
checked actual bond state. Fixed and verified live before this report was
written, because a project whose thesis is "never assert what the data doesn't
back" doesn't get to make that mistake quietly.

## Reproduce it yourself

```
curl -s https://dokett-lens.fly.dev/obligation/5
```

Or watch it live in the [Console](https://dokett-console.vercel.app/#/obligation/5) —
every transition links to its transaction, and the lifecycle rail shows exactly
which step you're looking at.

---

*Dokett is a registry where an obligation's status advances only on
cryptographic proof of a foreign-chain event, or a comparison against an
attested foreign-chain height — never on anyone's word. Built on Creditcoin
Attestcoin Smart Contracts. [Source](https://github.com/successaje/Dokett).*
