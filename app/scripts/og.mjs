#!/usr/bin/env node
/**
 * Generate link-preview cards and the static shells that carry them.
 *
 * ─── THE PROBLEM THIS SOLVES ───────────────────────────────────────────────
 *
 * The Console is hash-routed (#/posts/first-slash). A URL fragment is never
 * transmitted to a server, so to Discord, X, Slack and every other unfurler,
 * every link on this site is the same URL: the bare origin. Sharing a specific
 * research post produced a generic card — or with no og:image declared, often
 * no card at all.
 *
 * Hash routing is otherwise the right call here (no server rewrites, every view
 * is a real shareable deep link), so rather than tear it out this generates a
 * real static path for each shareable page:
 *
 *     /posts/first-slash/index.html
 *
 * That file carries the correct OG/Twitter tags for a crawler to read, and
 * bounces a human straight into the hash route. Crawlers do not execute
 * JavaScript, so they read the head and stop; people never see the shell.
 *
 * ─── WHY THIS IS NOT PART OF THE VITE BUILD ────────────────────────────────
 *
 * Card rendering shells out to rsvg-convert, which exists on this machine and
 * emphatically does not exist in Vercel's build container. Wiring it into the
 * build would work locally and fail on deploy — the worst kind of break. So
 * output is generated deliberately, committed to public/, and shipped as static
 * assets like any other image.
 *
 *   node scripts/og.mjs        (from app/)
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, '..', 'public');
const ORIGIN = 'https://covenant-console.vercel.app';

const INK = '#131418';
const CREAM = '#faf9f6';
const MUTED = '#8b8880';
const GOOD = '#3f9d74';

/** Pages worth sharing, each becoming a real path plus a card. */
const PAGES = [
  {
    path: '',
    route: '/',
    eyebrow: 'Register of Obligations',
    title: 'Crypto has a credit market and no credit bureau.',
    desc: 'Covenant is a registry where a promise to pay is a first-class on-chain object, and its status moves only on cryptographic proof — never on anyone’s word.',
    stat: null,
  },
  {
    path: 'posts',
    route: '/posts',
    eyebrow: 'Posts',
    title: 'Findings from operating a registry against a live chain.',
    desc: 'Every number links to a real transaction. Nothing here is asserted without a way to check it yourself.',
    stat: null,
  },
  {
    path: 'posts/first-slash',
    route: '/posts/first-slash',
    eyebrow: 'Covenant Research · 27 Aug 2026',
    title: 'We had never actually slashed anyone',
    desc: 'Covenant’s market thesis rests on first-loss capital being slashed when a borrower defaults. That mechanism had never fired on-chain. So we made it fire.',
    stat: '0.00% → 7.69% loss rate',
  },
  {
    path: 'posts/autonomous-default',
    route: '/posts/autonomous-default',
    eyebrow: 'Covenant Research · 19 Aug 2026',
    title: 'We watched an obligation default. Nobody reported it.',
    desc: 'We registered a real obligation and did nothing. An unattended keeper carried it to default with no human in the loop, end to end.',
    stat: '2m18s · zero humans',
  },
  {
    path: 'posts/attestcoin-cost-model',
    route: '/posts/attestcoin-cost-model',
    eyebrow: 'Covenant Research · 19 Aug 2026',
    title: 'What does it actually cost to verify a foreign chain?',
    desc: 'Creditcoin publishes a cost formula for ASC verification. We measured it instead — five real Ethereum transactions, twenty minutes to two years old.',
    stat: '26% more for 51,529× the age',
  },
  {
    path: 'posts/first-verified-transfer',
    route: '/posts/first-verified-transfer',
    eyebrow: 'Covenant Research · 19 Aug 2026',
    title: 'A real Ethereum transfer, verified inside a Creditcoin contract',
    desc: 'No bridge. No Ethereum-side contract. No centralized oracle. Attestcoin proof to Creditcoin verification, in one block.',
    stat: 'about $0.0001',
  },
  {
    path: 'developers',
    route: '/developers',
    eyebrow: 'Developers',
    title: 'Build on the record',
    desc: 'Covenant has no private API. The same free, public read layer the Console runs on — solvency, encumbrance, obligations, profiles.',
    stat: null,
  },
];

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Greedy wrap — SVG has no line breaking of its own. */
function wrap(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = w;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function card({ eyebrow, title, stat }) {
  // Long titles get smaller type and tighter leading rather than overflowing
  // the canvas — a clipped headline in a link preview looks broken.
  const lines = wrap(title, title.length > 52 ? 30 : 26);
  const size = lines.length > 3 ? 58 : lines.length > 2 ? 66 : 76;
  const leading = Math.round(size * 1.18);
  const blockH = lines.length * leading;
  const startY = Math.round(315 - blockH / 2 + size * 0.78);

  const tspans = lines
    .map((l, i) => `<tspan x="86" y="${startY + i * leading}">${esc(l)}</tspan>`)
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${INK}"/>
  <g transform="translate(86,74) scale(1.05)" fill="none" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round">
    <path d="M21.8 9.8a9.2 9.2 0 1 0 0 12.4"/>
    <path d="M26.2 4.8v22.4"/>
  </g>
  <text x="132" y="98" font-family="Georgia, 'Times New Roman', serif" font-size="27" font-weight="600" fill="${CREAM}">Covenant</text>
  <text x="86" y="150" font-family="Helvetica, Arial, sans-serif" font-size="17" letter-spacing="2.6" fill="${MUTED}">${esc(
    eyebrow.toUpperCase(),
  )}</text>
  <text font-family="Georgia, 'Times New Roman', serif" font-size="${size}" font-weight="700" fill="${CREAM}">${tspans}</text>
  ${
    stat
      ? `<text x="86" y="556" font-family="'Courier New', monospace" font-size="26" fill="${GOOD}">${esc(stat)}</text>`
      : ''
  }
  <text x="1114" y="556" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="17" letter-spacing="1.4" fill="${MUTED}">covenant-console.vercel.app</text>
</svg>`;
}

function shell({ route, title, desc, img, url }) {
  const full = `${title} — Covenant`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${url}" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />

<meta property="og:type" content="article" />
<meta property="og:site_name" content="Covenant" />
<meta property="og:title" content="${esc(full)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${img}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(full)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${img}" />

<!-- A person is sent straight into the app. Crawlers do not run scripts, so
     they read the tags above and stop here. -->
<script>location.replace('/#${route}');</script>
</head>
<body style="margin:0;background:${INK};color:${CREAM};font-family:Georgia,serif">
  <p style="padding:40px">
    <a href="/#${route}" style="color:${CREAM}">Continue to Covenant &rarr;</a>
  </p>
</body>
</html>`;
}

const ogDir = join(PUBLIC, 'og');
rmSync(ogDir, { recursive: true, force: true });
mkdirSync(ogDir, { recursive: true });

for (const p of PAGES) {
  const slug = p.path === '' ? 'default' : p.path.replace(/\//g, '-');
  const svgPath = join(ogDir, `${slug}.svg`);
  const pngPath = join(ogDir, `${slug}.png`);

  writeFileSync(svgPath, card(p));
  execFileSync('rsvg-convert', ['-w', '1200', '-h', '630', svgPath, '-o', pngPath]);
  rmSync(svgPath);

  const img = `${ORIGIN}/og/${slug}.png`;
  const url = `${ORIGIN}/${p.path}`.replace(/\/$/, '');

  // The root's tags live in index.html; only sub-paths need a shell.
  if (p.path !== '') {
    const dir = join(PUBLIC, p.path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), shell({ ...p, img, url }));
  }

  console.log(`  ${slug.padEnd(28)} og/${slug}.png${p.path ? `  →  /${p.path}` : '  (root, index.html)'}`);
}

console.log(`\n${PAGES.length} cards generated. Commit app/public/og and app/public/posts.`);
