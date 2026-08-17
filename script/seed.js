#!/usr/bin/env node
'use strict';

/**
 * Seed the live Register with obligations bound to REAL Ethereum mainnet history.
 *
 * ─── WHY THIS IS POSSIBLE AT ALL ───────────────────────────────────────────
 *
 * Covenant only ever reads. It never needs a payment to be *originated* — so a
 * scenario can be built from transfers that already happened, by registering an
 * obligation whose binding and window match one. That is what lets the whole
 * demo run on mainnet evidence without spending a cent of real money, and it is
 * the reason chainKey 3 was the right choice over Sepolia.
 *
 * ─── WHAT IT BUILDS ────────────────────────────────────────────────────────
 *
 *   1. PAYABLE   window contains a real transfer → can be proven Current
 *   2. SILENT    window long closed, no matching payment → will go Delinquent
 *   3. SECOND    same obligor as (1), different creditor → the cross-venue query
 *
 *   npm run seed
 */

const { ethers } = require('ethers');

const REGISTER_ABI = [
  'function register((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init, uint64 expectedChainId) payable returns (uint256)',
  'function nextId() view returns (uint256)',
  'function statusOf(uint256) view returns (uint8)',
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
];
const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const erc20 = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

/** A single-log USDC transfer, deep enough below the attested head to be provable. */
async function findTransfer(src, from) {
  for (let b = from; b > from - 20; b--) {
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
      return {
        hash: tx.hash,
        block: b,
        from: parsed.args.from,
        to: parsed.args.to,
        value: parsed.args.value,
      };
    }
  }
  throw new Error('no suitable USDC transfer found');
}

async function main() {
  const d = require('../deployments/102031.json');
  const chainKey = Number(need('CHAIN_KEY'));
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const cc = new ethers.JsonRpcProvider(process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network');
  const w = new ethers.Wallet(need('PRIVATE_KEY'), cc);
  const reg = new ethers.Contract(d.register, REGISTER_ABI, w);

  const bond = await reg.MIN_REGISTRAR_BOND();
  const fund = await reg.MIN_KEEPER_FUND();
  const escrow = bond + fund;

  const head = await src.getBlockNumber();
  // 200 blocks back keeps it comfortably below the attested head (~35 lag) and
  // past minConfirmations (64), so it is provable immediately.
  const payment = await findTransfer(src, head - 200);

  console.log('anchor transfer (real Ethereum mainnet)');
  console.log(`  tx     ${payment.hash}`);
  console.log(`  block  ${payment.block}`);
  console.log(`  from   ${payment.from}`);
  console.log(`  to     ${payment.to}`);
  console.log(`  value  ${ethers.formatUnits(payment.value, 6)} USDC`);

  const PERIOD = 216_000n; // ~30 days at 12s
  const CURE = 50_400n; // ~7 days
  const salt = ethers.hexlify(ethers.randomBytes(16));
  const obligor = ethers.keccak256(ethers.solidityPacked(['string', 'bytes16'], ['대현상사', salt]));
  const creditorA = ethers.keccak256(ethers.toUtf8Bytes('온핀대부 · Onfin Lending'));
  const creditorB = ethers.keccak256(ethers.toUtf8Bytes('Vault B'));

  // Window 1 must CONTAIN the anchor: startHeight < block <= startHeight+PERIOD.
  const payableStart = BigInt(payment.block) - PERIOD / 2n;

  // A window that closed long ago, with no matching payment, so the keeper can
  // legitimately mark it delinquent.
  const silentStart = BigInt(payment.block) - PERIOD * 4n;

  const base = {
    creditorPayout: w.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(USDC),
    aprBps: 340,
    periodBlocks: PERIOD,
    cureBlocks: CURE,
    seniority: 0,
    collateralRef: ethers.ZeroHash,
  };

  const scenarios = [
    {
      label: 'PAYABLE  — window contains a real transfer, provable now',
      init: {
        ...base,
        obligor,
        creditor: creditorA,
        sourcePayer: payment.from,
        sourcePayee: payment.to,
        principal: payment.value * 3n,
        periodAmount: payment.value,
        startHeight: payableStart,
        periodsTotal: 3,
      },
    },
    {
      label: 'SILENT   — window long closed, nothing to prove → Delinquent',
      init: {
        ...base,
        obligor,
        creditor: creditorA,
        // A payer that never paid this payee. The point is the absence.
        sourcePayer: ethers.getAddress('0x' + '11'.repeat(20)),
        sourcePayee: payment.to,
        // periodAmount * periodsTotal must cover principal — the Register
        // refuses a schedule that cannot be satisfied by design, and 3 x 1.666B
        // falls 2 USDC short of 5B. Derive the period from the principal
        // instead of hand-writing both.
        principal: 5_000_000_000n,
        periodAmount: (5_000_000_000n + 2n) / 3n,
        startHeight: silentStart,
        periodsTotal: 3,
      },
    },
    {
      label: 'SECOND   — same obligor, different creditor → cross-venue query',
      init: {
        ...base,
        obligor,
        creditor: creditorB,
        sourcePayer: payment.from,
        sourcePayee: ethers.getAddress('0x' + '22'.repeat(20)),
        principal: 1_500_000_000n,
        periodAmount: 500_000_000n,
        startHeight: payableStart,
        periodsTotal: 3,
      },
    },
  ];

  // Assert every schedule locally before spending gas discovering it on chain.
  for (const s of scenarios) {
    const covers = s.init.periodAmount * BigInt(s.init.periodsTotal);
    if (covers < s.init.principal) {
      throw new Error(
        `${s.label.split('—')[0].trim()}: ${s.init.periodsTotal} x ${s.init.periodAmount} = ${covers} ` +
          `cannot clear principal ${s.init.principal}`,
      );
    }
  }

  console.log(`\nregistering ${scenarios.length} obligations (${ethers.formatEther(escrow)} CTC escrow each)\n`);
  const created = [];

  for (const s of scenarios) {
    const tx = await reg.register(s.init, 1n, { value: escrow, gasLimit: 900_000 });
    const rx = await tx.wait();
    const id = (await reg.nextId()) - 1n;
    created.push({ id, ...s });
    console.log(`  #${id}  ${s.label}`);
    console.log(`      ${tx.hash}  (status ${rx.status})`);
  }

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' SEEDED ON LIVE CC3 TESTNET');
  console.log(` Register  ${d.register}`);
  console.log(` obligor   ${obligor}`);
  console.log(` anchor tx ${payment.hash}`);
  console.log('');
  console.log(' next:');
  console.log(`   npm run prove:payment ${created[0].id} ${payment.hash}`);
  console.log(`   npm run lens        # then open the Console`);
  console.log('──────────────────────────────────────────────────────────\n');

  require('node:fs').writeFileSync(
    'deployments/seed-102031.json',
    JSON.stringify(
      {
        register: d.register,
        obligor,
        salt,
        anchorTx: payment.hash,
        anchorBlock: payment.block,
        obligations: created.map((c) => ({ id: c.id.toString(), label: c.label })),
      },
      null,
      2,
    ) + '\n',
  );
  console.log('wrote deployments/seed-102031.json');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
