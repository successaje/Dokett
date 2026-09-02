#!/usr/bin/env node
'use strict';

/**
 * Give DemoBank a reason to decline that only Dokett can supply.
 *
 * ─── THE GAP ───────────────────────────────────────────────────────────────
 *
 * DemoBank queries the register, gets $6,520 outstanding across three bonded
 * obligations with one default and one delinquency, and declines. Correct, but
 * unremarkable: a credit bureau would reach the same answer, and the decline
 * reasons are all "this borrower owes too much and hasn't paid."
 *
 * Meanwhile the encumbrance endpoint — the one question the script calls "no
 * answer anywhere else in crypto" — never fires, because every obligation this
 * obligor carries was registered with `collateralRef: ZeroHash`.
 *
 * So the most distinctive thing Dokett does is absent from the scene meant to
 * show what Dokett is for.
 *
 * ─── WHAT THIS ADDS ────────────────────────────────────────────────────────
 *
 * One more obligation for the SAME obligor (대현상사, reproduced from the
 * recorded salt rather than pasted as a hash), pledging the SAME warehouse
 * receipt that obligations 6 and 7 already claim against.
 *
 * That produces a decline reason no score can produce: the applicant is
 * offering collateral that is already pledged twice elsewhere, and the lender
 * can see it without asking the borrower, the other lenders, or anyone else.
 *
 * It is registered Active with a window ~30 days out, so the keeper will not
 * degrade it mid-recording. It is bonded, because an unbonded claim carries no
 * weight in `/solvency` and would not appear in DemoBank's figures at all.
 *
 * The underwriter is PRIVATE_KEY_2 where available — an independent bond
 * rather than another self-dealt one.
 *
 *   npm run seed:encumbered
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

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const erc20 = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

/** Same technique as seed.js — bind the obligation to real mainnet parties. */
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
      const p = erc20.parseLog({ topics: [...rx.logs[0].topics], data: rx.logs[0].data });
      return { hash: tx.hash, block: b, from: p.args.from, to: p.args.to };
    }
  }
  throw new Error('no suitable USDC transfer found');
}

async function main() {
  const d = require('../deployments/102031.json');
  const prior = require('../deployments/seed-102031.json');
  const bondSeed = require('../deployments/seed-bond-102031.json');

  const chainKey = Number(need('CHAIN_KEY'));
  const src = new ethers.JsonRpcProvider(need('ETH_MAINNET_RPC'));
  const cc = new ethers.JsonRpcProvider(process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network');

  const registrar = new ethers.Wallet(need('PRIVATE_KEY'), cc);
  const underwriter = process.env.PRIVATE_KEY_2
    ? new ethers.Wallet(process.env.PRIVATE_KEY_2, cc)
    : registrar;
  if (underwriter === registrar) {
    console.warn('! PRIVATE_KEY_2 not set — this bond will be self-dealt');
  }

  const reg = new ethers.Contract(d.register, REGISTER_ABI, registrar);

  // ── the same borrower, reproduced rather than pasted ────────────────────
  const obligor = ethers.keccak256(
    ethers.solidityPacked(['string', 'bytes16'], ['대현상사', prior.salt]),
  );
  if (obligor !== prior.obligor) {
    throw new Error(`obligor mismatch: derived ${obligor}, recorded ${prior.obligor}`);
  }

  // ── the same asset obligations 6 and 7 already claim against ────────────
  const collateralRef = ethers.keccak256(
    ethers.toUtf8Bytes(bondSeed.collateralRefPreimage),
  );
  if (collateralRef !== bondSeed.collateralRef) {
    throw new Error('collateralRef mismatch — preimage no longer reproduces the ref');
  }

  // A third creditor. The point of the scene is that no single venue could
  // have known about the other two.
  const creditor = ethers.keccak256(ethers.toUtf8Bytes('제3금융 · Third Finance'));

  const escrow = (await reg.MIN_REGISTRAR_BOND()) + (await reg.MIN_KEEPER_FUND());
  const head = await src.getBlockNumber();
  const anchor = await findTransfer(src, head - 200);

  const PERIOD = 216_000n; // ~30 days of Ethereum blocks
  const CURE = 50_400n; // ~7 days

  /* Start at the current head so the first window closes ~30 days out. The
     keeper must not degrade this one mid-recording — the scene needs it Active
     and outstanding, not distressed. */
  const init = {
    obligor,
    creditor,
    creditorPayout: registrar.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(USDC),
    sourcePayer: anchor.from,
    sourcePayee: anchor.to,
    principal: 8_000_000_000n, // 8,000 USDC at 6dp
    periodAmount: 2_000_000_000n, // 2,000 per period
    aprBps: 610,
    startHeight: BigInt(head),
    periodBlocks: PERIOD,
    cureBlocks: CURE,
    periodsTotal: 4,
    seniority: 1,
    collateralRef,
  };

  console.log(`obligor       ${obligor}  (대현상사)`);
  console.log(`collateralRef ${collateralRef}  (${bondSeed.collateralRefPreimage})`);
  console.log(`anchor        ${anchor.hash} @ ${anchor.block}`);
  console.log(`window closes ~block ${(BigInt(head) + PERIOD).toLocaleString()} (~30 days)\n`);

  const txReg = await reg.register(init, 1n, { value: escrow, gasLimit: 900_000 });
  await txReg.wait();
  const obligationId = (await reg.nextId()) - 1n;
  console.log(`registered obligation #${obligationId}  ${txReg.hash}`);

  // ── bond it, or /solvency gives it no weight ────────────────────────────
  const tokenAddr = bondSeed.mockUsdc;
  const bond = new ethers.Contract(d.bond, BOND_ABI, underwriter);
  if (!(await bond.allowedCollateral(tokenAddr))) {
    throw new Error(`${tokenAddr} is not allowlisted collateral — run seed:bond first`);
  }

  const token = new ethers.Contract(tokenAddr, ERC20_ABI, underwriter);
  const stake = 900_000_000n; // 900 mUSDC first-loss
  const premium = 20_000_000n;

  await (await token.mint(underwriter.address, stake + premium)).wait();
  await (await token.approve(d.bond, stake + premium)).wait();

  const txPost = await bond.post(obligationId, tokenAddr, stake, 310);
  const rxPost = await txPost.wait();
  const posted = rxPost.logs
    .map((l) => {
      try {
        return bond.interface.parseLog(l);
      } catch {
        return null;
      }
    })
    .find((l) => l && l.name === 'BondPosted');
  const bondId = posted.args.bondId;
  console.log(`posted bond #${bondId}  900 mUSDC @ 3.10%  ${txPost.hash}`);

  await (await bond.fundPremium(bondId, premium)).wait();
  console.log('funded premium  20 mUSDC');

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' ENCUMBERED CLAIM SEEDED ON LIVE CC3 TESTNET');
  console.log(` obligation      #${obligationId}   8,000 USDC, Active`);
  console.log(` obligor         ${obligor.slice(0, 22)}…  (same borrower)`);
  console.log(` collateralRef   ${collateralRef.slice(0, 22)}…  (3rd claim on it)`);
  console.log(` bond            #${bondId}  underwriter ${underwriter.address}`);
  console.log('');
  console.log(' verify:');
  console.log(`   curl -s https://dokett-lens.fly.dev/encumbrance/${collateralRef}`);
  console.log(`   curl -s https://dokett-lens.fly.dev/solvency/${obligor}`);
  console.log('──────────────────────────────────────────────────────────\n');

  require('node:fs').writeFileSync(
    'deployments/seed-encumbered-102031.json',
    JSON.stringify(
      {
        obligationId: obligationId.toString(),
        obligor,
        obligorPreimage: '대현상사',
        collateralRef,
        collateralRefPreimage: bondSeed.collateralRefPreimage,
        bondId: bondId.toString(),
        underwriter: underwriter.address,
        anchorTx: anchor.hash,
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
