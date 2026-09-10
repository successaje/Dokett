#!/usr/bin/env node
'use strict';

/**
 * Register an obligation against a REAL tokenized real-world asset.
 *
 *   npm run seed:rwa PAXG      gold, vaulted
 *   npm run seed:rwa BUIDL     BlackRock tokenized treasury fund
 *   npm run seed:rwa USDY      Ondo — short-term treasuries + bank deposits
 *   npm run seed:rwa XAUT      gold, Tether
 *   npm run seed:rwa PYUSD     PayPal USD, regulated reserves
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Every collateral reference in this register used to commit to a string we
 * invented — `keccak256("warehouse-receipt:BUSAN-WR-88214")` commits to a
 * warehouse receipt that does not exist. The mechanism was real and the asset
 * was not, which is a fair thing for a reviewer to notice.
 *
 * The tokens below are not ours and were not invented for a demo. They are
 * real instruments trading on Ethereum mainnet — and mainnet is exactly what
 * CC3 attests at chainKey 3, so `PaymentAdapter` proves their transfers with
 * no protocol change whatsoever.
 *
 * ─── THE POINT IS THE PLURAL ───────────────────────────────────────────────
 *
 * One gold obligation demonstrates gold. Several obligations across metals, a
 * BlackRock money-market fund and a treasury-yield token demonstrate something
 * else: that the registry does not care what the asset is. It never learns.
 * It records what is owed against a commitment, and the commitment could be
 * anything — which is what makes it a registry rather than a product for one
 * asset class.
 *
 * Dokett does not tokenize the asset. It records what is owed against one.
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

/**
 * Real tokenized RWAs on Ethereum mainnet, with observed transfer activity.
 * Decimals are read from the chain, never hardcoded — PAXG is 18 and BUIDL is
 * 6, and guessing that wrong misprices an obligation by twelve orders of
 * magnitude.
 */
const ASSETS = {
  PAXG: {
    address: '0x45804880De22913dAFE09f4980848ECE6EcbAf78',
    class: 'precious metals',
    what: 'one fine troy ounce of London Good Delivery gold, vaulted with Brink\'s, redeemable for the bar',
    unit: 'troy oz',
  },
  XAUT: {
    address: '0x68749665FF8D2d112Fa859AA293F07A622782F38',
    class: 'precious metals',
    what: 'Tether Gold — one troy ounce of gold on a specific London Good Delivery bar',
    unit: 'troy oz',
  },
  BUIDL: {
    address: '0x7712c34205737192402172409a8F7ccef8aA2AEc',
    class: 'institutional money market',
    what: 'BlackRock USD Institutional Digital Liquidity Fund — cash, US Treasury bills and repo',
    unit: 'shares',
  },
  USDY: {
    address: '0x96F6eF951840721AdBF46Ac996b59E0235CB985C',
    class: 'treasury yield',
    what: 'Ondo U.S. Dollar Yield — short-term US Treasuries and bank demand deposits',
    unit: 'tokens',
  },
  PYUSD: {
    address: '0x6c3ea9036406852006290770BEdFcAbA0e23A0e8',
    class: 'regulated stablecoin',
    what: 'PayPal USD — fully reserved in US dollar deposits, Treasuries and cash equivalents',
    unit: 'tokens',
  },
};

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
 * A real transfer of `token`, far enough below the head to be attested.
 *
 * Multi-log receipts are fine — `AscVerify` addresses a specific log by index
 * and `prove-payment` scans the receipt for the matching one. USDY transfers
 * arrive inside 24-log receipts and prove perfectly well.
 *
 * Filters on topic0 being Transfer rather than on the receipt having one log:
 * an earlier version checked only the log COUNT, cheerfully returned a PAXG
 * Approval, and then failed to parse it as a Transfer.
 */
async function findTransfer(src, token, fromBlock, windowBlocks = 6000) {
  /*
   * Adaptive range, same shape as the fix in lens/src/indexer.js.
   *
   * A fixed 6,000-block getLogs is fine against a paid RPC and times out
   * against a free one — the provider refuses rather than answering slowly, so
   * the range has to come down until it accepts. Halving on failure lets this
   * work on whatever endpoint is configured instead of betting on one.
   */
  let logs = null;
  let span = windowBlocks;
  while (span >= 250) {
    try {
      logs = await src.getLogs({
        address: token,
        topics: [TRANSFER_TOPIC],
        fromBlock: fromBlock - span,
        toBlock: fromBlock,
      });
      if (logs.length) break;
      // Answered, but empty — widen backwards rather than narrowing further.
      fromBlock -= span;
      logs = null;
    } catch {
      span = Math.floor(span / 2);
    }
  }
  if (!logs || !logs.length) throw new Error(`no ${token} transfers found in range`);

  for (const l of logs.reverse()) {
    const rx = await src.getTransactionReceipt(l.transactionHash);
    if (!rx || rx.status !== 1) continue;

    const p = erc20.parseLog({ topics: [...l.topics], data: l.data });
    if (p.args.value === 0n) continue; // a zero-value transfer proves nothing useful

    return {
      hash: l.transactionHash,
      block: l.blockNumber,
      from: p.args.from,
      to: p.args.to,
      value: p.args.value,
      logCount: rx.logs.length,
    };
  }
  throw new Error(`no usable ${token} transfer found`);
}

async function main() {
  const key = (process.argv[2] || 'PAXG').toUpperCase();
  const asset = ASSETS[key];
  if (!asset) {
    throw new Error(`unknown asset "${key}". Known: ${Object.keys(ASSETS).join(', ')}`);
  }

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

  // ── read the asset's own facts from the chain ──────────────────────────
  const meta = new ethers.Contract(
    asset.address,
    ['function decimals() view returns (uint8)', 'function name() view returns (string)'],
    src,
  );
  const decimals = Number(await meta.decimals());
  const name = await meta.name();

  const head = await src.getBlockNumber();
  const anchor = await findTransfer(src, asset.address, head - 260);
  const amount = ethers.formatUnits(anchor.value, decimals);

  console.log(`${key} — ${name}`);
  console.log(`  asset class  ${asset.class}`);
  console.log(`  backing      ${asset.what}`);
  console.log(`  decimals     ${decimals}  (read from chain)\n`);
  console.log('anchor — a real transfer on Ethereum mainnet');
  console.log(`  tx      ${anchor.hash}`);
  console.log(`  block   ${anchor.block}  (${head - anchor.block} below head)`);
  console.log(`  value   ${amount} ${key}  (${asset.unit})`);
  console.log(`  from    ${anchor.from}`);
  console.log(`  to      ${anchor.to}`);
  console.log(`  receipt ${anchor.logCount} log(s)\n`);

  /*
   * Collateral commits to a REAL position — this payee's holding of this
   * specific token contract. Verifiable by anyone with the preimage, disclosed
   * to nobody. Same posture as the obligor commitment, applied to an asset
   * that exists.
   */
  const collateralRef = ethers.keccak256(
    ethers.solidityPacked(
      ['string', 'address', 'address'],
      [`${key.toLowerCase()}-position:`, asset.address, anchor.to],
    ),
  );
  const obligor = ethers.keccak256(
    ethers.solidityPacked(['string', 'address'], [`${key.toLowerCase()}-holder:`, anchor.to]),
  );
  const creditor = ethers.keccak256(ethers.toUtf8Bytes(`rwa-desk:${asset.class}`));

  const reg = new ethers.Contract(d.register, REGISTER_ABI, registrar);
  const escrow = (await reg.MIN_REGISTRAR_BOND()) + (await reg.MIN_KEEPER_FUND());

  const PERIOD = 216_000n; // ~30 days of Ethereum blocks
  const CURE = 50_400n; // ~7 days

  // Start half a period before the anchor so the first window CONTAINS it —
  // the obligation is provable the moment it is registered.
  const init = {
    obligor,
    creditor,
    creditorPayout: registrar.address,
    chainKey: BigInt(chainKey),
    sourceToken: ethers.getAddress(asset.address),
    sourcePayer: anchor.from,
    sourcePayee: anchor.to,
    principal: anchor.value * 3n,
    periodAmount: anchor.value,
    aprBps: 480,
    startHeight: BigInt(anchor.block) - PERIOD / 2n,
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
  console.log(`  principal      ${ethers.formatUnits(init.principal, decimals)} ${key} over 3 periods`);
  console.log(`  collateralRef  ${collateralRef}`);

  // ── bond it, or /solvency gives the claim no weight ────────────────────
  const tokenAddr = bondSeed.mockUsdc;
  const bond = new ethers.Contract(d.bond, BOND_ABI, underwriter);
  if (!(await bond.allowedCollateral(tokenAddr))) {
    throw new Error(`${tokenAddr} is not allowlisted collateral — run seed:bond first`);
  }
  const token = new ethers.Contract(tokenAddr, ERC20_ABI, underwriter);
  const stake = 1_100_000_000n;
  const premium = 25_000_000n;

  await (await token.mint(underwriter.address, stake + premium)).wait();
  await (await token.approve(d.bond, stake + premium)).wait();

  const txPost = await bond.post(obligationId, tokenAddr, stake, 300);
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
  console.log(`posted bond #${bondId}  1,100 mUSDC @ 3.00%  ${txPost.hash}`);
  await (await bond.fundPremium(bondId, premium)).wait();
  console.log('funded premium  25 mUSDC');

  console.log('\n──────────────────────────────────────────────────────────');
  console.log(` ${key} OBLIGATION SEEDED — REAL ASSET, REAL MAINNET`);
  console.log(` obligation     #${obligationId}   ${asset.class}`);
  console.log(` source token   ${asset.address}`);
  console.log('');
  console.log(' NOW PROVE IT:');
  console.log(`   npm run prove:payment ${obligationId} ${anchor.hash}`);
  console.log('──────────────────────────────────────────────────────────\n');

  const out = `deployments/seed-rwa-${key.toLowerCase()}-102031.json`;
  require('node:fs').writeFileSync(
    out,
    JSON.stringify(
      {
        asset: key,
        assetName: name,
        assetClass: asset.class,
        sourceToken: asset.address,
        decimals,
        obligationId: obligationId.toString(),
        anchorTx: anchor.hash,
        anchorBlock: anchor.block,
        anchorValue: amount,
        obligor,
        creditor,
        collateralRef,
        collateralRefPreimage: `${key.toLowerCase()}-position:|${asset.address}|${anchor.to}`,
        bondId: bondId.toString(),
        underwriter: underwriter.address,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`recorded ${out}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
