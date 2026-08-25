#!/usr/bin/env node
'use strict';

/**
 * Register one obligation that will sit in DELINQUENT and stay curable.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The cure path is the most human part of this protocol: a borrower who was
 * marked delinquent — because no proof arrived, not because anyone determined
 * they had not paid — can restore their own record by proving the payment,
 * however late. The Console renders that form only for delinquent obligations
 * (`if (!curable) return null`), so with nothing delinquent in the register the
 * entire cure path is unreachable and the relay has nothing to serve.
 *
 * This registers exactly one obligation designed to make it reachable.
 *
 * ─── THE THREE PROPERTIES IT NEEDS ─────────────────────────────────────────
 *
 *   1. WINDOW ALREADY CLOSED, past minConfirmations, so the live keeper marks
 *      it Delinquent on its next sweep without anything being fast-forwarded.
 *
 *   2. GENUINELY CURABLE — the window must contain a REAL Ethereum USDC
 *      transfer matching the obligation's binding, so the cure actually
 *      succeeds on-chain rather than appearing to.
 *
 *   3. A LONG CURE WINDOW (~30 days) so it stays delinquent through judging
 *      instead of defaulting in minutes. This is also the more realistic
 *      schedule: a 30-day cure is ordinary commercial credit, where the
 *      ~7-minute one used for the autonomous-default test was payday-style.
 *
 * ─── WHY THE KEEPER WON'T CURE IT FIRST ────────────────────────────────────
 *
 * The keeper's scan only ever moves FORWARD (`fromBlock: cursor + 1`). Because
 * the anchor transfer is already behind the running keeper's cursor, the keeper
 * will never see that log and so can never auto-prove it. It will mark the
 * obligation delinquent and then leave it alone — which is precisely the state
 * a visitor needs in order to cure it themselves.
 *
 * Nothing here is simulated. Every field is an ordinary schedule parameter.
 *
 *   npm run seed:curable
 */

const { ethers } = require('ethers');

const REGISTER_ABI = [
  'function register((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init, uint64 expectedChainId) payable returns (uint256)',
  'function nextId() view returns (uint256)',
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
];
const VERIFIER_ABI = [
  'function penaltiesEnabled(uint64) view returns (bool)',
  'function attestedHead(uint64) view returns (uint64)',
  'function minConfirmations() view returns (uint64)',
];

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const erc20 = new ethers.Interface([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
]);

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

/** A single-log USDC transfer at or below `from`, so the binding is unambiguous. */
async function findTransfer(src, from) {
  for (let b = from; b > from - 40; b--) {
    let blk;
    try {
      blk = await src.getBlock(b, true);
    } catch {
      continue;
    }
    if (!blk) continue;
    for (const tx of blk.prefetchedTransactions || []) {
      if (!tx.to || tx.to.toLowerCase() !== USDC) continue;
      const rx = await src.getTransactionReceipt(tx.hash);
      if (!rx || rx.status !== 1 || rx.logs.length !== 1) continue;
      const parsed = erc20.parseLog({ topics: [...rx.logs[0].topics], data: rx.logs[0].data });
      if (parsed.args.value === 0n) continue;
      return {
        hash: tx.hash,
        block: b,
        from: parsed.args.from,
        to: parsed.args.to,
        value: parsed.args.value,
      };
    }
  }
  throw new Error('no suitable single-log USDC transfer found');
}

async function main() {
  const d = require('../deployments/102031.json');
  const chainKey = Number(need('CHAIN_KEY'));
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const cc = new ethers.JsonRpcProvider(
    process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network',
  );
  const w = new ethers.Wallet(need('PRIVATE_KEY'), cc);

  const reg = new ethers.Contract(d.register, REGISTER_ABI, w);
  const verifier = new ethers.Contract(d.ascVerifier, VERIFIER_ABI, cc);

  // I7: refuse to proceed rather than route around the liveness gate.
  const enabled = await verifier.penaltiesEnabled(chainKey);
  if (!enabled) {
    throw new Error(
      'penaltiesEnabled is false — the keeper has not built a continuous hour of observation. ' +
        'markDelinquent would correctly refuse. Wait for I7; do not route around it.',
    );
  }

  const attested = await verifier.attestedHead(chainKey);
  const conf = await verifier.minConfirmations();
  console.log(`attested head ${attested} · minConfirmations ${conf}`);

  // Anchor comfortably below the attested head so the closed window is already
  // past minConfirmations the moment it is registered.
  const anchor = await findTransfer(src, Number(attested) - 260);
  console.log(`\nanchor transfer (real Ethereum mainnet)`);
  console.log(`  tx     ${anchor.hash}`);
  console.log(`  block  ${anchor.block}`);
  console.log(`  from   ${anchor.from}`);
  console.log(`  to     ${anchor.to}`);
  console.log(`  value  ${ethers.formatUnits(anchor.value, 6)} USDC`);

  const windowEnd = attested - 150n; // closed, and >150 blocks deep
  const startHeight = BigInt(anchor.block) - 1000n; // window contains the anchor
  const periodBlocks = windowEnd - startHeight;
  const cureBlocks = 216_000n; // ~30 days at 12s — stays curable through judging

  if (BigInt(anchor.block) <= startHeight || BigInt(anchor.block) > windowEnd) {
    throw new Error(
      `anchor block ${anchor.block} is not inside the window (${startHeight}, ${windowEnd}]`,
    );
  }
  if (windowEnd + conf > attested) {
    throw new Error(`window end ${windowEnd} is not yet ${conf} confirmations deep`);
  }

  // The payment must clear the period amount, or the adapter refuses it as a
  // partial payment. Bind the period to the anchor's actual value.
  const periodAmount = anchor.value;

  /*
   * THREE periods, not one — and this matters more than it looks.
   *
   * With periodsTotal = 1, proving the missed period satisfies the entire
   * schedule, so the cure lands on SETTLED. That is correct behaviour, but it
   * is the wrong demonstration: every piece of copy in this project promises
   * that curing "restores the obligation to Current". Settling it outright also
   * consumes the obligation, leaving nothing delinquent behind.
   *
   * With three periods, the cure produces exactly what the Console describes —
   * Current, 1 of 3 proven — and period two's window is still open, so the
   * keeper will not immediately re-mark it delinquent.
   */
  const periodsTotal = 3;

  const init = {
    obligor: ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'bytes16'],
        ['남대문상사 · Namdaemun Trading', ethers.hexlify(ethers.randomBytes(16))],
      ),
    ),
    creditor: ethers.keccak256(ethers.toUtf8Bytes('한강금융 · Hangang Finance')),
    creditorPayout: w.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(USDC),
    sourcePayer: anchor.from,
    sourcePayee: anchor.to,
    principal: periodAmount * BigInt(periodsTotal),
    periodAmount,
    aprBps: 310,
    startHeight,
    periodBlocks,
    cureBlocks,
    periodsTotal,
    seniority: 0,
    collateralRef: ethers.ZeroHash,
  };

  const bond = await reg.MIN_REGISTRAR_BOND();
  const fund = await reg.MIN_KEEPER_FUND();

  console.log(`\nschedule`);
  console.log(`  window       (${startHeight}, ${windowEnd}]  — already closed`);
  console.log(`  cure closes  ${windowEnd + cureBlocks}  (~30 days of Ethereum blocks)`);
  console.log(`  periodAmount ${ethers.formatUnits(periodAmount, 6)} USDC × ${periodsTotal} periods`);

  const tx = await reg.register(init, 1n, { value: bond + fund, gasLimit: 900_000 });
  await tx.wait();
  const id = (await reg.nextId()) - 1n;

  console.log(`\nregistered #${id} — ${tx.hash}`);

  require('node:fs').writeFileSync(
    'deployments/seed-curable-102031.json',
    JSON.stringify(
      {
        obligationId: id.toString(),
        anchorTx: anchor.hash,
        anchorBlock: anchor.block,
        windowEnd: windowEnd.toString(),
        cureEnd: (windowEnd + cureBlocks).toString(),
        registerTx: tx.hash,
      },
      null,
      2,
    ) + '\n',
  );

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' A STANDING, CURABLE DELINQUENCY');
  console.log(` obligation  #${id}`);
  console.log(` cure with   ${anchor.hash}`);
  console.log('');
  console.log(' The keeper marks it Delinquent on its next sweep (<=60s). It cannot');
  console.log(' auto-cure it: the anchor log is behind the keeper\'s forward-only scan');
  console.log(' cursor, so only an explicit cure can restore it.');
  console.log('');
  console.log(` watch: curl -s https://covenant-lens.fly.dev/obligation/${id}`);
  console.log(` cure:  https://covenant-console.vercel.app/#/obligation/${id}`);
  console.log('──────────────────────────────────────────────────────────\n');
  console.log('wrote deployments/seed-curable-102031.json');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
