#!/usr/bin/env node
'use strict';

/**
 * Fix the two blank pages: Encumbrance and Underwriters.
 *
 * ─── WHY THEY WERE BLANK ───────────────────────────────────────────────────
 *
 * Encumbrance was blank because every scenario in `seed.js` registers with
 * `collateralRef: ethers.ZeroHash` — there was never a real collateral
 * reference to query.
 *
 * Underwriters was blank for a sharper reason. `Bond.post()` requires the
 * staked token to be on `allowedCollateral`, and the only address ever
 * allowlisted on the live deployment was Ethereum mainnet's USDC address,
 * reused as a placeholder — which has no code at all on Creditcoin CC3
 * (`cast code <addr>` returns `0x`). Nobody could have posted a bond. Not
 * "hasn't happened yet" — the door was configured to something that isn't a
 * door.
 *
 * ─── WHAT THIS SCRIPT DOES ─────────────────────────────────────────────────
 *
 *   1. Deploys `MockUSDC` — a real, working, mintable ERC20 on CC3 (the same
 *      shape already used in the Bond test suite, promoted out of tests).
 *   2. Allowlists it on the live Bond contract. `setCollateral` is
 *      timelock-gated, but the "timelock" is just the deployer's own EOA
 *      address, so this is instant — no 48h wait.
 *   3. Registers ONE new obligation bound to real Ethereum mainnet history
 *      (same technique as seed.js), this time with a real, non-zero
 *      `collateralRef` — so Encumbrance has something to find.
 *   4. Mints mUSDC, posts a real bond against that obligation, and funds a
 *      premium — so Underwriters has a real position to show.
 *
 *   npm run seed:bond
 */

const { ethers } = require('ethers');
const mockUsdcArtifact = require('../out/MockUSDC.sol/MockUSDC.json');

const REGISTER_ABI = [
  'function register((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init, uint64 expectedChainId) payable returns (uint256)',
  'function nextId() view returns (uint256)',
  'function statusOf(uint256) view returns (uint8)',
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
];

const BOND_ABI = [
  'function setCollateral(address token, bool allowed)',
  'function allowedCollateral(address) view returns (bool)',
  'function post(uint256 obligationId, address collateral, uint128 amount, uint16 spreadBps) returns (uint256)',
  'function fundPremium(uint256 bondId, uint128 amount)',
  'event BondPosted(uint256 indexed bondId, uint256 indexed obligationId, address indexed underwriter, address collateral, uint128 amount, uint16 spreadBps)',
];

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const erc20 = new ethers.Interface(['event Transfer(address indexed from,address indexed to,uint256 value)']);

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

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
      return { hash: tx.hash, block: b, from: parsed.args.from, to: parsed.args.to, value: parsed.args.value };
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
  const bond = new ethers.Contract(d.bond, BOND_ABI, w);

  // ── 1. deploy a real, working collateral token on CC3 ──────────────────
  const factory = new ethers.ContractFactory(mockUsdcArtifact.abi, mockUsdcArtifact.bytecode.object, w);
  const token = await factory.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  console.log(`MockUSDC deployed  ${tokenAddr}`);

  // ── 2. allowlist it — "timelock" is just the deployer's own address ────
  const already = await bond.allowedCollateral(tokenAddr);
  if (!already) {
    const txAllow = await bond.setCollateral(tokenAddr, true);
    await txAllow.wait();
    console.log(`allowlisted on Bond  ${txAllow.hash}`);
  }

  // ── 3. register one new obligation with a REAL collateral reference ────
  const bond0 = await reg.MIN_REGISTRAR_BOND();
  const fund0 = await reg.MIN_KEEPER_FUND();
  const escrow = bond0 + fund0;

  const head = await src.getBlockNumber();
  const payment = await findTransfer(src, head - 200);
  console.log(`anchor transfer  ${payment.hash}  (${ethers.formatUnits(payment.value, 6)} USDC)`);

  const PERIOD = 216_000n; // ~30 days
  const CURE = 50_400n; // ~7 days
  const salt = ethers.hexlify(ethers.randomBytes(16));
  const obligor = ethers.keccak256(ethers.solidityPacked(['string', 'bytes16'], ['해양물류 · Haeyang Logistics', salt]));
  const creditor = ethers.keccak256(ethers.toUtf8Bytes('부산캐피탈 · Busan Capital'));

  // A real, specific collateral reference — a bonded warehouse receipt, not a
  // zero hash. Covenant never learns the underlying asset, only this
  // commitment to it, same privacy posture as the obligor commitment.
  const collateralRef = ethers.keccak256(ethers.toUtf8Bytes('warehouse-receipt:BUSAN-WR-88214'));

  const payableStart = BigInt(payment.block) - PERIOD / 2n;

  const init = {
    obligor,
    creditor,
    creditorPayout: w.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(USDC),
    sourcePayer: payment.from,
    sourcePayee: payment.to,
    principal: payment.value * 3n,
    periodAmount: payment.value,
    aprBps: 420,
    startHeight: payableStart,
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
  console.log(`  collateralRef  ${collateralRef}  (warehouse-receipt:BUSAN-WR-88214)`);

  // ── 4. mint, approve, post a real bond, fund a premium ──────────────────
  const bondAmount = 1_500_000_000n; // 1,500 mUSDC at 6dp — first-loss stake
  const premiumAmount = 25_000_000n; // 25 mUSDC

  const txMint = await token.mint(w.address, bondAmount + premiumAmount);
  await txMint.wait();
  console.log(`minted ${ethers.formatUnits(bondAmount + premiumAmount, 6)} mUSDC  ${txMint.hash}`);

  const txApprove = await token.approve(d.bond, bondAmount + premiumAmount);
  await txApprove.wait();

  const txPost = await bond.post(obligationId, tokenAddr, bondAmount, 275);
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
  console.log(`posted bond #${bondId}  ${ethers.formatUnits(bondAmount, 6)} mUSDC @ 2.75%  ${txPost.hash}`);

  const txPremium = await bond.fundPremium(bondId, premiumAmount);
  await txPremium.wait();
  console.log(`funded premium  ${ethers.formatUnits(premiumAmount, 6)} mUSDC  ${txPremium.hash}`);

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' ENCUMBRANCE + UNDERWRITERS SEEDED ON LIVE CC3 TESTNET');
  console.log(` collateral token   ${tokenAddr}`);
  console.log(` obligation         #${obligationId}`);
  console.log(` collateralRef      ${collateralRef}`);
  console.log(` bond               #${bondId}  underwriter ${w.address}`);
  console.log('');
  console.log(' next: npm run lens   # then open Encumbrance and Underwriters');
  console.log('──────────────────────────────────────────────────────────\n');

  require('node:fs').writeFileSync(
    'deployments/seed-bond-102031.json',
    JSON.stringify(
      {
        mockUsdc: tokenAddr,
        obligationId: obligationId.toString(),
        collateralRef,
        collateralRefPreimage: 'warehouse-receipt:BUSAN-WR-88214',
        bondId: bondId.toString(),
        underwriter: w.address,
        anchorTx: payment.hash,
      },
      null,
      2,
    ) + '\n',
  );
  console.log('wrote deployments/seed-bond-102031.json');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
