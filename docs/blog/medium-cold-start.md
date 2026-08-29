# My indexer ran fine for eleven days. It couldn't have survived a restart.

*Subtitle for Medium: A constant that was correct when I wrote it, and wrong
eight days later, without anybody touching the code.*

---

I found this while doing the most boring work there is.

I've been building a credit registry for BUIDL CTC 2026 Fall, Creditcoin's
hackathon, and I had to rename the whole project. Another team had submitted
under the same name, which is not a great thing to notice with a week to go. So I
spent an afternoon on find and replace, regenerating images, creating new servers
under the new names, deploying, cutting over. Nothing interesting.

The first service came up on the first try. The second one, an indexer that walks
the chain and serves a read API, went into a crash loop.

> **[IMAGE 1, optional]** Screenshot of the deploy logs showing
> `machine has reached its max restart count of 10`. Only include it if you
> captured it. The error block below does the same job.

The error was clear enough:

```
eth_getLogs
  fromBlock: 5,324,811
  toBlock:   5,374,810
→ query timeout of 10 seconds exceeded
```

Forty-nine thousand nine hundred and ninety-nine blocks in one request. Obviously
that timed out.

So I went looking for what I'd broken during the rename, and the answer was
nothing. I hadn't touched the indexer. I checked twice, because that's the sort
of thing you want to be sure about before you start looking somewhere harder.

Then I checked the old server. Still running under the old name, same image, same
commit.

Fine. Serving requests, eleven days of uptime, no errors.

Same code. One instance healthy, one unable to boot.

## Where the difference was

The indexer walks the chain in pages, which is the right idea, and there was even
a comment saying so.

```
/** Paged log query. One wide range is what the node refuses. */
```

The page size came from a config value with a default.

```
this.chunk = Number(addresses.chunk || 50_000);
```

Fifty thousand blocks. When I wrote that line it was fine. The contracts had gone
live about an hour earlier, so there were a few hundred blocks of history. The
page was the entire chain and the query came back instantly.

This chain produces a block every fifteen seconds or so. Fifty thousand blocks is
about 8.7 days.

The loop clips the first page to wherever the chain currently is:

```
const to = Math.min(from + this.chunk - 1, head);
```

So the query never jumped straight to 50,000 blocks. It grew. Every day the
service ran, a fresh boot would have asked for a slightly wider range than the
day before. One day of history, then five, then eight, until it hit the ceiling
and stopped growing.

Nobody restarted it, so nobody found out.

The running process had a warm cursor and was only fetching a handful of new
blocks at a time. It was healthy for the same reason it was hiding the problem.
It never had to do the thing that was broken.

## I assumed there was a threshold

My first instinct was to find where it tips over and set the page size below it.
So I measured. Real chain, real contract, the same query the indexer makes:

```
  range      result
  5,000      ok        2,105 ms
  10,000     ok        4,601 ms
  20,000     TIMEOUT  10,232 ms
  30,000     ok        8,762 ms
  40,000     TIMEOUT
  50,000     TIMEOUT
```

Twenty thousand failed and thirty thousand passed, which is not a threshold. So I
ran it three more times.

```
  trial 1    10k: ok 3,354ms   20k: ok 8,160ms   30k: FAIL        40k: FAIL
  trial 2    10k: FAIL         20k: ok 5,475ms   30k: FAIL        40k: FAIL
  trial 3    10k: ok 2,611ms   20k: FAIL         30k: ok 6,723ms  40k: ok 8,293ms
```

Look at the 10,000 column. Two and a half seconds, then a timeout, then three
seconds. Same query every time. And in trial 3, forty thousand blocks came back
in 8.3 seconds after failing twice.

![Scatter plot of query range against response time. Successes are green
circles, timeouts are red crosses sitting just above a dashed 10-second line.
The points do not form a curve.](cold-start-scatter.png)

*Every dot is a real call. The crosses aren't slow responses, they're where the
client gave up.*

There's no cutoff to find. The node is racing a ten second wall clock and whether
a request beats it depends on how busy that node is at the time. As the range
grows you aren't crossing a line, you're just losing more often.

Which killed the fix I had planned. If I'd set the page size to 10,000 and tested
it once, I might have got trial 3's 2,611 ms and shipped feeling pleased with
myself. Trial 2 says that same value times out. Any constant I pick is a bet on
server load, placed once, at deploy time, on behalf of every restart that
happens afterwards.

## What I did instead

Another service in the same repo already handled this properly and had done for
weeks. When its scan gets refused it halves the range and tries again until
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

That's the whole fix. Start optimistic, back off on failure, let the range be
whatever the server accepts at that moment rather than whatever looked sensible
on the day the code was written. If it still fails on one block, throw, because
by then something is actually wrong and swallowing it would be worse than
crashing.

New indexer came up clean.

## The general version

This isn't really about block ranges.

It's that a constant can have a shelf life and nothing in your tooling tracks it.
`50_000` was correct when I wrote it. It became wrong with no code change, no
deploy, no config edit. Just time passing. There's no linter for that, and code
review can't catch it, because at review time it is right.

The second half is worse. Long uptime hides this exact class of bug. A service
that's been up for weeks is not evidence that its startup path works. It's closer
to the opposite: the longer it runs, the more time that path has to rot untested
while everyone gets more confident, because the dashboards are green and nothing
is on fire.

I'd have found it eventually. Probably the morning I sat down to record the demo,
when I redeployed for some unrelated reason and the thing that had worked for
eleven days suddenly didn't.

If you want to check for your own version, the pattern to look for is anything
sized against how much data existed when you wrote it. Pagination that starts at
a fixed point and ends at "now". Cleanup jobs. Backfills that assume they finish
inside a deploy window. Timeouts tuned against a table with a thousand rows in
it.

Or skip all that and just restart something healthy on purpose. Not because you
think it's broken.

---

*I'm building [Dokett](https://github.com/successaje/Dokett), a cross-chain
registry for credit obligations, for Creditcoin's BUIDL CTC 2026 Fall hackathon.
This one came out of a rename I was only doing because someone else had the same
idea about a name.*
