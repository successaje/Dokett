#!/usr/bin/env node
/**
 * Medium cover image.
 *
 * Built for the FEED, not the article. Medium renders this at roughly 200px
 * wide in a list, so the whole thing has to survive being shrunk to a
 * thumbnail — which rules out the scatter plot (eighteen small dots become
 * noise) and rules out anything with a sentence in it.
 *
 * One number, large enough to read at any size, with the two dates that make
 * it a story. Set as a code comment because the audience is developers and it
 * says "this is about a line of source" before a single word is read.
 */
import { writeFileSync } from 'node:fs';

const W = 1600, H = 900;
const GROUND='#131418', INK='#ece9e2', MUTED='#8a867d', GOOD='#4fbc8a', BAD='#e0705f';
const MONO = "'Courier New',monospace";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${GROUND}"/>

<!-- the constant, sized to survive a thumbnail -->
<text x="${W/2}" y="420" text-anchor="middle" font-family="${MONO}" font-size="235" font-weight="700" fill="${INK}">50000</text>

<!-- the two dates that turn it into a story -->
<text x="${W/2}" y="545" text-anchor="middle" font-family="${MONO}" font-size="40" fill="${GOOD}">// correct on 18 August</text>
<text x="${W/2}" y="611" text-anchor="middle" font-family="${MONO}" font-size="40" fill="${BAD}">// wrong by 27 August</text>

<text x="${W/2}" y="722" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="27" fill="${MUTED}" letter-spacing="2">NOBODY TOUCHED THE CODE</text>
</svg>`;

writeFileSync('cover.svg', svg);
console.log('wrote cover.svg');
