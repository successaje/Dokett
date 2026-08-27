import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { createWalletClient, custom, type WalletClient } from 'viem';
import { CC3 } from './chain';

/**
 * Borrower sign-in.
 *
 * ─── WHAT THIS IS FOR, AND WHAT IT IS NOT ──────────────────────────────────
 *
 * Curing a delinquency is PERMISSIONLESS. `provePayment` admits a proof based on
 * the height it binds to, not on who submitted it — the borrower, the creditor, a
 * keeper or a stranger are identical to the contract. Gating the cure behind a
 * login would add an access restriction the protocol deliberately does not have,
 * and would make the borrower's rescue depend on our auth provider being up.
 *
 * So sign-in is NOT authorisation. It answers a different and genuinely unsolved
 * question: *which obligations are mine*. Adaeze's real problem is not that she
 * cannot submit a proof — anyone can. It is that nobody tells her she is three
 * days from a default.
 *
 * ─── HARD CONSTRAINTS ──────────────────────────────────────────────────────
 *
 * 1. The identity salt never touches Privy. Commitments are computed client-side
 *    and the salt stays in the browser. If a third party held both the key and
 *    the salt, the commitment scheme would be decorative.
 *
 * 2. Signing in proves control of an email, phone or wallet. It does NOT prove
 *    the holder is the subject of any obligation, and nothing in this app may
 *    label it "verified". Linking a payment address to a subject requires a
 *    signature from THAT address, which is a separate act.
 *
 * 3. The Console must work fully without Privy configured. A judge cloning this
 *    repo has no app id, and the register is public — it would be absurd for a
 *    public record to go blank because an auth vendor was not set up. With no
 *    `VITE_PRIVY_APP_ID`, this degrades to a no-op provider and every read-only
 *    view behaves exactly as before.
 */

const APP_ID = import.meta.env.VITE_PRIVY_APP_ID as string | undefined;

interface Session {
  /** Whether sign-in is available at all in this deployment. */
  configured: boolean;
  ready: boolean;
  signedIn: boolean;
  /** Addresses the signed-in user has linked. Used only to find their claims. */
  addresses: string[];
  label: string | null;
  signIn: () => void;
  signOut: () => void;
  /**
   * A signer for CC3, or null when there is nothing to sign with.
   *
   * Exposed through this context rather than by calling `useWallets` at the
   * point of use, because that hook throws outside a PrivyProvider — and this
   * app deliberately runs without one. Routing it through here keeps the
   * "works with no auth vendor" guarantee in exactly one place.
   *
   * Switches the wallet to CC3 before returning. A signer pointed at the wrong
   * network does not fail loudly; it succeeds against a chain where Covenant
   * does not exist.
   */
  getWalletClient: () => Promise<WalletClient | null>;
}

const NoSession: Session = {
  configured: false,
  ready: true,
  signedIn: false,
  addresses: [],
  label: null,
  signIn: () => {},
  signOut: () => {},
  getWalletClient: async () => null,
};

const Ctx = createContext<Session>(NoSession);

export const authConfigured = Boolean(APP_ID);

/** Reads Privy state. Only mounted when an app id exists. */
function LiveSession({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const value = useMemo<Session>(() => {
    const addresses = wallets.map((w) => w.address).filter(Boolean);

    // A human-readable handle for the header. Never rendered as an identity
    // claim about the subject of an obligation — see constraint (2).
    const label =
      user?.email?.address ??
      user?.phone?.number ??
      (addresses[0] ? `${addresses[0].slice(0, 6)}…${addresses[0].slice(-4)}` : null);

    const getWalletClient = async (): Promise<WalletClient | null> => {
      const w = wallets[0];
      if (!w) return null;

      // Order matters: switch first, then take the provider. Asking for the
      // provider before the switch can hand back one still bound to the old
      // chain id.
      await w.switchChain(CC3.id);
      const provider = await w.getEthereumProvider();

      return createWalletClient({
        account: w.address as `0x${string}`,
        chain: CC3,
        transport: custom(provider),
      });
    };

    return {
      configured: true,
      ready,
      signedIn: authenticated,
      addresses,
      label,
      signIn: login,
      signOut: logout,
      getWalletClient,
    };
  }, [ready, authenticated, user, wallets, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Resolves the same effective theme ThemeToggle would show right now, read the
 * same way it reads it: an explicit choice in localStorage, else the system
 * preference. Privy's modal is themed once at mount rather than reactively, so
 * this only has to match what the reader is looking at when they click "Sign
 * in" — not track a later in-session toggle.
 */
function resolvedTheme(): 'light' | 'dark' {
  try {
    const stored = localStorage.getItem('covenant.theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // ignore — fall through to system preference
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (!APP_ID) {
    // No vendor, no degradation of the public record.
    return <Ctx.Provider value={NoSession}>{children}</Ctx.Provider>;
  }

  const theme = resolvedTheme();

  return (
    <PrivyProvider
      appId={APP_ID}
      config={{
        appearance: {
          theme,
          // The site's own ink token for each theme — a near-black accent on
          // Privy's dark modal would be nearly invisible against its own
          // near-black background.
          accentColor: theme === 'dark' ? '#ece9e2' : '#16181c',
          logo: undefined,
          walletList: ['metamask', 'wallet_connect'],
        },
        // Email and SMS first: the borrowers this is built for do not have a
        // browser wallet, and telling someone to install one to avoid a default
        // is not a cure path.
        loginMethods: ['email', 'sms', 'wallet'],
        /*
         * Without these, Privy provisions embedded wallets on Ethereum mainnet
         * and every write in this app would target the wrong network — the
         * underwrite call would simply be sent somewhere Covenant is not
         * deployed. Covenant settles on CC3, so CC3 is the only chain here.
         */
        supportedChains: [CC3],
        defaultChain: CC3,
        // v3 nests creation policy per chain family. Ethereum only: Covenant
        // reads Ethereum and settles on Creditcoin, both EVM.
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
        },
      }}
    >
      <LiveSession>{children}</LiveSession>
    </PrivyProvider>
  );
}

export function useSession(): Session {
  return useContext(Ctx);
}
