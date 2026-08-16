import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Encumbrance,
  Health,
  Obligation,
  ObligationDetail,
  Solvency,
  Underwriter,
  Profile,
} from './types';

const BASE = import.meta.env.VITE_LENS_URL ?? '/api';

export class LensError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'LensError';
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    // Distinguish "the Lens is not running" from "the Lens said no". A judge
    // hitting a dead indexer should be told that, not shown an empty registry.
    throw new LensError(
      `Cannot reach the Lens at ${BASE}. Is it running? \`npm run lens\``,
      0,
    );
  }

  if (res.status === 404) throw new LensError('Not found', 404);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new LensError(body.error ?? `Lens returned ${res.status}`, res.status);
  }
  return res.json() as Promise<T>;
}

export const lens = {
  health: (s?: AbortSignal) => get<Health>('/health', s),
  obligations: (s?: AbortSignal) =>
    get<{ asOfBlock: number; obligations: Obligation[] }>('/obligations', s),
  obligation: (id: string, s?: AbortSignal) => get<ObligationDetail>(`/obligation/${id}`, s),
  solvency: (entity: string, s?: AbortSignal) => get<Solvency>(`/solvency/${entity}`, s),
  encumbrance: (asset: string, s?: AbortSignal) => get<Encumbrance>(`/encumbrance/${asset}`, s),
  underwriter: (addr: string, s?: AbortSignal) => get<Underwriter>(`/underwriter/${addr}`, s),
  profile: (subject: string, s?: AbortSignal) => get<Profile>(`/profile/${subject}`, s),
};

export type Async<T> =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'ok'; data: T }
  | { state: 'error'; error: LensError };

/**
 * Fetch hook with abort-on-change.
 *
 * `enabled` exists so query screens can hold at `idle` until the user actually
 * submits something — an empty search box should not read as "no results",
 * because in a registry those two states mean very different things.
 */
export function useLens<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
  enabled = true,
): Async<T> & { reload: () => void } {
  const [result, setResult] = useState<Async<T>>({ state: enabled ? 'loading' : 'idle' });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) {
      setResult({ state: 'idle' });
      return;
    }
    const ac = new AbortController();
    setResult({ state: 'loading' });

    fnRef
      .current(ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) setResult({ state: 'ok', data });
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted || (err as Error).name === 'AbortError') return;
        setResult({
          state: 'error',
          error: err instanceof LensError ? err : new LensError(String(err), -1),
        });
      });

    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...result, reload };
}
