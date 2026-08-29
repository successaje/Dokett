#!/usr/bin/env node
/**
 * The measurement chart for the cold-start post.
 *
 * Every point is a real eth_getLogs call against CC3, same contract, same
 * topic, same starting block. Four passes.
 *
 * ─── WHY TWO MARKER SHAPES AND NOT JUST TWO COLOURS ────────────────────────
 *
 * The palette validator rates #4fbc8a against #e0705f at ΔE 6.0 under
 * deuteranopia, which is the floor band: permissible only with a second
 * channel carrying the same distinction. Since the whole point of the chart is
 * "these passed, these didn't", encoding that in red-versus-green alone would
 * hide the message from roughly one in twelve men.
 *
 * So successes are filled circles and timeouts are crosses. It reads in
 * greyscale, and it is the more honest encoding anyway: a timeout is not a
 * slow measurement, it is the client giving up. Those are different kinds of
 * observation and they should not look like the same dot in a different hue.
 */

import { writeFileSync } from 'node:fs';

const OK = 'ok';
const TIMEOUT = 'timeout';

/** [range, ms, outcome] — real numbers, four passes over the same query. */
const DATA = [
  [5_000, 2105, OK],

  [10_000, 4601, OK],
  [10_000, 3354, OK],
  [10_000, 2611, OK],
  [10_000, 10234, TIMEOUT],

  [20_000, 8160, OK],
  [20_000, 5475, OK],
  [20_000, 10232, TIMEOUT],
  [20_000, 10246, TIMEOUT],

  [30_000, 8762, OK],
  [30_000, 6723, OK],
  [30_000, 10458, TIMEOUT],
  [30_000, 10252, TIMEOUT],

  [40_000, 8293, OK],
  [40_000, 10263, TIMEOUT],
  [40_000, 10238, TIMEOUT],
  [40_000, 10244, TIMEOUT],

  [50_000, 10282, TIMEOUT],
];

const GROUND = '#131418';
const INK = '#ece9e2';
const MUTED = '#8a867d';
const FAINT = '#2a2c33';
const GOOD = '#4fbc8a';
const BAD = '#e0705f';

const W = 1600;
const H = 1040;
const M = { top: 150, right: 70, bottom: 168, left: 130 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

const X_MAX = 55_000;
const Y_MAX = 12_000;

const x = (v) => M.left + (v / X_MAX) * PW;
const y = (v) => M.top + PH - (v / Y_MAX) * PH;

/* Jitter points that share an x so overlaps stay countable. Deterministic —
   the chart must render identically every time it is regenerated. */
const seen = new Map();
function jitter(range) {
  const n = seen.get(range) ?? 0;
  seen.set(range, n + 1);
  return (n - 1.5) * 13;
}

const parts = [];
const p = (s) => parts.push(s);

p(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`);
p(`<rect width="${W}" height="${H}" fill="${GROUND}"/>`);

// ── title ────────────────────────────────────────────────────────────────
p(`<text x="${M.left}" y="66" font-family="Georgia,'Times New Roman',serif" font-size="40" font-weight="700" fill="${INK}">The same query, eighteen times</text>`);
p(`<text x="${M.left}" y="104" font-family="Helvetica,Arial,sans-serif" font-size="21" fill="${MUTED}">eth_getLogs over a growing block range. Four passes, same contract, same starting block.</text>`);

// ── y gridlines ──────────────────────────────────────────────────────────
for (let v = 0; v <= Y_MAX; v += 2000) {
  const gy = y(v);
  p(`<line x1="${M.left}" y1="${gy}" x2="${M.left + PW}" y2="${gy}" stroke="${FAINT}" stroke-width="1"/>`);
  p(`<text x="${M.left - 18}" y="${gy + 7}" text-anchor="end" font-family="'Courier New',monospace" font-size="19" fill="${MUTED}">${v / 1000}s</text>`);
}

// ── the timeout wall ─────────────────────────────────────────────────────
const ty = y(10_000);
p(`<rect x="${M.left}" y="${M.top}" width="${PW}" height="${ty - M.top}" fill="${BAD}" opacity="0.05"/>`);
p(`<line x1="${M.left}" y1="${ty}" x2="${M.left + PW}" y2="${ty}" stroke="${BAD}" stroke-width="2.5" stroke-dasharray="9 6"/>`);
p(`<text x="${M.left + 16}" y="${ty - 58}" font-family="Helvetica,Arial,sans-serif" font-size="20" font-weight="700" fill="${BAD}">10-second server timeout</text>`);

// ── x axis ───────────────────────────────────────────────────────────────
p(`<line x1="${M.left}" y1="${M.top + PH}" x2="${M.left + PW}" y2="${M.top + PH}" stroke="${MUTED}" stroke-width="1.5"/>`);
for (const v of [5_000, 10_000, 20_000, 30_000, 40_000, 50_000]) {
  p(`<text x="${x(v)}" y="${M.top + PH + 40}" text-anchor="middle" font-family="'Courier New',monospace" font-size="20" fill="${MUTED}">${v / 1000}k</text>`);
}
p(`<text x="${M.left + PW / 2}" y="${M.top + PH + 80}" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="21" fill="${INK}">blocks requested in a single call</text>`);

// ── points ───────────────────────────────────────────────────────────────
for (const [range, ms, outcome] of DATA) {
  const cx = x(range) + jitter(range);
  const cy = y(ms);
  if (outcome === OK) {
    p(`<circle cx="${cx}" cy="${cy}" r="11" fill="${GOOD}" stroke="${GROUND}" stroke-width="2.5"/>`);
  } else {
    const r = 10;
    p(`<g stroke="${BAD}" stroke-width="4.5" stroke-linecap="round">`);
    p(`<line x1="${cx - r}" y1="${cy - r}" x2="${cx + r}" y2="${cy + r}"/>`);
    p(`<line x1="${cx - r}" y1="${cy + r}" x2="${cx + r}" y2="${cy - r}"/>`);
    p(`</g>`);
  }
}

// ── legend ───────────────────────────────────────────────────────────────
const ly = M.top + PH + 134;
p(`<circle cx="${M.left + 8}" cy="${ly - 7}" r="11" fill="${GOOD}" stroke="${GROUND}" stroke-width="2.5"/>`);
p(`<text x="${M.left + 30}" y="${ly}" font-family="Helvetica,Arial,sans-serif" font-size="20" fill="${INK}">returned</text>`);
const lx2 = M.left + 168;
p(`<g stroke="${BAD}" stroke-width="4.5" stroke-linecap="round"><line x1="${lx2 - 10}" y1="${ly - 17}" x2="${lx2 + 10}" y2="${ly + 3}"/><line x1="${lx2 - 10}" y1="${ly + 3}" x2="${lx2 + 10}" y2="${ly - 17}"/></g>`);
p(`<text x="${lx2 + 26}" y="${ly}" font-family="Helvetica,Arial,sans-serif" font-size="20" fill="${INK}">timed out</text>`);

// ── the point of the chart, said once ────────────────────────────────────
p(`<text x="${M.left + PW}" y="${ly}" text-anchor="end" font-family="Georgia,serif" font-size="21" font-style="italic" fill="${MUTED}">10k failed once. 40k succeeded once.</text>`);

p(`</svg>`);

writeFileSync('scatter.svg', parts.join('\n'));
console.log(`wrote scatter.svg — ${DATA.length} points, ${DATA.filter((d) => d[2] === TIMEOUT).length} timeouts`);
