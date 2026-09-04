import { useEffect, useRef, useState } from 'react';
import { truncate } from '../lib/format';
import { useSession } from '../lib/auth';

const EXPLORER = 'https://creditcoin-testnet.blockscout.com/address/';

/**
 * The signed-in control.
 *
 * ─── TWO THINGS THIS FIXES ─────────────────────────────────────────────────
 *
 * 1. The control used to sign you out on a single click, with no confirmation
 *    and no way back. Every protocol-grade wallet control — Uniswap, Safe,
 *    Aave — treats the connected state as a menu, because disconnecting is a
 *    destructive action that should never be one misclick away from the thing
 *    people actually click for (their address).
 *
 * 2. More importantly: nothing in this app consumed `session.addresses`.
 *    `lib/auth.tsx` argues that sign-in exists to answer one question — "which
 *    obligations are mine" — and that question was never actually answered
 *    anywhere in the UI. Signing in changed a button label and nothing else.
 *
 *    "Your file" is the answer. It routes to the same public profile a stranger
 *    would see, because that is the honest thing: signing in does not unlock a
 *    private view, it just saves you from pasting your own address.
 *
 * Signing in still proves control of an email, phone or wallet, and NOTHING
 * here labels that "verified" or treats it as a claim about who is the subject
 * of an obligation.
 */
export default function SessionMenu() {
  const s = useSession();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const address = s.addresses[0] ?? null;

  // Dismiss on outside click and on Escape. Both, because a menu that traps you
  // is worse than no menu.
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  if (!s.configured || !s.ready) return null;

  if (!s.signedIn) {
    return (
      <button
        className="btn"
        onClick={s.signIn}
        title="Find the obligations that concern you. Not required to read the register or to cure."
      >
        Sign in
      </button>
    );
  }

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
    } catch {
      // Clipboard can be blocked outright (permissions, insecure context).
      // Selecting the text is still possible, so fail quietly rather than
      // claiming a copy that did not happen.
      setCopied(false);
    }
  }

  return (
    <div className="sess" ref={wrapRef}>
      <button
        className="btn sess-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="sess-label">{s.label ?? (address ? truncate(address, 6, 4) : 'Account')}</span>
        <span className="sess-caret" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="sess-menu" role="menu">
          <div className="sess-head">
            <div className="sess-head-k">Signed in as</div>
            <div className="sess-head-v">{s.label ?? 'wallet'}</div>
            {address && <div className="sess-addr mono">{address}</div>}
          </div>

          {address && (
            <a
              className="sess-item"
              role="menuitem"
              href={`#/profile/${address}`}
              onClick={() => setOpen(false)}
            >
              <span>Your file</span>
              <span className="sess-item-sub">what this register proves about you</span>
            </a>
          )}

          {address && (
            <button className="sess-item" role="menuitem" onClick={copy}>
              <span>{copied ? 'Copied' : 'Copy address'}</span>
              <span className="sess-item-sub mono">{truncate(address, 10, 6)}</span>
            </button>
          )}

          {address && (
            <a
              className="sess-item"
              role="menuitem"
              href={`${EXPLORER}${address}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              <span>View on Blockscout ↗</span>
              <span className="sess-item-sub">the chain's own record of this address</span>
            </a>
          )}

          <div className="sess-note">
            Signing in proves control of an email, phone or wallet. It does not prove you are the
            subject of any obligation, and it is never required to read the register or to cure one.
          </div>

          <button
            className="sess-item sess-item-danger"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              s.signOut();
            }}
          >
            <span>Disconnect</span>
          </button>
        </div>
      )}
    </div>
  );
}
