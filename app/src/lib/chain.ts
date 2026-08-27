import { defineChain } from 'viem';

/**
 * The write side of the Console.
 *
 * Everything else in this app reads through the Lens, which needs no chain
 * config at all. Underwriting is the first thing a visitor does that the
 * protocol must see them do, so it needs the chain itself — a signer, a
 * network, and addresses.
 *
 * Addresses default to the live CC3 deployment rather than being required as
 * env vars. They are public information on a public testnet, and a clone of
 * this repo that has to hunt for four addresses before the underwrite form
 * renders is a clone that never sees the underwrite form. Overridable when a
 * fork deploys its own.
 */

export const CC3 = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Creditcoin', symbol: 'CTC', decimals: 18 },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_CC3_RPC ?? 'https://rpc.cc3-testnet.creditcoin.network'],
    },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://creditcoin-testnet.blockscout.com' },
  },
  testnet: true,
});

export const ADDRESSES = {
  bond: (import.meta.env.VITE_BOND_ADDRESS ??
    '0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e') as `0x${string}`,
  register: (import.meta.env.VITE_REGISTER_ADDRESS ??
    '0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5') as `0x${string}`,
  /** Testnet collateral. `mint` is public, which is what makes the faucet possible. */
  collateral: (import.meta.env.VITE_MOCK_USDC ??
    '0xEFE4479B9056B6520831A4d5A7987A07e8dF3402') as `0x${string}`,
} as const;

export const FAUCET_URL =
  import.meta.env.VITE_FAUCET_URL ?? 'https://covenant-relay.fly.dev/faucet';

export const EXPLORER_TX = 'https://creditcoin-testnet.blockscout.com/tx/';

/** Only the fragments this app calls — a full ABI here would be dead weight. */
export const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const BOND_ABI = [
  {
    type: 'function',
    name: 'post',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'obligationId', type: 'uint256' },
      { name: 'collateral', type: 'address' },
      { name: 'amount', type: 'uint128' },
      { name: 'spreadBps', type: 'uint16' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'MIN_BOND',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint128' }],
  },
  {
    type: 'function',
    name: 'allowedCollateral',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

/**
 * Turn a contract revert into something a person can act on.
 *
 * Custom errors arrive as a selector and an ABI-encoded payload, which is
 * useless on screen. These are the four a would-be underwriter can actually
 * hit; anything else falls through to the raw message rather than being
 * flattened into "something went wrong", because a message we did not
 * anticipate is exactly the one worth showing verbatim.
 */
export function explainRevert(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (/User rejected|denied transaction|rejected the request/i.test(raw))
    return 'You rejected the transaction in your wallet. Nothing was submitted.';
  if (/CollateralNotAllowed/.test(raw))
    return 'That token is not on the Bond contract’s collateral allowlist.';
  if (/BondTooSmall/.test(raw))
    return 'Below the minimum bond size. Dust bonds waste the per-obligation cap, so the contract refuses them.';
  if (/ObligationNotBondable/.test(raw))
    return 'This obligation is no longer bondable — first-loss capital can only be posted while it is Active or Current.';
  if (/TooManyBonds/.test(raw))
    return 'This obligation already carries the maximum number of bonds (16). The cap keeps slashing within the block gas limit.';
  if (/insufficient funds/i.test(raw))
    return 'Not enough CTC to pay for gas. Use the faucet above, then try again.';
  if (/transfer amount exceeds balance|ERC20InsufficientBalance/i.test(raw))
    return 'Not enough mUSDC to cover that stake. Use the faucet above, then try again.';

  return (raw.split('\n')[0] ?? raw).slice(0, 240);
}
