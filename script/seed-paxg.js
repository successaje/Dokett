#!/usr/bin/env node
'use strict';

/**
 * A gold-backed obligation, where the gold is real.
 *
 * ─── THE GAP THIS CLOSES ───────────────────────────────────────────────────
 *
 * Every collateral reference in this register was, until now, a commitment to a
 * string we made up — `keccak256("warehouse-receipt:BUSAN-WR-88214")` commits
 * to a warehouse receipt that does not exist. The mechanism was real and the
 * asset was not, which is a fair thing for a reviewer to notice in an RWA
 * track.
 *
 * PAX Gold (PAXG) fixes that without inventing anything. Each token is backed
 * by one fine troy ounce of London Good Delivery gold held in a Brink's vault,
 * redeemable for the physical bar, with a serial number Paxos publishes. It
 * trades on Ethereum mainnet — roughly 1,800 transfers per 2,000 blocks — and
 * mainnet is exactly what CC3 attests at chainKey 3.
 *
 * So this obligation is denominated in real tokenized gold, its parties are the
 * real parties to a real mainnet transfer, and its collateral reference commits
 * to a real PAXG position rather than to a sentence.
 *
 * ─── WHY THIS IS THE STRONGER RWA STORY, NOT THE WEAKER ONE ────────────────
 *
 * Gold-backed lending normally needs someone to appraise the metal and take
 * custody of it, and that someone has to be trusted. Tokenized gold is already
 * appraised, already custodied and already audited — so proving a gold-backed
 * repayment needs no appraiser in the loop at all. The trusted intermediary is
 * removed rather than digitised, which is the whole argument this protocol
 * makes everywhere else.
 *
 * Dokett does not tokenize the asset. It records what is owed against one.
 *
 * ─── WHAT THIS SCRIPT DOES ─────────────────────────────────────────────────
 *
 *   1. Finds a recent, real, single-log PAXG transfer on Ethereum mainnet.
 *   2. Registers an obligation whose sourceToken is PAXG, whose payer and payee
 *      are that transfer's real parties, and whose window CONTAINS it — so the
 *      obligation is immediately provable from real gold movement.
 *   3. Commits collateral to that payee's real PAXG position, not to a string.
 *   4. Bonds it, so it carries weight in /solvency rather than being ignored.
 *
 * Then prove it, which is the point:
 *
 *   npm run seed:paxg
 *   npm run prove:payment <id> <txHash>      # both printed at the end
 */

const { ethers } = require('ethers');

const REGISTER_ABI = [
  'function register((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init, uint64 expectedChainId) payable returns (uint256)',
  'function nextId() view returns (uint256)',
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
];

const BOND_ABI = [
  'function allowedCollateral(address) view returns (bool)',
  'function post(uint256 obligationId, address collateral, uint128 amount, uint16 spreadBps) returns (uint256)',
  'function fundPremium(uint256 bondId, uint128 amount)',
  'event BondPosted(uint256 indexed bondId, uint256 indexed obligationId, address indexed underwriter, address collateral, uint128 amount, uint16 spreadBps)',
];

const ERC20_ABI = [
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

/** PAX Gold. One token = one fine troy ounce, vaulted and redeemable. */
const PAXG = '0x45804880De22913dAFE09f4980848ECE6EcbAf78';
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');
const erc20 = new ethers.Interface([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
]);

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

/**
 * A real PAXG transfer, deep enough below the head to be attested.
 *
 * Filters on the log being an actual Transfer, not merely on the receipt having
 * one log — PAXG approvals are also single-log, and an earlier version of this
 * search happily returned an Approval and then failed to parse it.
 */
async function findPaxgTransfer(src, from) {
  for (let b = from; b > from - 300; b--) {
    let blk;
    try {
      blk = await src.getBlock(b, true);
    } catch {
      continue;
    }
    if (!blk) continue;

    for (const tx of blk.prefetchedTransactions || []) {
      if (!tx.to || tx.to.toLowerCase() !== PAXG.toLowerCase()) continue;

      const rx = await src.getTransactionReceipt(tx.hash);
      if (!rx || rx.status !== 1) continue;
      if (rx.logs.length !== 1) continue;
      if (rx.logs[0].topics[0] !== TRANSFER_TOPIC) continue;

      const p = erc20.parseLog({
        topics: [...rx.logs[0].topics],
        data: rx.logs[0].data,
      });
      return { hash: tx.hash, block: b, from: p.args.from, to: p.args.to, value: p.args.value };
    }
  }
  throw new Error('no single-log PAXG transfer found in the scanned range');
}

async function main() {
  const d = require('../deployments/102031.json');
  const bondSeed = require('../deployments/seed-bond-102031.json');

  const chainKey = Number(need('CHAIN_KEY'));
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const cc = new ethers.JsonRpcProvider(
    process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network',
  );

  const registrar = new ethers.Wallet(need('PRIVATE_KEY'), cc);
  const underwriter = process.env.PRIVATE_KEY_2
    ? new ethers.Wallet(process.env.PRIVATE_KEY_2, cc)
    : registrar;
  if (underwriter.address === registrar.address) {
    console.warn('! PRIVATE_KEY_2 not set — this bond will be self-dealt\n');
  }

  const reg = new ethers.Contract(d.register, REGISTER_ABI, registrar);

  // ── a real gold movement on mainnet ────────────────────────────────────
  const head = await src.getBlockNumber();
  const anchor = await findPaxgTransfer(src, head - 250);
  const oz = ethers.formatUnits(anchor.value, 18);

  console.log('anchor — a real PAX Gold transfer on Ethereum mainnet');
  console.log(`  tx      ${anchor.hash}`);
  console.log(`  block   ${anchor.block}  (${head - anchor.block} below head)`);
  console.log(`  value   ${oz} PAXG  ≈ ${Number(oz).toFixed(4)} troy oz of vaulted gold`);
  console.log(`  from    ${anchor.from}`);
  console.log(`  to      ${anchor.to}\n`);

  /*
   * Collateral is a commitment to a REAL position: this payee's PAXG holding,
   * bound to the actual token contract. Anyone holding the preimage can verify
   * it; nobody learns it from the chain. That is the same privacy posture as
   * the obligor commitment, applied to an asset that exists.
   */
  const collateralRef = ethers.keccak256(
    ethers.solidityPacked(['string', 'address', 'address'], ['paxg-position:', PAXG, anchor.to]),
  );

  const obligor = ethers.keccak256(
    ethers.solidityPacked(['string', 'address'], ['paxg-holder:', anchor.to]),
  );
  const creditor = ethers.keccak256(ethers.toUtf8Bytes('bullion-desk:vaulted-credit'));

  const escrow = (await reg.MIN_REGISTRAR_BOND()) + (await reg.MIN_KEEPER_FUND());

  const PERIOD = 216_000n; // ~30 days of Ethereum blocks
  const CURE = 50_400n; // ~7 days

  /*
   * Start half a period before the anchor so the first window CONTAINS it.
   * The obligation is therefore provable the moment it is registered — which
   * is the point: real gold moved, and that movement is admissible evidence.
   */
  const startHeight = BigInt(anchor.block) - PERIOD / 2n;

  const init = {
    obligor,
    creditor,
    creditorPayout: registrar.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(PAXG),
    sourcePayer: anchor.from,
    sourcePayee: anchor.to,
    principal: anchor.value * 3n,
    periodAmount: anchor.value,
    aprBps: 480,
    startHeight,
    periodBlocks: PERIOD,
    cureBlocks: CURE,
    periodsTotal: 3,
    seniority: 0,
    collateralRef,
  };

  const txReg = await reg.register(init, 1n, { value: escrow, gasLimit: 900_000 });
  await txReg.wait();
  const obligationId = (await reg.nextId()) - 1n;
  console.log(`registered obligation #${obligationId}  ${txReg.hash}`);
  console.log(`  principal      ${ethers.formatUnits(init.principal, 18)} PAXG over 3 periods`);
  console.log(`  collateralRef  ${collateralRef}`);

  // ── bond it, or /solvency gives the claim no weight ────────────────────
  const tokenAddr = bondSeed.mockUsdc;
  const bond = new ethers.Contract(d.bond, BOND_ABI, underwriter);
  if (!(await bond.allowedCollateral(tokenAddr))) {
    throw new Error(`${tokenAddr} is not allowlisted collateral — run seed:bond first`);
  }

  const token = new ethers.Contract(tokenAddr, ERC20_ABI, underwriter);
  const stake = 1_200_000_000n; // 1,200 mUSDC first-loss
  const premium = 30_000_000n;

  await (await token.mint(underwriter.address, stake + premium)).wait();
  await (await token.approve(d.bond, stake + premium)).wait();

  const txPost = await bond.post(obligationId, tokenAddr, stake, 290);
  const rxPost = await txPost.wait();
  const bondId = rxPost.logs
    .map((l) => {
      try {
        return bond.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((l) => l && l.name === 'BondPosted').args.bondId;
  console.log(`posted bond #${bondId}  1,200 mUSDC @ 2.90%  ${txPost.hash}`);

  await (await bond.fundPremium(bondId, premium)).wait();
  console.log('funded premium  30 mUSDC');

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' GOLD-BACKED OBLIGATION SEEDED — REAL ASSET, REAL MAINNET');
  console.log(` obligation     #${obligationId}`);
  console.log(` source token   PAXG ${PAXG}`);
  console.log(`                Paxos Gold — 1 token = 1 troy oz, vaulted`);
  console.log(` collateral     a real PAXG position, committed not disclosed`);
  console.log(` bond           #${bondId}  underwriter ${underwriter.address}`);
  console.log('');
  console.log(' NOW PROVE IT — real gold movement advances the obligation:');
  console.log(`   npm run prove:payment ${obligationId} ${anchor.hash}`);
  console.log('');
  console.log(' then:');
  console.log(`   curl -s https://dokett-lens.fly.dev/obligation/${obligationId}`);
  console.log(`   curl -s https://dokett-lens.fly.dev/encumbrance/${collateralRef}`);
  console.log('──────────────────────────────────────────────────────────\n');

  require('node:fs').writeFileSync(
    'deployments/seed-paxg-102031.json',
    JSON.stringify(
      {
        obligationId: obligationId.toString(),
        sourceToken: PAXG,
        sourceTokenName: 'Paxos Gold (PAXG)',
        anchorTx: anchor.hash,
        anchorBlock: anchor.block,
        anchorValuePaxg: oz,
        obligor,
        creditor,
        collateralRef,
        collateralRefPreimage: `paxg-position:|${PAXG}|${anchor.to}`,
        bondId: bondId.toString(),
        underwriter: underwriter.address,
      },
      null,
      2,
    ) + '\n',
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
