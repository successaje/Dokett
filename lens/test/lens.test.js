'use strict';

/**
 * Lens projection tests.
 *
 * These run against a stub contract layer rather than a live chain: the point is
 * to pin the PROJECTION rules — especially the bonded/unbonded separation, which
 * is the one place the Lens exercises judgement and therefore the one place it
 * could quietly start lying.
 *
 *   node --test lens/test/
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { Index } = require('../src/indexer');

/** Minimal stand-in for the Register/Bond contracts and provider. */
function stubIndex(obligations, bonds = []) {
  const idx = new Index({ getBlockNumber: async () => 100 }, { register: '0x' + '1'.repeat(40) });
  idx.lastBlock = 100;
  for (const o of obligations) idx.obligations.set(o.id, o);
  for (const b of bonds) idx.bonds.set(b.bondId, b);
  return idx;
}

const ALICE = '0x' + 'a'.repeat(40);
const RIVAL = '0x' + 'b'.repeat(40);
const ASSET = '0x' + 'c'.repeat(64);

function obligation(over = {}) {
  return {
    id: '1',
    obligor: '0x' + '0'.repeat(64),
    creditor: '0x' + '0'.repeat(64),
    status: 'Current',
    chainKey: 3,
    sourceToken: '0x' + 'd'.repeat(40),
    sourcePayer: ALICE,
    sourcePayee: RIVAL,
    outstanding: '1000',
    principal: '1000',
    periodAmount: '100',
    periodsTotal: 3,
    periodsSatisfied: 1,
    windowEndHeight: '716000',
    cureEndHeight: '766400',
    lastProvenHeight: '700000',
    registrar: RIVAL,
    registrarBond: '1000000000000000000',
    collateralRef: '0x' + '0'.repeat(64),
    coverage: '0',
    bonded: true,
    provenance: 'RegistrarAsserted',
    subjectSigner: '0x' + '0'.repeat(40),
    termsHash: '0x' + '0'.repeat(64),
    dispute: null,
    ...over,
  };
}

test('solvency surfaces claims a second lender could not otherwise see', () => {
  const idx = stubIndex([obligation({ id: '1' }), obligation({ id: '2', outstanding: '2500' })]);
  const r = idx.solvency(ALICE);

  assert.equal(r.bonded.count, 2);
  assert.equal(r.bonded.outstanding, '3500');
});

/**
 * THE POISONING ATTACK. Registration is permissionless by design, so anyone can
 * register fictional debts against a competitor. If the Lens summed everything
 * into one number, that attack would land for free.
 */
test('bonded and unbonded claims are never summed', () => {
  const idx = stubIndex([
    obligation({ id: '1', outstanding: '1000', registrarBond: '1000000000000000000', bonded: true }),
    obligation({ id: '2', outstanding: '999999', registrarBond: '0', bonded: false }),
  ]);

  const r = idx.solvency(ALICE);

  assert.equal(r.bonded.outstanding, '1000');
  assert.equal(r.unbonded.outstanding, '999999');
  assert.equal(r.bonded.count, 1);
  assert.equal(r.unbonded.count, 1);
  assert.ok(!('total' in r), 'a combined total must not exist: it would be trivially poisoned');
  assert.match(r.note, /must not be summed/);
});

test('adverse history is reported separately from outstanding balance', () => {
  const idx = stubIndex([
    obligation({ id: '1', status: 'Default' }),
    obligation({ id: '2', status: 'Current' }),
  ]);

  const r = idx.solvency(ALICE);
  assert.equal(r.adverse.count, 1);
  assert.deepEqual(r.adverse.statuses, [{ id: '1', status: 'Default' }]);
});

test('an authenticated subject dispute is quarantined from solvency totals', () => {
  const idx = stubIndex([
    obligation({ id: '1', outstanding: '1000' }),
    obligation({
      id: '2',
      outstanding: '9000',
      provenance: 'SubjectAuthorized',
      dispute: {
        reasonCode: '0x' + '1'.repeat(64),
        signer: ALICE,
        authenticated: true,
      },
    }),
  ]);

  const r = idx.solvency(ALICE);
  assert.equal(r.bonded.outstanding, '1000');
  assert.equal(r.disputed.outstanding, '9000');
  assert.equal(r.disputed.count, 1);
});

test('an unauthenticated legacy dispute cannot quarantine a claim', () => {
  const idx = stubIndex([
    obligation({
      id: '1',
      dispute: {
        reasonCode: '0x' + '1'.repeat(64),
        signer: '0x' + '0'.repeat(40),
        authenticated: false,
      },
    }),
  ]);

  const r = idx.solvency(ALICE);
  assert.equal(r.bonded.count, 1);
  assert.equal(r.disputed.count, 0);
});

test('encumbrance ignores terminated claims', () => {
  const idx = stubIndex([
    obligation({ id: '1', collateralRef: ASSET, status: 'Settled' }),
    obligation({ id: '2', collateralRef: ASSET, status: 'Delinquent' }),
  ]);

  const r = idx.encumbrance(ASSET);
  assert.equal(r.encumbered, true);
  assert.equal(r.claims.length, 1, 'a settled claim no longer encumbers the asset');
  assert.equal(r.claims[0].id, '2');
});

test('unpledged asset reads as unencumbered', () => {
  const idx = stubIndex([obligation({ id: '1' })]);
  assert.equal(idx.encumbrance(ASSET).encumbered, false);
});

test('underwriter reputation is derived from history, not stored', () => {
  const idx = stubIndex(
    [obligation()],
    [
      { bondId: '1', obligationId: '1', underwriter: ALICE, collateral: RIVAL, amount: '1000', slashed: '250', spreadBps: 340, released: false },
      { bondId: '2', obligationId: '1', underwriter: ALICE, collateral: RIVAL, amount: '1000', slashed: '0', spreadBps: 340, released: true },
    ],
  );

  const r = idx.underwriter(ALICE);
  assert.equal(r.bondsWritten, 2);
  assert.equal(r.totalPosted, '2000');
  assert.equal(r.totalSlashed, '250');
  assert.equal(r.lossRateBps, 1250, '250/2000 = 12.5%');
});

test('unknown obligation returns null rather than an empty shell', () => {
  assert.equal(stubIndex([]).obligation('99'), null);
});

/**
 * THE REGRESSION THAT MATTERS MOST.
 *
 * `bonded` used to be computed as `registrarBond > 0n` — the current escrow
 * balance. `Register._refundEscrow` is called on exactly one event, settlement,
 * so paying a loan off in full zeroed the field and the projection reclassified
 * the claim as UNBONDED.
 *
 * The result was the precise inverse of the product: a borrower who repaid
 * everything had `obligationsRegistered: 0` and `paymentsProven: 0`, and their
 * settled loan sat in the bucket this API's own note describes as carrying no
 * weight. Verified live on obligation #8 before the fix.
 *
 * Registration is the only path that creates an obligation and it reverts below
 * MIN_REGISTRAR_BOND, so bonded-at-registration is a historical fact that
 * settlement cannot revoke.
 */
test('settling an obligation does not erase that it was bonded', () => {
  const settled = obligation({
    id: '1',
    status: 'Settled',
    outstanding: '0',
    periodsSatisfied: 3,
    registrarBond: '0', // refunded by _refundEscrow on settlement
    bonded: true, // …but it was bonded when it was registered, and still was
    escrowReleased: true,
  });

  const r = stubIndex([settled]).solvency(ALICE);

  assert.equal(r.bonded.count, 1, 'a repaid loan stays in the bonded bucket');
  assert.equal(r.unbonded.count, 0, 'and never lands beside weightless claims');
});

test('a borrower who repaid in full has a provable history', () => {
  const settled = obligation({
    id: '1',
    status: 'Settled',
    outstanding: '0',
    periodsSatisfied: 3,
    registrarBond: '0',
    bonded: true,
    escrowReleased: true,
  });

  const p = stubIndex([settled]).profile(ALICE);

  assert.equal(p.proven.obligationsRegistered, 1, 'the loan is still on the record');
  assert.equal(p.proven.paymentsProven, 3, 'and so are the payments that closed it');
});
