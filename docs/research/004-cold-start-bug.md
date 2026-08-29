# The bug that only exists when you redeploy

**29 August 2026**

Our indexer had been running without a hiccup for eleven days. It could not have
survived a restart for at least the last two of them, and I only found out
because I was doing something completely unrelated.

---

## The boring part

We renamed the project. Another team in the same hackathon had picked the same
name, which is a bad problem to discover late, so I spent an afternoon doing the
least interesting work there is: find and replace, regenerate some images, create
new Fly apps with the new names, deploy, verify, cut over.

The relay came up first try. Then the indexer — we call it the Lens — went into
a crash loop.

> **[IMAGE 1]** — Screenshot of the Fly logs showing `machine has reached its max
> restart count of 10`. The repeated restart lines are the point; you want the
> reader to see it looping.

The error underneath was clear enough:

```
eth_getLogs
  fromBlock: 0x51400b   (5,324,811)
  toBlock:   0x52035a   (5,374,810)
→ query timeout of 10 seconds exceeded
```

Forty-nine thousand nine hundred and ninety-nine blocks in a single call. Of
course that timed out.

So I went to look at what I'd broken during the rename. The answer was nothing.
I hadn't touched the indexer. I checked twice, because that's the sort of claim
you want to be sure about before you go looking somewhere harder.

Then I checked the old app — the one still running under the old name, same
image, same commit, same everything.

It was completely fine. Serving requests, eleven days of uptime, no errors.

Same code. One instance healthy, one instance unable to boot.

---

## Where the difference actually was

The Lens walks the chain in pages. Reasonable design, and the comment above it
even said so:

```js
/** Paged log query. One wide range is what the node refuses. */
```

The page size came from a config value with a default:

```js
this.chunk = Number(addresses.chunk || 50_000);
```

Fifty thousand blocks. When I wrote that, it was obviously fine. The contracts
had been deployed about an hour earlier. There were maybe a few hundred blocks
between the deploy block and the head, so the "page" was the entire history and
the query came back instantly.

CC3 produces a block roughly every fifteen seconds. Fifty thousand blocks is
about **8.7 days**.

And here's the part I find genuinely interesting. The loop clips the first page
to the actual head:

```js
const to = Math.min(from + this.chunk - 1, head);
```

So the query didn't jump to 50,000 blocks. It *grew*. Every day the service ran,
a fresh boot would have asked for a slightly wider range than the day before —
one day, five days, eight days of history — until it hit the ceiling and stopped
growing.

Nobody rebooted it, so nobody found out.

The running process had a warm cursor and was only ever fetching new blocks a
handful at a time. It was healthy for exactly the same reason it was hiding the
problem: it never had to do the thing that was broken.

---

## I assumed there was a threshold. There isn't.

My first instinct was to find where it tips over and set the constant below it.
So I measured, against the real chain, the real contract, the real topic:

| Range | Result |
|---|---|
| 5,000 blocks | ok, 2,105 ms |
| 10,000 | ok, 4,601 ms |
| 20,000 | **timeout**, 10,232 ms |
| 30,000 | ok, 8,762 ms |
| 40,000 | **timeout** |
| 50,000 | **timeout** |

Twenty thousand failed. Thirty thousand passed. That's not a threshold, that's
noise, so I ran it again. Three more times:

```
trial 1   10k: ok 3354ms    20k: ok 8160ms    30k: FAIL      40k: FAIL
trial 2   10k: FAIL         20k: ok 5475ms    30k: FAIL      40k: FAIL
trial 3   10k: ok 2611ms    20k: FAIL         30k: ok 6723ms 40k: ok 8293ms
```

Look at the 10,000-block column. Two and a half seconds, then a timeout, then
three seconds. Same query. And in trial 3, forty thousand blocks came back in
8.3 seconds — a range that had failed twice already.

> **[IMAGE 2]** — This table as a simple chart: range on the x-axis, response time
> on the y-axis, one dot per trial, a red line at 10s. The scatter is the message —
> the dots don't form a curve, they form a cloud that drifts upward.

There is no clean cutoff. The node is racing a ten-second wall clock, and whether
any given request beats it depends on how busy the node happens to be right then.
As the range grows you're not crossing a line, you're just losing the race more
often.

Which killed my planned fix. If I'd set the chunk to 10,000 and tested it once, I
might have hit trial 3's 2,611 ms and shipped feeling good. Trial 2 says that
same value times out. Any constant I pick is a bet on node load, and I'd be
placing it once, at deploy time, on behalf of every future cold start.

---

## What we did instead

The keeper — a different service in the same repo — already had this right, and
had for weeks. When its log scan gets refused, it halves the range and tries
again until something works.

I'd written that. I just never carried it across.

```js
while (span >= 1) {
  try {
    page = await this.bond.queryFilter(filter, from, from + span - 1);
    break;
  } catch (err) {
    if (span === 1) throw err;   // a single block it can't answer is real
    span = Math.floor(span / 2);
  }
}
```

That's it. Start optimistic, back off on failure, and let the range be whatever
the node will actually accept *at that moment* rather than whatever seemed
sensible on the day the code was written. A single block that still fails gets
rethrown, because at that point something genuinely is wrong and swallowing it
would be worse.

New indexer came up clean. Both instances now report the same eleven
obligations with the same status distribution, which is what I wanted to see
before pointing anything at the new one.

> **[IMAGE 3]** — Terminal output showing the two lenses side by side returning
> identical results. Optional. Include it only if you want the "verified rather
> than assumed" beat; the post survives without it.

---

## The shape of it

The thing worth taking away isn't about block ranges.

It's that **a constant can have a shelf life**, and nothing in your tooling
tracks it. `50_000` was correct when written. It became wrong through no change
to the code, no deploy, no config edit — just time passing. There's no linter for
that. Nothing in code review catches it, because at review time it *is* right.

And the second half is worse: **long uptime hides exactly this class of bug.**
A service that has been up for weeks is not evidence its startup path works. It's
the opposite — the longer it runs, the more time the startup path has had to rot
untested, and the more confident everyone gets because the dashboards are green.

We would have found this eventually. My guess at when: the morning of the demo
recording, when someone redeployed for an unrelated reason and the thing that
had worked for eleven days suddenly didn't. That's usually how it goes.

Places to look for your own version of this:

- Anything paginating over a range that starts at a fixed point and ends at "now"
- Retention or cleanup jobs sized for the data volume at launch
- Cache warms and backfills that assume they'll finish in a deploy window
- Timeouts tuned against a table that had a thousand rows in it
- Any constant chosen when a system was young, in a system that isn't young now

The cheap test costs nothing: **restart a healthy service on purpose.** Not
because you think it's broken. Because you don't.

---

*Dokett is a registry where an obligation's status advances only on cryptographic
proof of a foreign-chain event, or a comparison against an attested foreign-chain
height — never on anyone's word. Built on Creditcoin Attestcoin Smart Contracts.
[Source](https://github.com/successaje/covenant).*
