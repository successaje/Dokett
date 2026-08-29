# My indexer ran fine for eleven days. It couldn't have survived a restart.

*Subtitle for Medium: A constant that was correct when I wrote it, and wrong
eight days later, without anyone touching the code.*

---

I found this while doing the most boring work there is.

I'd been building a credit registry for a hackathon, and I had to rename the
whole project — another team had picked the same name, which is a bad thing to
discover late. So: find and replace, regenerate some images, spin up new servers
under the new names, deploy, verify, cut over. An afternoon of nothing
interesting.

The first service came up on the first try. The second one — an indexer that
walks the chain and serves a read API — went into a crash loop.

> **[IMAGE 1 — optional]** Screenshot of the deploy logs showing
> `machine has reached its max restart count of 10`. The repeating lines are the
> point. Skip this if you didn't capture it; the error block below carries the
> scene on its own.

The error underneath was clear enough:

```
eth_getLogs
  fromBlock: 5,324,811
  toBlock:   5,374,810
→ query timeout of 10 seconds exceeded
```

Forty-nine thousand nine hundred and ninety-nine blocks in one request. Obviously
that timed out.

So I went looking for what I'd broken during the rename. The answer was nothing.
I hadn't touched the indexer at all. I checked twice, because that's the kind of
claim you want to be sure about before you go looking somewhere harder.

Then I checked the old server — still running under the old name, same image,
same commit, same everything.

Completely fine. Serving requests. Eleven days of uptime. No errors.

Same code. One instance healthy, one unable to boot.

## Where the difference actually was

The indexer walks the chain in pages, which is the right idea. There was even a
comment saying so:

```
/** Paged log query. One wide range is what the node refuses. */
```

The page size came from a config value with a default:

```
this.chunk = Number(addresses.chunk || 50_000);
```

Fifty thousand blocks. When I wrote that line it was obviously fine. The
contracts had gone live about an hour earlier, so there were maybe a few hundred
blocks of history. The "page" was the entire chain and the query came back
instantly.

This chain produces a block roughly every fifteen seconds. Fifty thousand blocks
is about **8.7 days**.

Here's the part I find genuinely interesting. The loop clips the first page to
wherever the chain currently is:

```
const to = Math.min(from + this.chunk - 1, head);
```

So the query never jumped to 50,000 blocks. It *grew*. Every day the service ran,
a fresh boot would have asked for a slightly wider range than the day before. One
day of history. Five days. Eight days. Until it hit the ceiling and stopped
growing.

Nobody restarted it, so nobody found out.

The running process had a warm cursor and was only ever fetching a handful of new
blocks at a time. It was healthy for precisely the same reason it was hiding the
problem: it never had to do the thing that was broken.

## I assumed there was a threshold. There isn't.

My instinct was to find where it tips over and set the constant safely below it.
So I measured — real chain, real contract, same query the indexer makes:

```
  range      result
  5,000      ok        2,105 ms
  10,000     ok        4,601 ms
  20,000     TIMEOUT  10,232 ms
  30,000     ok        8,762 ms
  40,000     TIMEOUT
  50,000     TIMEOUT
```

Twenty thousand failed. Thirty thousand passed.

That's not a threshold, that's noise. So I ran it three more times:

```
  trial 1    10k: ok 3,354ms   20k: ok 8,160ms   30k: FAIL        40k: FAIL
  trial 2    10k: FAIL         20k: ok 5,475ms   30k: FAIL        40k: FAIL
  trial 3    10k: ok 2,611ms   20k: FAIL         30k: ok 6,723ms  40k: ok 8,293ms
```

Look at the 10,000 column. Two and a half seconds. Then a timeout. Then three
seconds. Identical query. And in trial 3, forty thousand blocks came back in 8.3
seconds — a range that had already failed twice.

> **[IMAGE 2 — the one to actually make]** This data as a scatter plot. Range on
> the x-axis, response time on the y-axis, one dot per trial, a red line at 10
> seconds. The message is that the dots don't form a curve — they form a cloud
> that drifts upward. If you make one image for this post, make it this one.

There is no clean cutoff. The node is racing a ten-second wall clock, and whether
a given request beats it depends on how busy that node happens to be right then.
As the range grows you aren't crossing a line, you're just losing the race more
often.

Which killed my planned fix. If I'd set the page size to 10,000 and tested it
once, I might have hit trial 3's 2,611 ms and shipped feeling pleased with
myself. Trial 2 says that exact value times out. Any constant I choose is a bet
on server load — and I'd be placing it once, at deploy time, on behalf of every
future restart.

## What I did instead

Another service in the same repo already handled this correctly, and had for
weeks. When its scan gets refused, it halves the range and tries again until
something works.

I wrote that one too. I just never carried the idea across.

```
while (span >= 1) {
  try {
    page = await queryFilter(filter, from, from + span - 1);
    break;
  } catch (err) {
    if (span === 1) throw err;   // a single block it can't answer is real
    span = Math.floor(span / 2);
  }
}
```

That's the whole fix. Start optimistic, back off on failure, and let the range be
whatever the server will actually accept *at that moment* rather than whatever
seemed sensible on the day the code was written. If it still fails on a single
block, that gets thrown — at that point something is genuinely wrong and
swallowing it would be worse than crashing.

The new indexer came up clean.

## The shape of it

The takeaway isn't about block ranges.

It's that **a constant can have a shelf life, and nothing in your tooling tracks
it.** `50_000` was correct when I wrote it. It became wrong with no code change,
no deploy, no config edit — just time passing. There's no linter for that. Code
review can't catch it, because at review time it genuinely is right.

And the second half is worse: **long uptime hides exactly this class of bug.** A
service that's been up for weeks is not evidence that its startup path works. If
anything it's the opposite — the longer it runs, the more time that path has had
to rot untested, and the more confident everyone gets, because the dashboards are
green and nothing is on fire.

I'd have found this eventually. My honest guess at when: the morning I sat down
to record the demo, when I redeployed for some unrelated reason and the thing
that had worked for eleven days suddenly didn't.

Worth checking for your own version of this:

- Anything paginating a range that starts at a fixed point and ends at "now"
- Cleanup or retention jobs sized for the data volume at launch
- Backfills and cache warms that assume they'll finish inside a deploy window
- Timeouts tuned against a table that had a thousand rows in it
- Any constant chosen when a system was young, in a system that isn't young now

The cheapest test I know costs nothing. **Restart a healthy service on purpose.**
Not because you think it's broken. Because you don't.

---

*I'm building [Dokett](https://github.com/successaje/covenant), a cross-chain
registry for credit obligations. This one came out of a rename I was only doing
because someone else had the same idea about a name.*
