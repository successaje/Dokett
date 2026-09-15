#!/usr/bin/env node
'use strict';

/**
 * Reconcile every published test count against an actual run.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Prose is not tested, so it drifts silently while the code moves. This has now
 * happened three separate times in this repo, and each time a single stale
 * figure turned out to be a family of them:
 *
 *   - "66 contract tests" survived in five places after the suite reached 67.
 *   - ARCHITECTURE.md's per-suite row said AscVerify had 15 tests; it had 20.
 *   - Three different values for the Lens suite were in circulation at once —
 *     11, 13 and 14 — across README, RELEASES, USE-CASES, the deck and two
 *     live Console routes. Only one was right.
 *
 * Every one of those was found by hand, and only because someone happened to
 * look. Two of the surfaces (Landing.tsx, Developers.tsx) render on the live
 * site, and two more (docs/deck/build.js, docs/RELEASES.md) feed artifacts a
 * reviewer reads without ever running the suite.
 *
 * So the numbers get a test of their own.
 *
 *   npm run check:counts
 *
 * Run it before publishing a deck, cutting a release, or pasting a figure into
 * a submission form.
 */

const { readFileSync, existsSync } = require('node:fs');
const { execSync } = require('node:child_process');

/* ──────────────────────────── ground truth ──────────────────────────────── */

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    // forge/node --test exit non-zero on failure but still print counts.
    return `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }
}

function contractCounts() {
  const out = run('forge test');
  const perSuite = {};
  for (const m of out.matchAll(/Ran (\d+) tests? for test\/([A-Za-z0-9_]+)\.t\.sol/g)) {
    perSuite[m[2]] = Number(m[1]);
  }
  const total = Number((out.match(/(\d+) tests passed/) || [])[1] ?? NaN);
  return { perSuite, total };
}

function nodeSuiteCount(script) {
  const out = run(`npm run ${script}`);
  return Number((out.match(/^ℹ pass (\d+)/m) || [])[1] ?? NaN);
}

/* ─────────────────────── the surfaces that make claims ──────────────────── */

/**
 * Each entry: a file, a regex with ONE capture group holding the claimed
 * number, and which truth value it must equal.
 *
 * Adding a surface here is cheaper than finding its drift later.
 */
const CLAIMS = [
  // grand total
  ['README.md', /contracts on CC3, (\d+) passing tests/, 'total'],
  ['docs/TEAM.md', /- (\d+) passing contract, projection and relay tests;/, 'total'],
  ['docs/PROTOCOL-PAPER.md', /covered by (\d+) tests\./, 'total'],
  ['app/src/routes/Landing.tsx', /<li>(\d+) contract, projection and relay tests<\/li>/, 'total'],

  // split figures
  ['README.md', /judge:verify # (\d+) contract \+ \d+ projection \+ \d+ relay/, 'contract'],
  ['README.md', /judge:verify # \d+ contract \+ (\d+) projection \+ \d+ relay/, 'lens'],
  ['README.md', /judge:verify # \d+ contract \+ \d+ projection \+ (\d+) relay/, 'relay'],
  ['docs/USE-CASES.md', /- (\d+) contract tests, \d+ Lens projection tests/, 'contract'],
  ['docs/USE-CASES.md', /- \d+ contract tests, (\d+) Lens projection tests/, 'lens'],
  ['docs/USE-CASES.md', /Lens projection tests, (\d+) relay tests/, 'relay'],
  ['app/src/routes/Developers.tsx', /npm test\s+# (\d+) contract \+ \d+ projection/, 'contract'],
  ['app/src/routes/Developers.tsx', /npm test\s+# \d+ contract \+ (\d+) projection/, 'lens'],

  // the two that feed artifacts nobody re-runs — the whole reason for this file
  ['docs/RELEASES.md', /\*\*Validation:\*\* (\d+) Foundry tests/, 'contract'],
  ['docs/RELEASES.md', /Foundry tests, (\d+) Lens tests/, 'lens'],
  ['docs/RELEASES.md', /Lens tests and (\d+) relay tests/, 'relay'],
  ['docs/deck/build.js', /'(\d+) contract \+ \d+ Lens projection \+ \d+ relay tests/, 'contract'],
  ['docs/deck/build.js', /'\d+ contract \+ (\d+) Lens projection \+ \d+ relay tests/, 'lens'],
  ['docs/deck/build.js', /Lens projection \+ (\d+) relay tests/, 'relay'],

  // per-suite rows
  ['docs/ARCHITECTURE.md', /`AscVerify` \+ real mainnet fixtures \+ (\d+) tests/, 'suite:AscVerify'],
  ['docs/ARCHITECTURE.md', /\| (\d+) integration tests green/, 'suite:Adapters'],
  ['docs/ARCHITECTURE.md', /`Bond`[^|]*\|\s*(\d+) tests green/, 'suite:Bond'],
  ['docs/ARCHITECTURE.md', /\| (\d+) projection tests green/, 'lens'],
];

/* ─────────────────────────────── check ──────────────────────────────────── */

const contract = contractCounts();
const lens = nodeSuiteCount('test:lens');
const relay = nodeSuiteCount('test:relay');

const truth = {
  contract: contract.total,
  lens,
  relay,
  total: contract.total + lens + relay,
};
for (const [suite, n] of Object.entries(contract.perSuite)) truth[`suite:${suite}`] = n;

if ([truth.contract, lens, relay].some(Number.isNaN)) {
  console.error('could not read a suite count — did the suites run?');
  process.exit(2);
}

console.log('ground truth, from an actual run:');
console.log(`  contract ${truth.contract}   lens ${lens}   relay ${relay}   total ${truth.total}`);
for (const [k, v] of Object.entries(contract.perSuite)) console.log(`    ${k.padEnd(20)} ${v}`);
console.log();

let failures = 0;
let checked = 0;
const seen = new Set();

for (const [file, pattern, key] of CLAIMS) {
  if (!existsSync(file)) {
    console.log(`  SKIP  ${file} (not present)`);
    continue;
  }
  seen.add(file);
  const text = readFileSync(file, 'utf8');
  const m = text.match(pattern);

  if (!m) {
    // A claim that no longer matches is drift too: the sentence was reworded
    // and this check silently stopped covering it.
    console.log(`  STALE PATTERN  ${file}  /${pattern.source.slice(0, 46)}…/`);
    failures++;
    continue;
  }

  const claimed = Number(m[1]);
  const expected = truth[key];
  checked++;

  if (expected === undefined) {
    console.log(`  NO TRUTH FOR  ${key}  (${file})`);
    failures++;
  } else if (claimed !== expected) {
    console.log(`  MISMATCH  ${file}  ${key}: doc says ${claimed}, actual ${expected}`);
    failures++;
  }
}

console.log();
console.log(`checked ${checked} claims across ${seen.size} files`);

if (failures) {
  console.error(`\n${failures} problem(s). Fix the docs, or fix this file if a sentence moved.`);
  process.exit(1);
}
console.log('all published test counts match the suites.');
