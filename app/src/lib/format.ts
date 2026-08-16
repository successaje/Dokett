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
