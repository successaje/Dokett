import type { ReactNode } from 'react';

const REPO = 'https://github.com/successaje/covenant';
const EXPLORER = 'https://creditcoin-testnet.blockscout.com/tx/';

function Tx({ hash, label }: { hash: string; label?: string }) {
  return (
    <a className="mono" href={`${EXPLORER}${hash}`} target="_blank" rel="noreferrer">
      {label ?? `${hash.slice(0, 10)}…${hash.slice(-6)}`}
    </a>
  );
}

function Post({
  date,
  title,
  dek,
  children,
  full,
}: {
  date: string;
  title: string;
  dek: string;
  children: ReactNode;
  full?: string;
}) {
  return (
    <article className="section" style={{ paddingTop: 28, borderTop: '1px solid var(--rule)' }}>
      <div className="eyebrow">{date}</div>
      <h2 className="page-title" style={{ fontSize: 27, marginTop: 4 }}>
        {title}
      </h2>
      <p className="page-lede" style={{ fontSize: 15, marginTop: 6 }}>
        {dek}
      </p>
      <div className="stack" style={{ gap: 12, maxWidth: '68ch', marginTop: 16 }}>
        {children}
      </div>
      {full ? (
        <p style={{ marginTop: 16 }}>
          <a href={full} target="_blank" rel="noreferrer">
            Full report with methodology and every source transaction →
          </a>
        </p>
      ) : null}
    </article>
  );
}

export default function Posts() {
  return (
    <>
      <div className="page page-head">
        <div className="eyebrow">Findings, not marketing copy</div>
        <h1 className="page-title">Posts</h1>
        <p className="page-lede">
          What we found operating this protocol against a live chain. Every number links to a real
          transaction — nothing here is asserted without a way for you to check it yourself.
        </p>
      </div>

      <div className="page">
        <Post
          date="19 Aug 2026"
          title="We watched an obligation default. Nobody reported it."
          dek="Covenant's core mechanism is an inversion: proving absence, not presence. We registered a real obligation and watched an unattended keeper degrade it to default with no human in the loop, end to end."
          full={`${REPO}/blob/main/docs/research/002-autonomous-default.md`}
        >
          <p>
            2.3 minutes, two autonomous sweeps, one keeper address, zero manual transactions:
          </p>
          <div className="table-wrap">
            <table className="data">
              <tbody>
                <tr>
                  <td>Registered</td>
                  <td>
                    <Tx hash="0x7da80af3fcedc969167c1ad4cc818f513e30deef555581ad7a195f83e9eb9fc8" />
                  </td>
                </tr>
                <tr>
                  <td>→ Delinquent</td>
                  <td>
                    <Tx hash="0x72127e0d2db87c381e266be69f6c9dac90585d04b471a0cd57c0425bf7202789" />
                  </td>
                </tr>
                <tr>
                  <td>→ Default</td>
                  <td>
                    <Tx hash="0x7ce07a2ec62b1b41bce4565784c51a97d57b6a1b7b5933a84724960759a61f7d" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            <code className="mono">Defaulted</code> reports <code className="mono">slashed: 0</code> honestly — no
            underwriter had posted first-loss capital against this specific obligation, so there
            was nothing to slash. We also caught, and fixed, a Console bug that had asserted a
            slash on a different unbonded default that never checked actual bond state.
          </p>
        </Post>

        <Post
          date="19 Aug 2026"
          title="What does it actually cost to verify a foreign chain?"
          dek="Creditcoin publishes a cost formula for ASC verification. We didn't take it on faith — we measured five real Ethereum transactions spanning twenty minutes to two years old."
          full={`${REPO}/blob/main/docs/research/001-attestcoin-cost-model.md`}
        >
          <p>
            <strong>26% more cost for 51,529× the age.</strong> Past roughly a year the continuity
            proof saturates at 232 roots rather than growing without bound — proving a two-year-old
            fact costs about one twentieth of a US cent. That flatness is the entire economic
            argument for a permanent registry.
          </p>
          <p>
            We also found where our own measured number disagreed with Creditcoin's published
            formula — 7.4× higher — and traced the entire gap to the guarded path a real
            integration needs (decoder, replay guard, liveness check) rather than the bare
            precompile call the published number describes. And a 1% gas anomaly on a legacy
            transaction turned up a real gap: our test suite had never exercised a pre-EIP-1559
            transaction until then.
          </p>
        </Post>

        <Post
          date="19 Aug 2026"
          title="A real Ethereum transfer, verified inside a Creditcoin contract"
          dek="No bridge. No Ethereum-side contract. No centralized oracle. Attestcoin proof to Creditcoin verification, in one block."
        >
          <p>
            375,746 gas · 0.000187873 CTC · about $0.0001 —{' '}
            <Tx hash="0x85234a5dc158c402adfd384be8800969d570357611a1b59f3326098affc18fc4" label="the transaction" />.
          </p>
          <p>
            This is the evidence layer Covenant is built on: a registry where an obligation moves
            only when a foreign-chain event is proven, never because someone said so.
          </p>
        </Post>
      </div>
    </>
  );
}
