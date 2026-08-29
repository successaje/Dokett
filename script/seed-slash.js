#!/usr/bin/env node
'use strict';

/**
 * Prove that first-loss capital is actually slashed by proof.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Dokett's whole market thesis is that underwriting a named borrower is a
 * priced, adversarially-tested opinion — because when that borrower defaults,
 * the underwriter's capital is slashed automatically, by evidence, with no
 * committee and no vote.
 *
 * That mechanism had never fired on-chain. Both defaulted obligations in the
 * register (#3, #5) carried no bonds, so both honestly reported `slashed: 0`,
 * and the two live bonds sat on obligations that will not default for weeks.
 * `Bond.slash` existed in the unit suite and nowhere else.
 *
 * A protocol whose central economic claim is untested in production has not
 * really demonstrated its central economic claim.
 *
 * ─── THE SEQUENCING PROBLEM ────────────────────────────────────────────────
 *
 * `Bond.post` refuses anything that is not Active or Current, and the live
 * keeper marks a closed-window obligation Delinquent within ~60s. So a bond
 * cannot be posted against an already-delinquent obligation, and registering
 * with an already-closed window means racing the keeper's sweep.
 *
 * Rather than race it, this registers with the window closing ~30 blocks in the
 * FUTURE. That buys several minutes to mint, approve and post the bond while
 * the obligation is legitimately still Active, and then everything downstream
 * happens on its own:
 *
 *   window closes           at  attested + 30
 *   keeper marks Delinquent at  attested + 30 + minConfirmations(64)
 *   cure expires            at  attested + 30 + cureBlocks(60)
 *   keeper finalises Default and SLASHES on the following sweep
 *
 * Roughly 20 minutes of real Ethereum block production, entirely unattended.
 *
 * ─── THE BOND IS DELIBERATELY SMALLER THAN THE PRINCIPAL ───────────────────
 *
 * `slash` takes min(outstanding, posted). A bond larger than the debt would
 * make the slash look like it makes the creditor whole, which is not what
 * first-loss capital is. Sized at 25% of principal, the slash pays the creditor
 * the full bond and leaves them genuinely short — which is the honest picture.
 *
 *   npm run seed:slash
 */

const { ethers } = require('ethers');

const REGISTER_ABI = [
  'function register((bytes32 obligor,bytes32 creditor,address creditorPayout,uint64 chainKey,address sourceToken,address sourcePayer,address sourcePayee,uint128 principal,uint128 periodAmount,uint16 aprBps,uint64 startHeight,uint64 periodBlocks,uint64 cureBlocks,uint8 periodsTotal,uint8 seniority,bytes32 collateralRef) init, uint64 expectedChainId) payable returns (uint256)',
  'function nextId() view returns (uint256)',
  'function statusOf(uint256) view returns (uint8)',
  'function MIN_REGISTRAR_BOND() view returns (uint128)',
  'function MIN_KEEPER_FUND() view returns (uint128)',
];
const BOND_ABI = [
  'function post(uint256 obligationId, address collateral, uint128 amount, uint16 spreadBps) returns (uint256)',
  'function allowedCollateral(address) view returns (bool)',
  'event BondPosted(uint256 indexed bondId, uint256 indexed obligationId, address indexed underwriter, address collateral, uint128 amount, uint16 spreadBps)',
];
const TOKEN_ABI = [
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];
const VERIFIER_ABI = [
  'function penaltiesEnabled(uint64) view returns (bool)',
  'function attestedHead(uint64) view returns (uint64)',
  'function minConfirmations() view returns (uint64)',
];

const USDC = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

const need = (n) => {
  const v = process.env[n];
  if (!v) throw new Error(`missing required env: ${n}`);
  return v;
};

async function main() {
  const d = require('../deployments/102031.json');
  const seedBond = require('../deployments/seed-bond-102031.json');
  const chainKey = Number(need('CHAIN_KEY'));
  const cc = new ethers.JsonRpcProvider(
    process.env.CC3_RPC || 'https://rpc.cc3-testnet.creditcoin.network',
  );
  const w = new ethers.Wallet(need('PRIVATE_KEY'), cc);

  const reg = new ethers.Contract(d.register, REGISTER_ABI, w);
  const bond = new ethers.Contract(d.bond, BOND_ABI, w);
  const verifier = new ethers.Contract(d.ascVerifier, VERIFIER_ABI, cc);
  const token = new ethers.Contract(seedBond.mockUsdc, TOKEN_ABI, w);

  if (!(await verifier.penaltiesEnabled(chainKey))) {
    throw new Error('penaltiesEnabled is false — wait for the keeper to build its observation record.');
  }
  if (!(await bond.allowedCollateral(seedBond.mockUsdc))) {
    throw new Error(`collateral ${seedBond.mockUsdc} is not allowlisted on Bond`);
  }

  const attested = await verifier.attestedHead(chainKey);
  const conf = await verifier.minConfirmations();

  const windowEnd = attested + 30n; // closes in ~6 min — room to post the bond
  const cureBlocks = 60n;
  const periodBlocks = 1000n;
  const principal = 1_000_000_000n; // 1,000 mUSDC at 6dp
  const bondAmount = 250_000_000n; // 250 mUSDC — first loss, deliberately partial

  console.log(`attested head ${attested} · minConfirmations ${conf}`);
  console.log(`window closes  ${windowEnd}  (~6 min)`);
  console.log(`delinquent at  ${windowEnd + conf}`);
  console.log(`cure expires   ${windowEnd + cureBlocks}`);

  const init = {
    obligor: ethers.keccak256(
      ethers.solidityPacked(
        ['string', 'bytes16'],
        ['금정물산 · Geumjeong Materials', ethers.hexlify(ethers.randomBytes(16))],
      ),
    ),
    creditor: ethers.keccak256(ethers.toUtf8Bytes('한강금융 · Hangang Finance')),
    creditorPayout: w.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(USDC),
    // A payer that has never paid this payee. The point is the absence.
    sourcePayer: ethers.getAddress('0x' + '33'.repeat(20)),
    sourcePayee: ethers.getAddress('0x' + '44'.repeat(20)),
    principal,
    periodAmount: principal,
    aprBps: 450,
    startHeight: windowEnd - periodBlocks,
    periodBlocks,
    cureBlocks,
    periodsTotal: 1,
    seniority: 0,
    collateralRef: ethers.ZeroHash,
  };

  const rb = await reg.MIN_REGISTRAR_BOND();
  const kf = await reg.MIN_KEEPER_FUND();

  const txReg = await reg.register(init, 1n, { value: rb + kf, gasLimit: 900_000 });
  await txReg.wait();
  const id = (await reg.nextId()) - 1n;
  console.log(`\nregistered #${id} — ${txReg.hash}`);

  // Post the bond NOW, while the window is still open and the status is Active.
  const bal = await token.balanceOf(w.address);
  if (bal < bondAmount) {
    const txMint = await token.mint(w.address, bondAmount - bal);
    await txMint.wait();
    console.log(`minted ${ethers.formatUnits(bondAmount - bal, 6)} mUSDC — ${txMint.hash}`);
  }

  const txApprove = await token.approve(d.bond, bondAmount);
  await txApprove.wait();

  const txPost = await bond.post(id, seedBond.mockUsdc, bondAmount, 450);
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

  const status = await reg.statusOf(id);
  console.log(
    `posted bond #${posted.args.bondId} — ${ethers.formatUnits(bondAmount, 6)} mUSDC — ${txPost.hash}`,
  );
  console.log(`obligation status at post time: ${['None', 'Active', 'Current', 'Delinquent', 'Default', 'Settled', 'ChargedOff'][Number(status)]}`);

  require('node:fs').writeFileSync(
    'deployments/seed-slash-102031.json',
    JSON.stringify(
      {
        obligationId: id.toString(),
        bondId: posted.args.bondId.toString(),
        collateral: seedBond.mockUsdc,
        bondAmount: bondAmount.toString(),
        principal: principal.toString(),
        windowEnd: windowEnd.toString(),
        cureEnd: (windowEnd + cureBlocks).toString(),
        registerTx: txReg.hash,
        postTx: txPost.hash,
      },
      null,
      2,
    ) + '\n',
  );

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(' WAITING FOR THE FIRST REAL SLASH');
  console.log(` obligation  #${id}   bond #${posted.args.bondId}`);
  console.log(` posted      ${ethers.formatUnits(bondAmount, 6)} mUSDC against ${ethers.formatUnits(principal, 6)} principal`);
  console.log('');
  console.log(' Nothing further to do. The keeper marks it Delinquent, then finalises');
  console.log(' the default once the attested head passes the cure height — and slashes');
  console.log(' the bond to the creditor in the same transaction.');
  console.log('');
  console.log(` watch: curl -s https://covenant-lens.fly.dev/obligation/${id}`);
  console.log('──────────────────────────────────────────────────────────\n');
  console.log('wrote deployments/seed-slash-102031.json');
}

main().catch((err) => {
  console.error(`\n✗ ${err.message}\n`);
  process.exit(1);
});
