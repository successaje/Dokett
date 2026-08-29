# Dokett — Threat Model

**Version** 0.1 · 29 Jul 2026 · pre-build
**Scope** CC3 testnet hackathon build, written so it stays valid for mainnet
**Companion** [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## 1. What we are protecting

| Asset | Loss if compromised |
|---|---|
| **Integrity of the record** | The entire product. A registry that can be written falsely is worse than no registry — it launders bad credit into good. |
| **Bonded capital** | Underwriter principal, slashable to creditors. Direct financial loss. |
| **Availability of degradation** | If delinquency marking can be censored or stalled, defaults never register and the record silently lies. |
| **Obligor privacy** | Commitments must not be reversible into identities at scale. |
| **Obligor due process** | A wrongly-marked default that cannot be cured is a real-world harm to a real person. |

## 2. Actors

| Actor | Trusted for | Not trusted for |
|---|---|---|
| ASC attestor set | Honest majority within quorum on Ethereum history | Availability; independence (permissioned, `AuthorizedOnly`, mainnet `MinBondRequirement = 0`, no documented slashing) |
| Creditcoin validators | Liveness + BLS aggregate verification + finality | Nothing beyond consensus |
| Proof Builder service | Producing correct proofs (verifiable, so it can only censor, not forge) | Availability, censorship-resistance |
| Keepers | Nothing — permissionless, bounty-driven, adversarially replaceable | Everything |
| Registrars / creditors | Nothing. Bonded, weighted, disputable | Truthfulness |
| Underwriters | Their own capital | Independence from the obligor |
| Obligors | Nothing | — |
| Protocol admin | Adapter allowlist behind a 48h timelock | Anything unilateral or fast |

**Stated trust assumption, verbatim for the README:** *Dokett inherits the trust model of the ASC attestor set. As of July 2026 that set is permissioned (`AuthorizedOnly`), with a mainnet minimum bond of 0 CTC and no publicly documented slashing regime. Dokett is therefore, today, a system with a curated federation at its evidence root — materially stronger than a multisig bridge, materially weaker than a ZK light client. We cap per-obligation exposure accordingly and treat attestor decentralisation as the protocol's most important external dependency.*

Say this before a judge finds it. Volunteering your weakest assumption is the strongest credibility move available to you.

---

## 3. Threats

### T-01 — Forged payment proof (attestor collusion)
**Vector.** A quorum of attestors attests to a fabricated Ethereum history; a fake repayment clears an obligation and prevents a legitimate slash.
**Severity.** Critical · **Likelihood.** Low (requires quorum collusion)
**Mitigation.** Cannot be fixed at the application layer — inherited. Compensating controls: per-obligation exposure caps; require ≥N independent attestor operators before an obligation over a size threshold is eligible for bonding; publish the trust statement; design `AscVerify` so a second evidence backend (ZK storage proofs, an alternate messaging layer) can be swapped without touching `Register`.
**Residual.** Accepted and disclosed.

### T-02 — Failed-transaction acceptance ⚠️ *most likely real bug in the ecosystem*
**Vector.** The `BlockProver` precompile **does not validate transaction success**. A reverted ERC-20 transfer is still a validly-included transaction. An attacker submits a proof of a reverted `Transfer` to clear a payment window for free.
**Severity.** Critical · **Likelihood.** **High** if unguarded
**Mitigation.** `AscVerify` decodes the receipt status and requires `0x1` before any adapter logic runs. Adapters cannot reach the precompile except through `AscVerify`. Dedicated unit test with a real reverted mainnet tx as the fixture.
**Note.** Ship this guard as a standalone MIT contract for the ecosystem. It is both a genuine public good and the single best positioning artifact in your submission.

### T-03 — Proof replay
**Vector.** One legitimate payment proof reused to satisfy multiple windows, multiple obligations, or the same window after a cure.
**Severity.** High · **Likelihood.** High if unguarded
**Mitigation.** `consumed[keccak256(chainKey, txHash, logIndex, loId)]`. Keyed with `loId` so the *same* transaction cannot satisfy two obligations, and with `logIndex` so a multi-transfer transaction is decomposed correctly. Window-boundary check on `sourceTimestamp` prevents a single payment sliding forward across periods beyond `value / periodAmount`.

### T-04 — Griefing by false delinquency
**Vector.** An adversary calls `markDelinquent()` on a healthy obligation to damage a borrower's record or trigger a slash.
**Severity.** Medium · **Likelihood.** Medium
**Mitigation.** Delinquency is not an assertion — it requires the on-chain fact that no admissible proof was presented before `windowEndsAt + attestationBuffer`. If a payment did occur, **anyone** can cure it during the cure window with the proof (I4), and the record shows *cured-late*, not default. Keeper bounties are paid from the obligation's own `keeperFund`, so griefing has no profit and the marker gains nothing by being early — they cannot be early.
**Residual.** A borrower who paid but whose proof nobody submits within `window + buffer + cure` is wrongly defaulted. Mitigated by: permissionless submission, cost of ~$0.000024, a 7-day cure, borrower self-service in the UI, and keepers economically motivated to find payments. **This residual risk is the honest price of having no trusted reporter, and should be stated as such.**

### T-05 — Proof-submission censorship
**Vector.** The hosted Proof Builder is down or refuses to serve a proof, so a real payment cannot be evidenced and the obligation defaults.
**Severity.** High · **Likelihood.** Medium
**Mitigation.** Proofs are verifiable, so a builder can censor but never forge. Run a self-hosted builder alongside the hosted one; the keeper falls back automatically. The cure window is long relative to builder outages. Document self-hosting in the README so any party can independently produce a proof.

### T-06 — Attestation stall → mass false defaults ⚠️ *most dangerous systemic failure*
**Vector.** The attestor set halts or falls behind. No payment proofs can be produced for anyone. Every live obligation blows through its window simultaneously and the keeper network mass-defaults the entire book.
**Severity.** **Critical** · **Likelihood.** Medium (permissioned set, small operator count)
**Mitigation.** Global circuit breaker in `AscVerify` (invariant I6): read the attested head from `ChainInfo`; if it is staler than `STALE_THRESHOLD` (2h), **`markDelinquent()` and `finalizeDefault()` revert**, and live windows extend by the stall duration once the head recovers. Payment proving is never paused — a stall must never manufacture a default, and must never block a cure.
**Test.** Explicit fork test: freeze the attested head, assert every degradation path reverts, unfreeze, assert windows extended and no obligation defaulted.

### T-07 — Source-chain reorg
**Vector.** A proven payment is reorged out of Ethereum after being consumed on Creditcoin.
**Severity.** Medium · **Likelihood.** Low
**Mitigation.** `MIN_CONFIRMATIONS` (64 blocks) enforced against the attested head before a proof is admissible. Attestation itself lags finality. Depth is a per-chain config parameter, not a constant.

### T-08 — Registry defamation / spam
**Vector.** Anyone can register an obligation against any address. An adversary registers fake debts against a competitor to poison their solvency reading, or floods the registry to make the Lens useless.
**Severity.** Medium–High (this is the classic registry attack, and the reason most registries end up permissioned)
**Mitigation.** Invariant I7 — registration is permissionless, *weight* is bonded. `MIN_REGISTRAR_BOND` in CTC prices spam. The Lens returns bonded and unbonded claims in **separate buckets** and never sums them into one number. Registrar track record (settled vs. disputed vs. abandoned) is a derived, public view. `dispute()` lets an obligor flag a claim permissionlessly and cheaply; disputed claims are visibly quarantined. Long-term: forfeiture of registrar bond on adjudicated bad-faith registration.
**Honest limitation for v1:** the hackathon build prices spam but does not adjudicate defamation. Say so.

### T-09 — Wash underwriting
**Vector.** An obligor bonds themselves through a sock puppet to manufacture a creditworthy track record, or a registrar/creditor/underwriter tri-collusion fabricates a clean repayment history.
**Severity.** Medium · **Likelihood.** Medium
**Mitigation.** Fabricating history requires **real on-chain payments through real ERC-20 transfers**, so a wash history costs its face value in capital movement and gas — it is not free the way a self-reported score is. The Lens exposes counterparty-graph concentration (what share of an obligor's history involves a single registrar/underwriter cluster) so consumers can discount it. Independent-capital weighting in reputation.
**Residual.** Cannot be eliminated without identity. Dokett's position is that it does not solve identity — it makes identity someone's *priced* problem.

### T-10 — Reentrancy / accounting bugs in slashing
**Vector.** Malicious ERC-20 collateral reenters `slash()`; rounding drains the bond; pro-rata across multiple bonds double-pays.
**Severity.** Critical · **Likelihood.** Medium
**Mitigation.** Checks-effects-interactions everywhere; `nonReentrant` on `slash()`/`release()`; allowlist of collateral tokens in v1 (no arbitrary ERC-20 as bond collateral); `slash()` callable only by `Register`; Foundry invariant tests: `Σ slashed + Σ released ≤ Σ posted`, `outstanding` monotonically non-increasing, `periodsSatisfied ≤ periodsTotal`.

### T-11 — Bounty economics failure
**Vector.** Keeper bounty is worth less than gas, so nobody marks delinquencies and the record silently rots — a slow-motion version of T-06.
**Severity.** High · **Likelihood.** Medium
**Mitigation.** `keeperFund` escrowed at registration, sized as a multiple of worst-case verification cost (the cost model tops out at 0.0375 CTC even for a maximal decode, so this is cheap to over-fund). Creditors and underwriters have standing economic reasons to run keepers themselves — they are the ones being made whole. Fund is refunded to the registrar on `Settled`.

### T-12 — Privacy: commitment reversal
**Vector.** `obligor = keccak256(identityRef, salt)`. If `identityRef` is low-entropy (a phone number, a national ID) and `salt` is weak or reused, the commitment is trivially brute-forced. Separately, `sourcePayer`, `sourcePayee` and all amounts are public by construction.
**Severity.** High for real borrowers · **Likelihood.** High if unmanaged
**Mitigation.** Enforce ≥128-bit salt, generated client-side, never reused across obligations, never transmitted to the registrar. Amounts and payment addresses are **public in v1 and this is documented, not hidden** — the roadmap answer is a source-chain payment router giving each obligation an ephemeral payer address, plus ZK selective disclosure over the schedule tree.
**Rule.** Never demo with a real person's data, even fabricated-looking data. Use obviously synthetic identities.

### T-13 — Admin key compromise
**Vector.** The adapter allowlist is the write path to the record. An attacker who controls it installs a malicious adapter that transitions obligations arbitrarily.
**Severity.** Critical · **Likelihood.** Low
**Mitigation.** 48h timelock on adapter changes; the allowlist is the *only* privileged surface; every privileged function enumerated in the README; multisig at mainnet; explicit ossification plan (adapters become append-only, then frozen). No pause on payment proving — an admin must never be able to freeze a borrower's ability to cure.

### T-14 — Chainkey misconfiguration
**Vector.** Chainkeys differ per environment — Sepolia is 1 and Ethereum mainnet is 3 on CC3 testnet, but Ethereum mainnet is 1 on CC3 mainnet. A hardcoded value verifies proofs against the wrong chain.
**Severity.** High · **Likelihood.** **High** — this will bite someone in this hackathon
**Mitigation.** Resolve chainkeys from `ChainInfo` at deploy time, store per-network, assert at startup, never hardcode. Deploy-script assertion that the resolved chainkey matches the expected genesis.

### T-15 — Regulatory
**Vector.** Operating a record of consumer obligations engages FCRA-style consumer-reporting regimes (US) and GDPR erasure rights (EU); slashing third-party capital on default may constitute a financial guarantee product in some jurisdictions.
**Severity.** Existential at scale · **Likelihood.** Certain, eventually
**Mitigation (roadmap, not hackathon).** Entity/wallet obligations first, consumer corridors only through licensed local partners; commitments-not-PII; obligor-held revocable disclosure keys; constitutional consumer-rights layer in governance (cure windows, dispute rights, disclosure revocation changeable only by supermajority + long timelock). Precedent to lean on: the Gluwa–Central Bank of Nigeria eNaira partner-agent relationship is a template for building *with* a regulator.
**Hackathon posture.** Testnet, synthetic data, explicitly stated in the README.

---

## 4. Protocol invariants (assert these in tests)

```
INV-1  Σ slashed + Σ released ≤ Σ posted                      (no bond inflation)
INV-2  outstanding is monotonically non-increasing
INV-3  periodsSatisfied ≤ periodsTotal
INV-4  every status transition is preceded by either a verified proof
       or a timestamp comparison — never by a caller's argument
INV-5  no proof key (chainKey, txHash, logIndex, loId) is consumed twice
INV-6  chainLive(chainKey) == false ⟹ no LO can reach Delinquent or Default
INV-7  status == Default ⟹ cureEndsAt < block.timestamp
INV-8  a proof whose sourceTimestamp ∈ missed window always cures,
       regardless of submission time, while cureEndsAt has not passed
INV-9  no privileged role can transition an LO's status directly
INV-10 no privileged role can prevent a cure
```

INV-4, INV-9 and INV-10 are the thesis expressed as testable properties. If a reviewer reads only one section of this document, make it this one.

---

## 5. Audit posture

All three winning teams receive **8k CertiK credits toward a repository audit + 3 months Skynet Boost**. Build for that from day one so the credits land on a codebase that can actually use them:

- NatSpec on every external function, including a `@custom:security` note on each privileged path
- `slither` + `forge test --fuzz-runs 10000` in CI from the first commit
- A `SECURITY.md` with the trust statement from §2 verbatim
- Every threat in this document mapped to the test that covers it
- Known-limitations section in the README covering T-08 (defamation), T-09 (wash underwriting), T-12 (v1 privacy) and the T-04 residual

A submission that ships its own threat model, names its residual risks, and hands the auditor a mapped test suite reads like a company. That is the difference between third place and the CEIP fast-track.
