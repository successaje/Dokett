#!/usr/bin/env node
'use strict';

/**
 * Lens in demo mode — serves a seeded in-memory projection with no chain.
 *
 * Exists so the Console can be reviewed, screenshotted and developed against
 * without a deployed Register, and so a judge can see the full lifecycle in one
 * screen rather than waiting out a cure window. The fixture deliberately covers
 * every state the UI must handle, including the two it is most tempting to skip:
 * an unbonded (poisoned) claim, and a defaulted obligation with a slashed bond.
 *
 *   node lens/src/demo.js
 *
 * This serves FIXTURES, not chain state. It is not a substitute for the real
 * indexer and is never started by `npm run lens`.
 */

const { Index } = require('./indexer');
const { createServer } = require('./api');

const ALICE = '0x1111111111111111111111111111111111111111';
const BORROWER_2 = '0x2222222222222222222222222222222222222222';
const LENDER_A = '0xAAaaAAaaAaAAAaaAAaAAAAaaAAaAaaAAAaAAAAaa';
const LENDER_B = '0xBBbBbbBBBbBBbBBbbBbbbbBBbBbBBbBbbBbBBbbB';
const UNDERWRITER = '0xCcCCcccCCCcCCCcCcCcCcCCCCcCCCCCcCcccCCcC';
const GRIEFER = '0xDdddDDDdddDDDDddddDddddDDdDDddDdDDDddDDD';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const ASSET = '0x' + 'fe'.repeat(32);

const base = {
  creditor: '0x' + '0'.repeat(64),
  chainKey: 3,
  sourceToken: USDC,
  periodAmount: '1000000000',
  periodsTotal: 3,
  collateralRef: '0x' + '0'.repeat(64),
  coverage: '0',
  periodBlocks: '216000',
};

const OBLIGATIONS = [
  {
    ...base,
    id: '1',
    obligor: '0x' + 'a1'.repeat(32),
    status: 'Current',
    sourcePayer: ALICE,
    sourcePayee: LENDER_A,
    principal: '3000000000',
    outstanding: '2000000000',
    periodsSatisfied: 1,
    startHeight: '22934000',
    windowEndHeight: '23150000',
    cureEndHeight: '23200400',
    lastProvenHeight: '22940120',
    registrar: LENDER_A,
    registrarBond: '1000000000000000000',
    coverage: '500000000',
    bonded: true,
  },
  {
    // The cross-venue moment: a second lender, unaware of the first.
    ...base,
    id: '2',
    obligor: '0x' + 'a1'.repeat(32),
    status: 'Active',
    sourcePayer: ALICE,
    sourcePayee: LENDER_B,
    principal: '1500000000',
    outstanding: '1500000000',
    periodsSatisfied: 0,
    startHeight: '23150000',
    windowEndHeight: '23366000',
    cureEndHeight: '23416400',
    lastProvenHeight: '0',
    registrar: LENDER_B,
    registrarBond: '1000000000000000000',
    bonded: true,
  },
  {
    ...base,
    id: '3',
    obligor: '0x' + 'b2'.repeat(32),
    status: 'Delinquent',
    sourcePayer: BORROWER_2,
    sourcePayee: LENDER_A,
    principal: '3000000000',
    outstanding: '3000000000',
    periodsSatisfied: 0,
    startHeight: '22884000',
    windowEndHeight: '23100000',
    cureEndHeight: '23150400',
    lastProvenHeight: '0',
    registrar: LENDER_A,
    registrarBond: '1000000000000000000',
    coverage: '250000000',
    bonded: true,
  },
  {
    ...base,
    id: '4',
    obligor: '0x' + 'c3'.repeat(32),
    status: 'Default',
    sourcePayer: '0x4444444444444444444444444444444444444444',
    sourcePayee: LENDER_B,
    principal: '2000000000',
    outstanding: '2000000000',
    periodsSatisfied: 0,
    startHeight: '22584000',
    windowEndHeight: '22800000',
    cureEndHeight: '22850400',
    lastProvenHeight: '0',
    registrar: LENDER_B,
    registrarBond: '1000000000000000000',
    collateralRef: ASSET,
    bonded: true,
  },
  {
    ...base,
    id: '5',
    obligor: '0x' + 'd4'.repeat(32),
    status: 'Settled',
    sourcePayer: '0x5555555555555555555555555555555555555555',
    sourcePayee: LENDER_A,
    principal: '3000000000',
    outstanding: '0',
    periodsSatisfied: 3,
    startHeight: '22384000',
    windowEndHeight: '22600000',
    cureEndHeight: '22650400',
    lastProvenHeight: '22598000',
    registrar: LENDER_A,
    registrarBond: '1000000000000000000',
    collateralRef: ASSET,
    bonded: true,
  },
  {
    // The poisoning attempt: a fictional debt registered against Alice with no
    // bond behind it. The Console must show it WITHOUT ever adding it to a total.
    ...base,
    id: '6',
    obligor: '0x' + 'a1'.repeat(32),
    status: 'Active',
    sourcePayer: ALICE,
    sourcePayee: GRIEFER,
    principal: '999000000000',
    outstanding: '999000000000',
    periodsSatisfied: 0,
    startHeight: '23184000',
    windowEndHeight: '23400000',
    cureEndHeight: '23450400',
    lastProvenHeight: '0',
    registrar: GRIEFER,
    registrarBond: '0',
    bonded: false,
  },
];

const BONDS = [
  { bondId: '1', obligationId: '1', underwriter: UNDERWRITER, collateral: USDC, amount: '500000000', spreadBps: 340, slashed: '0', released: false },
  { bondId: '2', obligationId: '3', underwriter: UNDERWRITER, collateral: USDC, amount: '250000000', spreadBps: 420, slashed: '0', released: false },
  { bondId: '3', obligationId: '4', underwriter: UNDERWRITER, collateral: USDC, amount: '400000000', spreadBps: 380, slashed: '400000000', released: false },
  { bondId: '4', obligationId: '5', underwriter: UNDERWRITER, collateral: USDC, amount: '300000000', spreadBps: 300, slashed: '0', released: true },
];

const index = new Index({ getBlockNumber: async () => 4_812_337 }, { register: '0x' + '0'.repeat(40) });
index.lastBlock = 4_812_337;
for (const o of OBLIGATIONS) index.obligations.set(o.id, o);
for (const b of BONDS) index.bonds.set(b.bondId, b);

const port = Number(process.env.PORT || 8787);
createServer(index).listen(port, () => {
  console.log(`lens (DEMO FIXTURES, no chain) on http://localhost:${port}`);
  console.log('');
  console.log('  scenarios');
  console.log(`    대현상사 · cross-venue exposure   ${ALICE}`);
  console.log(`      profile   http://localhost:${port}/profile/0x${'a1'.repeat(32)}`);
  console.log(`      solvency  http://localhost:${port}/solvency/${ALICE}`);
  console.log(`    한빛식자재 · delinquent, cure open ${BORROWER_2}`);
  console.log(`    ADA EZE ELECTRONICS · settled     ${'0x' + 'd4'.repeat(32)}`);
  console.log(`    서일캐피탈 · underwriter          ${UNDERWRITER}`);
  console.log(`    pledged asset (전세-style)        ${ASSET}`);
  console.log(`      encumbrance http://localhost:${port}/encumbrance/${ASSET}`);
});
