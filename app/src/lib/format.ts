import type { Status } from './types';

/**
 * Formatting helpers.
 *
 * Everything here takes decimal strings and works in BigInt. No amount is ever
 * routed through a JS number: at 6 decimals a uint128 balance exceeds
 * Number.MAX_SAFE_INTEGER long before it exceeds anything a real lender would
 * consider large, and a registry that rounds balances is not a registry.
 */

/** Format a fixed-point integer string with `decimals` places. */
export function units(raw: string, decimals = 6, maxFrac = 2): string {
  let v: bigint;
  try {
    v = BigInt(raw);
  } catch {
    return '—';
  }

  const neg = v < 0n;
  if (neg) v = -v;

  const scale = 10n ** BigInt(decimals);
  const whole = v / scale;
  const frac = v % scale;

  const groups = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (maxFrac === 0 || frac === 0n) return `${neg ? '-' : ''}${groups}`;

  const fracStr = frac.toString().padStart(decimals, '0').slice(0, maxFrac).replace(/0+$/, '');
  return `${neg ? '-' : ''}${groups}${fracStr ? `.${fracStr}` : ''}`;
}

/**
 * Source-token decimals and symbols, read from mainnet and pinned here.
 *
 * ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * Every amount in this app was rendered at 6 decimals, which was correct while
 * every obligation was denominated in USDC. It stopped being correct the moment
 * the register carried real RWA collateral: PAXG and USDY are 18-decimal
 * tokens, so 24 troy ounces of allocated gold rendered as `24,000,000,000,000`
 * — off by eight decimal places, and stated as fact on a page whose entire
 * argument is that its numbers can be checked.
 *
 * That is also why abbreviating alone would have been the wrong fix: `24T` is
 * more readable AND more dangerous than the overflow, because it looks
 * deliberate.
 *
 * Decimals below were read from each contract on Ethereum mainnet, not assumed
 * from the ticker — BUIDL is 6 where PAXG and USDY are 18, and guessing by
 * asset class would have got it wrong.
 */
const TOKENS: Record<string, { decimals: number; symbol: string }> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { decimals: 6, symbol: 'USDC' },
  '0x45804880de22913dafe09f4980848ece6ecbaf78': { decimals: 18, symbol: 'PAXG' },
  '0x7712c34205737192402172409a8f7ccef8aa2aec': { decimals: 6, symbol: 'BUIDL' },
  '0x96f6ef951840721adbf46ac996b59e0235cb985c': { decimals: 18, symbol: 'USDY' },
};

/**
 * Decimals for a source token.
 *
 * Falls back to 18 — the ERC-20 default — rather than to 6. An unknown token
 * shown with too FEW decimals inflates the figure, which is the failure mode
 * that produced the gold bug; too many understates it. Understating an
 * obligation is the safer error on a register a lender might read.
 */
export function tokenDecimals(token?: string): number {
  if (!token) return 18;
  return TOKENS[token.toLowerCase()]?.decimals ?? 18;
}

/** Ticker for a source token, or null if we cannot name it honestly. */
export function tokenSymbol(token?: string): string | null {
  if (!token) return null;
  return TOKENS[token.toLowerCase()]?.symbol ?? null;
}

/**
 * Compact form for fixed-width cells: `5.5B`, `1.2T`.
 *
 * Large obligations overflow their columns and push the table sideways, which
 * on a register is worse than it sounds — a number you cannot read is not a
 * disclosure. This abbreviates only above a million; below that the exact
 * figure fits and is shown in full, because rounding a $4,500 balance to
 * `4.5K` loses information a lender actually needs.
 *
 * Computed entirely in BigInt, per the rule at the top of this file. Callers
 * MUST pair it with `units()` in a `title` attribute — the exact value is never
 * destroyed, only folded, and hovering always recovers it.
 */
export function compact(raw: string, decimals = 6): string {
  let v: bigint;
  try {
    v = BigInt(raw);
  } catch {
    return '—';
  }

  const neg = v < 0n;
  if (neg) v = -v;

  const whole = v / 10n ** BigInt(decimals);

  const TIERS: [bigint, string][] = [
    [10n ** 12n, 'T'],
    [10n ** 9n, 'B'],
    [10n ** 6n, 'M'],
  ];

  for (const [div, suffix] of TIERS) {
    if (whole < div) continue;
    // One decimal place, without touching a float: scale up, divide, split.
    const tenths = (whole * 10n) / div;
    const w = (tenths / 10n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const f = tenths % 10n;
    return `${neg ? '-' : ''}${w}${f > 0n ? `.${f}` : ''}${suffix}`;
  }

  return units(raw, decimals);
}

/** Native CTC / 18-decimal values. */
export function ether(raw: string, maxFrac = 4): string {
  return units(raw, 18, maxFrac);
}

export function truncate(addr: string, lead = 6, tail = 4): string {
  if (!addr) return '—';
  if (addr.length <= lead + tail + 2) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}

export function bps(v: number): string {
  return `${(v / 100).toFixed(2)}%`;
}

/** Blocks → human duration, at Ethereum's ~12s cadence. */
export function blocksToDuration(blocks: bigint): string {
  const secs = Number(blocks) * 12;
  const abs = Math.abs(secs);
  if (abs < 3600) return `${Math.round(secs / 60)}m`;
  if (abs < 86_400) return `${(secs / 3600).toFixed(1)}h`;
  return `${(secs / 86_400).toFixed(1)}d`;
}

/** Thousands-grouped block height — a plain integer, not a fixed-point amount. */
export function height(raw: string | number | bigint): string {
  const s = typeof raw === 'string' ? raw : raw.toString();
  if (!/^-?\d+$/.test(s)) return s;
  const neg = s.startsWith('-');
  const digits = neg ? s.slice(1) : s;
  return (neg ? '-' : '') + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function big(raw: string): bigint {
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

export type Tone = 'good' | 'warn' | 'bad' | 'neutral' | 'done';

export const STATUS_TONE: Record<Status, Tone> = {
  None: 'neutral',
  Active: 'neutral',
  Current: 'good',
  Delinquent: 'warn',
  Default: 'bad',
  Settled: 'done',
  ChargedOff: 'bad',
  Unknown: 'neutral',
};

/** One line explaining what a status actually means for the borrower. */
export const STATUS_MEANING: Record<Status, string> = {
  None: 'Not registered.',
  Active: 'Registered. The first payment window is open.',
  Current: 'The last due window was satisfied by a verified proof.',
  Delinquent: 'A window closed with no admissible proof. Curable until the cure height.',
  Default: 'The cure window passed unproven. Bonds were slashed.',
  Settled: 'The schedule was satisfied in full.',
  ChargedOff: 'Defaulted and written off.',
  Unknown: 'Unrecognised status.',
};

export const isAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s.trim());
export const isBytes32 = (s: string) => /^0x[0-9a-fA-F]{64}$/.test(s.trim());
