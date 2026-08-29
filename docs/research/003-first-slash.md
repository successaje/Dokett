# Dokett Research #003
### The first time first-loss capital was actually slashed

**27 Aug 2026 · live CC3 testnet, every transaction linked below**

---

## The gap we found in our own project

Dokett's market thesis is that underwriting a named borrower is a real,
priced, adversarially-tested opinion — because when that borrower defaults, the
underwriter's capital is slashed automatically, by evidence, with no committee
and no vote. It is the sentence that separates this from every on-chain credit
score that came before.

That mechanism had never fired.

Not once, on-chain. Both defaulted obligations in the register carried no bonds,
so both honestly reported `slashed: 0`. The two live bonds sat on obligations
that would not default for weeks. `Bond.slash` existed in the unit suite and
nowhere else.

A protocol whose central economic claim is untested in production has not really
demonstrated its central economic claim. So we tested it.

## The sequencing problem

`Bond.post` refuses anything that is not `Active` or `Current`, and the live
keeper marks a closed-window obligation `Delinquent` within about sixty seconds.
So a bond cannot be posted against an already-delinquent obligation, and
registering with an already-closed window means racing the keeper's sweep.

Rather than race it, we registered with the window closing ~30 blocks in the
future. That bought several minutes to mint, approve and post the bond while the
obligation was legitimately still `Active` — and then everything downstream
happened on its own.

## What happened, unattended

```
registered #11              window closing in ~30 blocks, status Active
posted bond #3              250 mUSDC first-loss, while still Active
window closed               keeper marked it Delinquent
attested head passed cure   keeper finalised the default AND slashed
```

| | Tx |
|---|---|
| Registered | [`0x5801c2fd…50cef473`](https://creditcoin-testnet.blockscout.com/tx/0x5801c2fdfb9d8f04c1b016c32934ade1e5f4eabdfd06591884c3a04750cef473) |
| Bond posted | [`0x345d4034…382966d4`](https://creditcoin-testnet.blockscout.com/tx/0x345d4034eb1a32aa5d35266b45d1c9f2e3a29e0271f7d6bd9c2c8222382966d4) |
| **Default + slash** | [`0x952c03ff…8e2d480d`](https://creditcoin-testnet.blockscout.com/tx/0x952c03ffa363ce8f0fe4eab397636f5aebc1b139380cfabd756ead678e2d480d) |

Both the `Defaulted` and `BondSlashed` events were emitted **in the same
transaction**. The default was not recorded and then settled later by some
separate process — finalising the default *is* the slash, atomically, in one
call made by an unattended keeper.

```
Defaulted    id=11  outstanding=1000000000  slashed=250000000
BondSlashed  bond=3 amount=250000000        payee=0x60eF…8e87
```

## The number that matters is the one that is now non-zero

Before:

```
bondsWritten 2 · totalPosted 3,000 · totalSlashed 0 · lossRate 0.00%
```

After:

```
bondsWritten 3 · totalPosted 3,250 · totalSlashed 250 · lossRate 7.69%
```

That loss rate is not a score anyone assigned. It is `slashed ÷ posted`,
recomputed from bond events by anyone with an RPC endpoint, and it cannot be
edited — including by us. This is the difference between a reputation that is a
*view over history* and a reputation that is a mutable number in someone's
database. Every prior attempt at on-chain credit shipped the second thing.

## The bond was deliberately smaller than the debt

`slash` takes `min(outstanding, posted)`. We sized the bond at 25% of principal —
250 mUSDC against 1,000 — precisely so the slash would **not** make the creditor
whole.

The creditor received the entire first-loss position and is still 750 mUSDC
short. That is what first-loss capital is: it absorbs the first tranche of a
loss, not the loss. A demo sized so the bond covers the whole debt would have
implied a guarantee this protocol does not offer, and the number on screen would
have quietly told a lie about the instrument.

## What this still does not prove

The default itself rests on proof of *absence*, with all the limits we have
stated before: what is proven on-chain is that no admissible proof of payment was
presented before the deadline, not that no payment occurred. See
[Research #002](./002-autonomous-default.md).

The underwriter here is also the registrar and the creditor payout address —
this is a testnet demonstration of a mechanism, not a market with independent
participants. What is genuinely demonstrated is narrower and still worth having:
**the slashing path executes end to end, on a real chain, triggered by nothing
but an attested foreign-chain height.**

## Reproduce it

```
npm run seed:slash          # registers, posts a bond, then leaves it alone
curl -s https://dokett-lens.fly.dev/obligation/11
curl -s https://dokett-lens.fly.dev/underwriter/0x60eF148485C2a5119fa52CA13c52E9fd98F28e87
```

Roughly twenty minutes of real Ethereum block production, entirely unattended.

---

*Dokett is a registry where an obligation's status advances only on
cryptographic proof of a foreign-chain event, or a comparison against an
attested foreign-chain height — never on anyone's word. Built on Creditcoin
Attestcoin Smart Contracts. [Source](https://github.com/successaje/Dokett).*
