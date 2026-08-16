'use strict';

/**
 * The off-chain name and attestation layer.
 *
 * ─── WHY THIS IS NOT ON CHAIN ──────────────────────────────────────────────
 *
 * Invariant I5: no PII, ever. The Register stores `obligor` as a commitment and
 * has no way to reverse it. A display name is personal data, so it lives here —
 * outside the chain, keyed by the commitment, and served only where the subject
 * has consented to disclose it. Revoking disclosure is a delete in this file,
 * not an impossible edit to an immutable ledger.
 *
 * That is also the honest answer to "can we show a verified profile": yes, but
 * the name is a claim about a commitment, not a fact recorded against it.
 *
 * ─── PROVEN vs ATTESTED ────────────────────────────────────────────────────
 *
 * Everything in this file is ATTESTED — somebody said it. That is a different
 * class of fact from the counts the Lens derives from the register, which are
 * PROVEN and recomputable by any stranger with an RPC endpoint.
 *
 * The two must never be rendered as the same kind of bullet. Goldfinch's PDFs
 * looked authoritative too; laundering an assertion into the visual language of
 * evidence is the exact failure this protocol exists to refuse.
 *
 * ─── WHAT MAKES AN ATTESTATION WORTH ANYTHING ─────────────────────────────
 *
 * An issuer, named, with something at stake. A bare checkmark is trust-me-bro
 * with better typography. Each attestation therefore carries its issuer and the
 * CTC that issuer has bonded against being wrong — and an unbonded attestation
 * is displayed visibly weaker, exactly as an unbonded claim already is.
 *
 * Bonded issuance is not implemented on chain yet (see ARCHITECTURE roadmap).
 * Until it is, `bonded` here is fixture data and the Console labels it as such
 * rather than implying a slashing guarantee that does not exist.
 */

/**
 * @typedef {Object} Attestation
 * @property {string} kind      machine-readable class, e.g. 'wallet-control'
 * @property {string} claim     what is being asserted, in plain language
 * @property {string} issuer    the issuer's address
 * @property {string} issuerName
 * @property {string} method    how they checked: 'signature' | 'document' | 'site-visit'
 * @property {string} bondedCtc CTC the issuer has staked against being wrong; '0' = unbonded
 * @property {string} at        ISO date of issuance
 */

/** commitment → disclosed identity. Synthetic throughout; no real entity appears. */
const DIRECTORY = {
  // ── 서울 · 소상공인 working capital, borrowing at two venues ───────────
  ['0x' + 'a1'.repeat(32)]: {
    displayName: '대현상사',
    latinName: 'Daehyun Trading',
    kind: 'business',
    jurisdiction: 'KR',
    sector: 'Food wholesale · Seoul',
    disclosure: 'subject-consented',
    attestations: [
      {
        kind: 'wallet-control',
        claim: 'Controls the payment address on this obligation',
        issuer: 'self',
        issuerName: 'self',
        method: 'signature',
        bondedCtc: '0',
        at: '2026-02-04',
      },
      {
        kind: 'business-registration',
        claim: '사업자등록번호 214-86-51037',
        issuer: '0xAAaaAAaaAaAAAaaAAaAAAAaaAAaAaaAAAaAAAAaa',
        issuerName: '온핀대부 (Onfin Lending)',
        method: 'document',
        bondedCtc: '250000000000000000000',
        at: '2026-02-11',
      },
    ],
  },

  // ── 부산 · the borrower who stopped paying ────────────────────────────
  ['0x' + 'b2'.repeat(32)]: {
    displayName: '한빛식자재',
    latinName: 'Hanbit Food Supply',
    kind: 'business',
    jurisdiction: 'KR',
    sector: 'Catering supply · Busan',
    disclosure: 'subject-consented',
    attestations: [
      {
        kind: 'wallet-control',
        claim: 'Controls the payment address on this obligation',
        issuer: 'self',
        issuerName: 'self',
        method: 'signature',
        bondedCtc: '0',
        at: '2026-01-19',
      },
    ],
  },

  // ── the defaulted 전세-style deposit claim ────────────────────────────
  ['0x' + 'c3'.repeat(32)]: {
    displayName: '정우개발',
    latinName: 'Jeongwoo Development',
    kind: 'business',
    jurisdiction: 'KR',
    sector: 'Property · Incheon',
    disclosure: 'subject-consented',
    attestations: [
      {
        kind: 'business-registration',
        claim: '사업자등록번호 131-81-40922',
        issuer: '0xBBbBbbBBBbBBbBBbbBbbbbBBbBbBBbBbbBbBBbbB',
        issuerName: 'Hanshin Guarantee',
        method: 'document',
        bondedCtc: '0',
        at: '2025-11-02',
      },
    ],
  },

  // ── Lagos · the original walkthrough ─────────────────────────────────
  ['0x' + 'd4'.repeat(32)]: {
    displayName: 'ADA EZE ELECTRONICS',
    latinName: null,
    kind: 'business',
    jurisdiction: 'NG',
    sector: 'Electronics import · Lagos',
    disclosure: 'subject-consented',
    attestations: [
      {
        kind: 'wallet-control',
        claim: 'Controls the payment address on this obligation',
        issuer: 'self',
        issuerName: 'self',
        method: 'signature',
        bondedCtc: '0',
        at: '2025-09-30',
      },
      {
        kind: 'business-registration',
        claim: 'CAC RC-1044821',
        issuer: '0xAAaaAAaaAaAAAaaAAaAAAAaaAAaAaaAAAaAAAAaa',
        issuerName: 'Kredi Ltd',
        method: 'document',
        bondedCtc: '250000000000000000000',
        at: '2025-10-06',
      },
    ],
  },
};

/** Issuers and venues, so the Console can name an address instead of truncating it. */
const ENTITIES = {
  '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': { name: '온핀대부 (Onfin Lending)', kind: 'lender' },
  '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': { name: 'Hanshin Guarantee', kind: 'lender' },
  '0xcccccccccccccccccccccccccccccccccccccccc': { name: '서일캐피탈 (Seoil Capital)', kind: 'underwriter' },
  '0xdddddddddddddddddddddddddddddddddddddddd': { name: 'unidentified registrar', kind: 'unknown' },
};

/**
 * Disclosed identity for a commitment, or null.
 *
 * Null is a normal, expected answer — most subjects will never disclose, and the
 * Console must render an undisclosed profile as complete rather than broken. The
 * proven record stands on its own without a name attached.
 */
function identityOf(commitment) {
  return DIRECTORY[String(commitment).toLowerCase()] || DIRECTORY[commitment] || null;
}

function entityOf(address) {
  if (!address) return null;
  return ENTITIES[String(address).toLowerCase()] || null;
}

module.exports = { identityOf, entityOf, DIRECTORY, ENTITIES };
