export type ProtocolRelease = 'v1' | 'v2';

export interface ReleaseConfig {
  id: ProtocolRelease;
  label: string;
  version: string;
  lensUrl: string;
  deployBlock: number;
  addresses: {
    verifier: `0x${string}`;
    bond: `0x${string}`;
    register: `0x${string}`;
    encumbrance?: `0x${string}`;
  };
}

export const RELEASES: Record<ProtocolRelease, ReleaseConfig> = {
  v1: {
    id: 'v1',
    label: 'v1 Demonstration',
    version: 'v0.1.0',
    lensUrl: import.meta.env.VITE_LENS_URL ?? '/api',
    deployBlock: 783_269,
    addresses: {
      verifier: (import.meta.env.VITE_VERIFIER_ADDRESS ??
        '0x02406b6d17E743deA7fBbfAE8A15c82e4481E168') as `0x${string}`,
      bond: (import.meta.env.VITE_BOND_ADDRESS ??
        '0x545Ac0DaAa0b7095e62c7fa702C43a3A0F152d2e') as `0x${string}`,
      register: (import.meta.env.VITE_REGISTER_ADDRESS ??
        '0xCaFF129Ec344A98Da8C9a4091a239DF158Cf31A5') as `0x${string}`,
    },
  },
  v2: {
    id: 'v2',
    label: 'v0.2 Current Protocol',
    version: 'v0.2.0',
    lensUrl: import.meta.env.VITE_LENS_V2_URL ?? '/api-v2',
    deployBlock: 5_482_440,
    addresses: {
      verifier: (import.meta.env.VITE_VERIFIER_V2_ADDRESS ??
        '0x0aF5Edf93C35608a3EfC3C741Cc261de6da55522') as `0x${string}`,
      bond: (import.meta.env.VITE_BOND_V2_ADDRESS ??
        '0xb08fbE5b83CaE7FC167ad670CDd73Ece211D0ceA') as `0x${string}`,
      register: (import.meta.env.VITE_REGISTER_V2_ADDRESS ??
        '0xdcCF757C996Ee36E7f40B81a583B4B3692956281') as `0x${string}`,
      encumbrance: (import.meta.env.VITE_ENCUMBRANCE_V2_ADDRESS ??
        '0x73713DD8865353270f548917F707DF29Cc944B2f') as `0x${string}`,
    },
  },
};

export function selectedReleaseId(): ProtocolRelease {
  const saved = localStorage.getItem('dokett.release');
  return saved === 'v1' ? 'v1' : 'v2';
}

export function selectedRelease(): ReleaseConfig {
  return RELEASES[selectedReleaseId()];
}

export function selectRelease(release: ProtocolRelease) {
  localStorage.setItem('dokett.release', release);
  window.location.reload();
}
