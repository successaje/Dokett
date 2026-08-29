const pptxgen = require('pptxgenjs');

// ── palette — lifted directly from the live product's own design system ───
const INK = '16181C';
const INK2 = '4A4741';
const INK3 = '78746C';
const INK4 = 'A8A49B';
const PAPER = 'FAF9F6';
const PAPER2 = 'F3F1EC';
const RULE = 'E0DDD5';
const GOOD = '1C6B48'; // st-current — "proven"
const WARN = '9A6206'; // st-delinquent
const BAD = '96291D'; // st-default

const SERIF = 'Cambria';
const SANS = 'Calibri';
const MONO = 'Courier New';

const W = 13.333;
const H = 7.5;
const MARGIN = 0.7;

function newDeck() {
  const p = new pptxgen();
  p.layout = 'LAYOUT_WIDE';
  return p;
}

function baseSlide(p, { dark = false } = {}) {
  const s = p.addSlide();
  s.background = { color: dark ? INK : PAPER };
  return s;
}

function eyebrow(s, text, { dark = false, x = MARGIN, y = 0.55 } = {}) {
  s.addText(text.toUpperCase(), {
    x,
    y,
    w: W - x * 2,
    h: 0.35,
    fontFace: SANS,
    fontSize: 11,
    charSpacing: 3,
    bold: true,
    color: dark ? INK4 : INK3,
    margin: 0,
  });
}

function pageNum(s, n, dark = false) {
  s.addText(`${String(n).padStart(2, '0')} / 12`, {
    x: W - 1.3,
    y: H - 0.55,
    w: 1,
    h: 0.3,
    fontFace: MONO,
    fontSize: 9,
    color: dark ? INK4 : INK3,
    align: 'right',
    margin: 0,
  });
  s.addText('DOKETT', {
    x: MARGIN,
    y: H - 0.55,
    w: 3,
    h: 0.3,
    fontFace: SANS,
    fontSize: 9,
    charSpacing: 2,
    color: dark ? INK4 : INK3,
    margin: 0,
  });
}

function title(s, text, { y = 0.95, size = 34, dark = false, w = W - MARGIN * 2 } = {}) {
  s.addText(text, {
    x: MARGIN,
    y,
    w,
    h: 1.1,
    fontFace: SERIF,
    fontSize: size,
    bold: true,
    color: dark ? PAPER : INK,
    margin: 0,
  });
}

function rule(s, x, y, w, color = RULE) {
  s.addShape('line', { x, y, w, h: 0, line: { color, width: 1 } });
}

async function main() {
  const p = newDeck();

  // ── 1. Title ──────────────────────────────────────────────────────────
  {
    const s = baseSlide(p, { dark: true });
    s.addText('C', {
      x: MARGIN,
      y: 0.7,
      w: 1,
      h: 1,
      fontFace: SERIF,
      fontSize: 40,
      bold: true,
      color: PAPER,
      margin: 0,
    });
    s.addText('DOKETT', {
      x: MARGIN,
      y: 2.5,
      w: 11,
      h: 1.3,
      fontFace: SERIF,
      fontSize: 64,
      bold: true,
      color: PAPER,
      charSpacing: 1,
      margin: 0,
    });
    s.addText('The obligation layer for the open economy', {
      x: MARGIN,
      y: 3.75,
      w: 10,
      h: 0.6,
      fontFace: SANS,
      fontSize: 20,
      color: INK4,
      margin: 0,
    });
    rule(s, MARGIN, 4.55, 5.2, '3D3F48');
    s.addText(
      'A registry where a promise to pay is a first-class on-chain object, and its state\nadvances only on cryptographically verified evidence — never on anyone’s word.',
      {
        x: MARGIN,
        y: 4.75,
        w: 9.5,
        h: 0.9,
        fontFace: SANS,
        fontSize: 14,
        color: PAPER2,
        lineSpacingMultiple: 1.3,
        margin: 0,
      },
    );
    s.addText('BUIDL CTC 2026 Fall  ·  RWA track  ·  Built on Attestcoin Smart Contracts (ASC)  ·  Creditcoin CC3', {
      x: MARGIN,
      y: H - 0.85,
      w: 11,
      h: 0.35,
      fontFace: MONO,
      fontSize: 10.5,
      color: INK4,
      charSpacing: 1,
      margin: 0,
    });
  }

  // ── 2. The gap ────────────────────────────────────────────────────────
  {
    const s = baseSlide(p);
    eyebrow(s, 'The problem');
    title(s, 'Every promise to pay in crypto is invisible — until it breaks');

    const stats = [
      ['$14B', 'active tokenized private credit on-chain'],
      ['$20B', 'tokenized real-world assets'],
      ['0', 'credit bureaus, lien registries, or bankruptcy courts underneath either'],
    ];
    let x = MARGIN;
    const cw = (W - MARGIN * 2 - 0.6) / 3;
    stats.forEach(([n, label]) => {
      s.addText(n, {
        x,
        y: 2.5,
        w: cw,
        h: 1.1,
        fontFace: SERIF,
        fontSize: 56,
        bold: true,
        color: n === '0' ? BAD : INK,
        margin: 0,
      });
      s.addText(label, {
        x,
        y: 3.65,
        w: cw,
        h: 1,
        fontFace: SANS,
        fontSize: 13.5,
        color: INK2,
        margin: 0,
      });
      x += cw + 0.3;
    });

    rule(s, MARGIN, 5.1, W - MARGIN * 2);
    s.addText(
      'A borrower can hold obligations at five protocols across four chains, and none of them can see the others. Every major credit blowup of the last cycle was the same failure — not fraud nobody could punish, but leverage nobody could see.',
      { x: MARGIN, y: 5.35, w: W - MARGIN * 2 - 1, h: 1.2, fontFace: SANS, fontSize: 15, italic: true, color: INK2, margin: 0 },
    );
    pageNum(s, 2);
  }

  // ── 3. Why previous attempts failed ──────────────────────────────────
  {
    const s = baseSlide(p);
    eyebrow(s, 'Prior art');
    title(s, 'Every attempt was fixed with a better model. None with better evidence.');

    const rows = [
      ['On-chain credit scores', 'Spectral, Cred, ARCx, RociFi', 'A number with no recourse and no sybil cost. Nobody lends against an opinion.'],
      ['Aave credit delegation', '', 'The delegator got no upside and no enforcement. Delegation without payment is charity.'],
      ['Goldfinch', '', 'Not an underwriting failure — an observability failure. Borrowers reported performance in PDFs.'],
      ['Maple v1', '', 'Pool delegates with no cross-venue visibility → correlated blowups.'],
    ];

    let y = 2.25;
    rows.forEach(([name, sub, why], i) => {
      s.addText(name, { x: MARGIN, y, w: 3.1, h: 0.7, fontFace: SANS, fontSize: 15, bold: true, color: INK, margin: 0 });
      if (sub) s.addText(sub, { x: MARGIN, y: y + 0.34, w: 3.1, h: 0.3, fontFace: SANS, fontSize: 10, color: INK4, margin: 0 });
      s.addText(why, { x: 3.9, y, w: W - 3.9 - MARGIN, h: 0.7, fontFace: SANS, fontSize: 13.5, color: INK2, margin: 0 });
      if (i < rows.length - 1) rule(s, MARGIN, y + 0.85, W - MARGIN * 2);
      y += 1.05;
    });
    pageNum(s, 3);
  }

  // ── 4. What changed ───────────────────────────────────────────────────
  {
    const s = baseSlide(p, { dark: true });
    eyebrow(s, 'What changed', { dark: true });
    title(s, 'The missing input landed on Creditcoin in June 2026', { dark: true, size: 32 });

    const cards = [
      ['Repayments moved on-chain', 'Stablecoin settlement means a repayment is now an event, not a report.'],
      ['ASC shipped to mainnet', 'A Creditcoin contract can cryptographically verify a real Ethereum event in one block.'],
      ['~$0.000024 per verification', 'Checking a foreign-chain fact costs a fraction of a cent — cheap enough to do continuously.'],
    ];
    let x = MARGIN;
    const cw = (W - MARGIN * 2 - 0.6) / 3;
    cards.forEach(([h, b]) => {
      s.addShape('roundRect', { x, y: 2.5, w: cw, h: 2.7, rectRadius: 0.06, fill: { color: '1E2027' }, line: { color: '2A2C33', width: 1 } });
      s.addText(h, { x: x + 0.28, y: 2.75, w: cw - 0.56, h: 0.9, fontFace: SERIF, fontSize: 18, bold: true, color: PAPER, margin: 0 });
      s.addText(b, { x: x + 0.28, y: 3.65, w: cw - 0.56, h: 1.35, fontFace: SANS, fontSize: 12.5, color: INK4, margin: 0, lineSpacingMultiple: 1.25 });
      x += cw + 0.3;
    });

    s.addText(
      'For the first time, the performance of a loan is something a contract can check — rather than something a human tells you.',
      { x: MARGIN, y: 5.6, w: W - MARGIN * 2 - 1.5, h: 0.7, fontFace: SANS, fontSize: 15, italic: true, color: PAPER2, margin: 0 },
    );
    pageNum(s, 4, true);
  }

  // ── 5. The primitive ─────────────────────────────────────────────────
  {
    const s = baseSlide(p);
    eyebrow(s, 'The primitive');
    title(s, 'An Obligation — a promise to pay, on-chain');

    s.addShape('roundRect', { x: MARGIN, y: 2.15, w: W - MARGIN * 2, h: 1.35, rectRadius: 0.05, fill: { color: PAPER2 }, line: { color: RULE, width: 1 } });
    s.addText('obligor (commitment, never PII)  ·  principal  ·  schedule  ·  seniority  ·  collateral ref', {
      x: MARGIN + 0.3,
      y: 2.4,
      w: W - MARGIN * 2 - 0.6,
      h: 0.5,
      fontFace: MONO,
      fontSize: 15,
      color: INK,
      margin: 0,
    });
    s.addText('status: Active → Current → Delinquent → Default → Settled', {
      x: MARGIN + 0.3,
      y: 2.95,
      w: W - MARGIN * 2 - 0.6,
      h: 0.4,
      fontFace: MONO,
      fontSize: 14,
      color: GOOD,
      bold: true,
      margin: 0,
    });

    const steps = ['Active', 'Current', 'Delinquent', 'Default', 'Settled'];
    const railW = W - MARGIN * 2;
    const stepW = railW / steps.length;
    steps.forEach((st, i) => {
      const x = MARGIN + i * stepW;
      s.addShape('line', { x, y: 4.15, w: stepW - (i < steps.length - 1 ? 0.15 : 0), h: 0, line: { color: INK3, width: 1.5, dashType: 'solid' } });
      if (i < steps.length - 1) {
        s.addText('→', { x: x + stepW - 0.3, y: 3.95, w: 0.3, h: 0.4, fontFace: SANS, fontSize: 16, color: INK3, margin: 0 });
      }
      s.addShape('ellipse', { x: x - 0.05, y: 4.05, w: 0.2, h: 0.2, fill: { color: i === 0 ? INK : PAPER }, line: { color: INK, width: 1.5 } });
      s.addText(st, { x: x - 0.4, y: 4.35, w: stepW, h: 0.35, fontFace: SANS, fontSize: 12, bold: true, color: INK, margin: 0 });
    });

    rule(s, MARGIN, 5.15, W - MARGIN * 2);
    s.addText(
      'Status advances only when an ASC proof of the corresponding Ethereum event is verified by the BlockProver precompile, or when a deadline measured in attested source-chain block height expires. No party can assert a transition.',
      { x: MARGIN, y: 5.4, w: W - MARGIN * 2 - 1, h: 1.1, fontFace: SANS, fontSize: 14.5, color: INK2, margin: 0, lineSpacingMultiple: 1.3 },
    );
    pageNum(s, 5);
  }

  // ── 6. The inversion ─────────────────────────────────────────────────
  {
    const s = baseSlide(p, { dark: true });
    eyebrow(s, 'The mechanism', { dark: true });
    title(s, 'The inversion', { dark: true, size: 44 });

    s.addText('Every other ASC project proves that something happened.', {
      x: MARGIN,
      y: 1.95,
      w: 10.5,
      h: 0.5,
      fontFace: SANS,
      fontSize: 18,
      color: INK4,
      margin: 0,
    });
    s.addText('Dokett proves that nothing did.', {
      x: MARGIN,
      y: 2.45,
      w: 10.5,
      h: 0.6,
      fontFace: SERIF,
      fontSize: 26,
      bold: true,
      color: PAPER,
      margin: 0,
    });

    s.addShape('roundRect', { x: MARGIN, y: 3.35, w: W - MARGIN * 2, h: 1.15, rectRadius: 0.06, fill: { color: '1E2027' }, line: { color: '2A2C33', width: 1 } });
    s.addText(
      'SilenceAdapter: an obligation degrades unless proof of payment arrives. No reporter, no committee, no oracle operator. Default is the default.',
      { x: MARGIN + 0.3, y: 3.55, w: W - MARGIN * 2 - 0.6, h: 0.8, fontFace: MONO, fontSize: 13.5, color: PAPER, margin: 0, lineSpacingMultiple: 1.2 },
    );

    s.addText(
      '"You cannot prove a negative with an inclusion proof. Dokett does not claim to. It proves an on-chain fact about Creditcoin state — no admissible proof of payment for this window was presented before the attested head passed the deadline — which is economically equivalent to non-payment, because submission is permissionless, costs a fraction of a cent, and the borrower is the party most motivated to submit it. If it is ever wrong, the proof still cures it, however late it arrives."',
      {
        x: MARGIN,
        y: 4.75,
        w: W - MARGIN * 2 - 1,
        h: 2.1,
        fontFace: SANS,
        fontSize: 13.5,
        italic: true,
        color: PAPER2,
        margin: 0,
        lineSpacingMultiple: 1.3,
      },
    );
    pageNum(s, 6, true);
  }

  // ── 7. The market on top ─────────────────────────────────────────────
  {
    const s = baseSlide(p);
    eyebrow(s, 'The market');
    title(s, 'Bonded underwriters — named, not pooled');

    const cols = [
      ['Named, not pooled', 'A bond backs one obligation. Pooling is what let correlated risk hide inside a single APY — and why the delegate model died.'],
      ['Stablecoin-first', 'Collateralised in a volatile token is a reflexive death spiral: the collateral falls precisely when defaults rise. Allowlisted only.'],
      ['Slashed by proof', 'Earn the spread when the borrower pays. Slashed automatically to the creditor on a proven default — no committee, no vote.'],
    ];
    let x = MARGIN;
    const cw = (W - MARGIN * 2 - 0.6) / 3;
    cols.forEach(([h, b]) => {
      s.addText(h, { x, y: 2.3, w: cw, h: 0.6, fontFace: SERIF, fontSize: 19, bold: true, color: INK, margin: 0 });
      rule(s, x, 3.0, cw * 0.4, INK);
      s.addText(b, { x, y: 3.2, w: cw, h: 1.7, fontFace: SANS, fontSize: 13, color: INK2, margin: 0, lineSpacingMultiple: 1.3 });
      x += cw + 0.3;
    });

    rule(s, MARGIN, 5.35, W - MARGIN * 2);
    s.addText(
      'This puts the credit decision where the information actually is — the loan officer, the employer, the co-op, the merchant acquirer. A borrower’s cost of credit becomes a live market price instead of a model’s opinion.',
      { x: MARGIN, y: 5.6, w: W - MARGIN * 2 - 1, h: 1, fontFace: SANS, fontSize: 14.5, italic: true, color: INK2, margin: 0, lineSpacingMultiple: 1.3 },
    );
    pageNum(s, 7);
  }

  // ── 8. Measured, not claimed ─────────────────────────────────────────
  {
    const s = baseSlide(p);
    eyebrow(s, 'Verified, not asserted');
    title(s, 'Every number here is a real transaction', { size: 30 });

    s.addText('26%', { x: MARGIN, y: 2.05, w: 2.6, h: 0.85, fontFace: SERIF, fontSize: 46, bold: true, color: GOOD, margin: 0 });
    s.addText('more cost to prove a fact\n51,529× the age', {
      x: MARGIN,
      y: 2.85,
      w: 2.6,
      h: 0.7,
      fontFace: SANS,
      fontSize: 12,
      color: INK3,
      margin: 0,
    });

    s.addText('232', { x: 3.5, y: 2.05, w: 2.6, h: 0.85, fontFace: SERIF, fontSize: 46, bold: true, color: GOOD, margin: 0 });
    s.addText('continuity roots — saturates\npast ~1yr, not linear', {
      x: 3.5,
      y: 2.85,
      w: 2.6,
      h: 0.7,
      fontFace: SANS,
      fontSize: 12,
      color: INK3,
      margin: 0,
    });

    s.addText('78.4%', { x: 7, y: 2.05, w: 2.6, h: 0.85, fontFace: SERIF, fontSize: 46, bold: true, color: GOOD, margin: 0 });
    s.addText('gas saved batching\n10 proofs, 1 continuity chain', {
      x: 7,
      y: 2.85,
      w: 2.6,
      h: 0.7,
      fontFace: SANS,
      fontSize: 12,
      color: INK3,
      margin: 0,
    });

    s.addText('2.3min', { x: 10.5, y: 2.05, w: 2.4, h: 0.85, fontFace: SERIF, fontSize: 40, bold: true, color: GOOD, margin: 0 });
    s.addText('registered → delinquent →\ndefault, zero humans', {
      x: 10.5,
      y: 2.85,
      w: 2.4,
      h: 0.7,
      fontFace: SANS,
      fontSize: 12,
      color: INK3,
      margin: 0,
    });

    rule(s, MARGIN, 3.75, W - MARGIN * 2);

    s.addText('A live default, no reporter', { x: MARGIN, y: 4.0, w: 6, h: 0.4, fontFace: SANS, fontSize: 13, bold: true, color: INK, margin: 0 });
    const trace = [
      ['Registered', '0x7da80af3…e9eb9fc8'],
      ['→ Delinquent', '0x72127e0d…bf720278'],
      ['→ Default', '0x7ce07a2e…759a61f7'],
    ];
    let ty = 4.45;
    trace.forEach(([label, tx]) => {
      s.addText(label, { x: MARGIN, y: ty, w: 1.6, h: 0.32, fontFace: SANS, fontSize: 11.5, color: INK2, margin: 0 });
      s.addText(tx, { x: MARGIN + 1.7, y: ty, w: 4, h: 0.32, fontFace: MONO, fontSize: 11, color: INK3, margin: 0 });
      ty += 0.38;
    });
    s.addText(
      'Zero underwriters had posted first-loss capital against this obligation — the default report shows slashed: 0, honestly, rather than implying protection that wasn’t there.',
      { x: MARGIN, y: 5.75, w: 6, h: 0.9, fontFace: SANS, fontSize: 11, italic: true, color: INK4, margin: 0, lineSpacingMultiple: 1.25 },
    );

    s.addText('Deep-history cost curve', { x: 7, y: 4.0, w: 5.5, h: 0.4, fontFace: SANS, fontSize: 13, bold: true, color: INK, margin: 0 });
    s.addChart(
      p.ChartType.bar,
      [
        {
          name: 'CTC to verify',
          labels: ['20 min', '35 min', '24 hr', '1 yr', '2 yr'],
          values: [0.000190337, 0.000187873, 0.000194593, 0.000239393, 0.000239393],
        },
      ],
      {
        x: 7,
        y: 4.45,
        w: 5.5,
        h: 2.15,
        showTitle: false,
        showValue: false,
        chartColors: [GOOD],
        barGapWidthPct: 40,
        catAxisLabelColor: INK3,
        catAxisLabelFontSize: 9,
        valAxisLabelColor: INK3,
        valAxisLabelFontSize: 8,
        valAxisLabelFormatCode: '0.000000',
        valGridLine: { color: RULE, size: 0.5 },
        catGridLine: { style: 'none' },
        showLegend: false,
        plotArea: { fill: { color: PAPER } },
        chartArea: { fill: { color: PAPER } },
      },
    );
    pageNum(s, 8);
  }

  // ── 9. ASC integration depth ─────────────────────────────────────────
  {
    const s = baseSlide(p);
    eyebrow(s, 'Technical depth');
    title(s, 'The guarded path around a raw precompile', { size: 30 });

    const items = [
      ['Real mainnet evidence, from testnet', 'CC3 testnet attests Ethereum mainnet at chainkey 3. Every proof in this build is against a real mainnet transaction.'],
      ['BlockProver does not validate success', 'A reverted ERC-20 transfer is still a validly-included transaction. AscVerify.sol asserts receipt status == 0x1 before any log is touched — published standalone, MIT.'],
      ['Replay-guarded, confirmation-gated', 'Every proof keys on (chainKey, height, txIndex, logIndex). Confirmation depth is enforced against the attested head, not assumed.'],
      ['Liveness circuit breaker', 'penaltiesEnabled() requires an unbroken observation record. A stalled oracle must never manufacture defaults across every obligation at once.'],
    ];
    let y = 2.15;
    items.forEach(([h, b], i) => {
      s.addShape('ellipse', { x: MARGIN, y: y + 0.03, w: 0.14, h: 0.14, fill: { color: GOOD } });
      s.addText(h, { x: MARGIN + 0.35, y: y - 0.08, w: W - MARGIN * 2 - 0.35, h: 0.35, fontFace: SANS, fontSize: 14.5, bold: true, color: INK, margin: 0 });
      s.addText(b, { x: MARGIN + 0.35, y: y + 0.28, w: W - MARGIN * 2 - 0.35, h: 0.55, fontFace: SANS, fontSize: 12, color: INK2, margin: 0, lineSpacingMultiple: 1.2 });
      y += 1.0;
    });

    s.addText('BlockProver  0x0000000000000000000000000000000000000FD2      ChainInfo  0x0000000000000000000000000000000000000fD3', {
      x: MARGIN,
      y: 6.3,
      w: W - MARGIN * 2,
      h: 0.35,
      fontFace: MONO,
      fontSize: 10,
      color: INK4,
      margin: 0,
    });
    pageNum(s, 9);
  }

  // ── 10. Live today ────────────────────────────────────────────────────
  {
    const s = baseSlide(p, { dark: true });
    eyebrow(s, 'Status', { dark: true });
    title(s, 'This is not a mockup. It is running.', { dark: true, size: 32 });

    const stack = [
      ['Contracts', 'Deployed + source-verified on CC3 testnet (Blockscout)'],
      ['Keeper', 'Running unattended on Fly.io — poke / prove / sweep on independent timers'],
      ['Lens', 'Always-on read API on Fly.io, free, no auth'],
      ['Console', 'Live on Vercel, wired to the live Lens'],
      ['Tests', '66 contract tests + 7 Lens projection tests, passing'],
    ];
    let y = 2.15;
    stack.forEach(([h, b]) => {
      s.addText(h, { x: MARGIN, y, w: 2.3, h: 0.5, fontFace: SANS, fontSize: 13.5, bold: true, color: PAPER, margin: 0 });
      s.addText(b, { x: 2.9, y, w: 8, h: 0.5, fontFace: SANS, fontSize: 13, color: INK4, margin: 0 });
      y += 0.62;
    });

    s.addShape('roundRect', { x: MARGIN, y: 5.55, w: W - MARGIN * 2, h: 1.1, rectRadius: 0.06, fill: { color: '1E2027' }, line: { color: '2A2C33', width: 1 } });
    s.addText('covenant-console.vercel.app', { x: MARGIN + 0.3, y: 5.72, w: 5, h: 0.35, fontFace: MONO, fontSize: 13, color: PAPER, margin: 0 });
    s.addText('dokett-lens.fly.dev', { x: MARGIN + 0.3, y: 6.05, w: 5, h: 0.35, fontFace: MONO, fontSize: 13, color: PAPER, margin: 0 });
    s.addText('github.com/successaje/Dokett', { x: 6.8, y: 5.72, w: 5.5, h: 0.35, fontFace: MONO, fontSize: 13, color: PAPER, margin: 0 });
    s.addText('MIT-licensed', { x: 6.8, y: 6.05, w: 5.5, h: 0.35, fontFace: MONO, fontSize: 13, color: INK4, margin: 0 });
    pageNum(s, 10, true);
  }

  // ── 11. Known limitations ────────────────────────────────────────────
  {
    const s = baseSlide(p);
    eyebrow(s, 'Stated plainly');
    title(s, 'Known limitations', { size: 34 });

    const items = [
      'ASC attestors are permissioned today (AuthorizedOnly), with a documented 0 CTC minimum bond and no published slashing regime — our most important external dependency.',
      'Privacy is v1: identity is a commitment, but payment addresses and amounts are public by construction. Do not put real people’s data in this registry today.',
      'One source chain — Ethereum mainnet only, because that is what ASC attests today.',
      'Registry spam is priced, not adjudicated. Wash underwriting is priced, not prevented. Both are made expensive, neither is made impossible.',
      'On-chain registration is not legal lien perfection in any jurisdiction.',
    ];
    let y = 2.1;
    items.forEach((t) => {
      s.addText('—', { x: MARGIN, y, w: 0.3, h: 0.55, fontFace: SANS, fontSize: 14, color: WARN, bold: true, margin: 0 });
      s.addText(t, { x: MARGIN + 0.35, y, w: W - MARGIN * 2 - 0.35, h: 0.55, fontFace: SANS, fontSize: 13.5, color: INK2, margin: 0, lineSpacingMultiple: 1.2 });
      y += 0.72;
    });

    rule(s, MARGIN, 5.95, W - MARGIN * 2);
    s.addText(
      'A reviewer should not have to discover these. We treat the attestor set as the protocol’s single most important external dependency, and design around it: per-obligation exposure caps and an AscVerify abstraction that lets a second evidence backend be swapped in without touching Register.',
      { x: MARGIN, y: 6.12, w: W - MARGIN * 2, h: 0.6, fontFace: SANS, fontSize: 10.5, italic: true, color: INK3, margin: 0, lineSpacingMultiple: 1.15 },
    );
    pageNum(s, 11);
  }

  // ── 12. Roadmap & ask ─────────────────────────────────────────────────
  {
    const s = baseSlide(p, { dark: true });
    eyebrow(s, 'Roadmap & ask', { dark: true });
    title(s, 'Where this goes next', { dark: true, size: 34 });

    const road = [
      ['0–3 mo', 'Mainnet v0. Import historical loan records as commitment-form obligations — coverage on day one.'],
      ['3–6 mo', 'Free encumbrance API. Three venues querying. AscVerify adopted as an ecosystem standard.'],
      ['6–12 mo', 'Underwriting bonds with real capital. First proven mainnet default.'],
      ['12–24 mo', 'ERC standard for Obligations. Registrar Council. Attested Register mirrors on Ethereum/Base.'],
    ];
    let y = 2.15;
    road.forEach(([t, d]) => {
      s.addText(t, { x: MARGIN, y, w: 1.6, h: 0.55, fontFace: MONO, fontSize: 13, bold: true, color: PAPER, margin: 0 });
      s.addText(d, { x: 2.4, y, w: W - 2.4 - MARGIN, h: 0.55, fontFace: SANS, fontSize: 13, color: INK4, margin: 0, lineSpacingMultiple: 1.2 });
      y += 0.68;
    });

    s.addShape('roundRect', { x: MARGIN, y: 5.15, w: W - MARGIN * 2, h: 1.5, rectRadius: 0.06, fill: { color: '1E2027' }, line: { color: GOOD, width: 1.5 } });
    s.addText('THE ASK', { x: MARGIN + 0.35, y: 5.35, w: 4, h: 0.3, fontFace: SANS, fontSize: 10, bold: true, charSpacing: 2, color: GOOD, margin: 0 });
    s.addText('CEIP fast-track — twelve months to ship the Register to mainnet and land the first three registrars.', {
      x: MARGIN + 0.35,
      y: 5.65,
      w: W - MARGIN * 2 - 0.7,
      h: 0.85,
      fontFace: SERIF,
      fontSize: 18,
      bold: true,
      color: PAPER,
      margin: 0,
      lineSpacingMultiple: 1.2,
    });
    pageNum(s, 12, true);
  }

  await p.writeFile({ fileName: 'dokett-deck.pptx' });
  console.log('wrote dokett-deck.pptx');
}

main();
