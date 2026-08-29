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

interface PostDef {
  slug: string;
  date: string;
  title: string;
  dek: string;
  full?: string;
  body: () => ReactNode;
}

const POSTS: PostDef[] = [
  {
    slug: 'first-slash',
    date: '27 Aug 2026',
    title: 'We had never actually slashed anyone',
    dek: "Dokett's market thesis rests on first-loss capital being slashed automatically when a borrower defaults. That mechanism had never fired on-chain — it lived in the unit suite and nowhere else. So we made it fire.",
    full: `${REPO}/blob/main/docs/research/003-first-slash.md`,
    body: () => (
      <>
        <p>
          Both defaulted obligations in the register carried no bonds, so both honestly reported{' '}
          <code className="mono">slashed: 0</code>. The two live bonds sat on obligations that would
          not default for weeks. A protocol whose central economic claim is untested in production
          has not really demonstrated its central economic claim.
        </p>
        <p>
          So we registered an obligation, posted 250 mUSDC of first-loss capital against it while it
          was still Active, and then did nothing. The keeper marked it delinquent, and when the
          attested head passed the cure height it finalised the default — and slashed the bond to
          the creditor <strong>in the same transaction</strong>.
        </p>
        <div className="table-wrap">
          <table className="data">
            <tbody>
              <tr>
                <td>Registered</td>
                <td>
                  <Tx hash="0x5801c2fdfb9d8f04c1b016c32934ade1e5f4eabdfd06591884c3a04750cef473" />
                </td>
              </tr>
              <tr>
                <td>Bond posted</td>
                <td>
                  <Tx hash="0x345d4034eb1a32aa5d35266b45d1c9f2e3a29e0271f7d6bd9c2c8222382966d4" />
                </td>
              </tr>
              <tr>
                <td>→ Default + slash</td>
                <td>
                  <Tx hash="0x952c03ffa363ce8f0fe4eab397636f5aebc1b139380cfabd756ead678e2d480d" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          The underwriter's loss rate went from 0.00% to <strong>7.69%</strong> — and that number is
          not a score anyone assigned. It is slashed ÷ posted, recomputed from bond events by anyone
          with an RPC endpoint, and it cannot be edited, including by us.
        </p>
        <p>
          The bond was deliberately smaller than the debt: 250 against 1,000 principal. The creditor
          received the entire first-loss position and is still 750 short. That is what first-loss
          capital is — it absorbs the first tranche of a loss, not the loss. Sizing the bond to
          cover the whole debt would have implied a guarantee this protocol does not offer.
        </p>
      </>
    ),
  },
  {
    slug: 'autonomous-default',
    date: '19 Aug 2026',
    title: 'We watched an obligation default. Nobody reported it.',
    dek: "Dokett's core mechanism is an inversion: proving absence, not presence. We registered a real obligation and watched an unattended keeper degrade it to default with no human in the loop, end to end.",
    full: `${REPO}/blob/main/docs/research/002-autonomous-default.md`,
    body: () => (
      <>
        <p>2.3 minutes, two autonomous sweeps, one keeper address, zero manual transactions:</p>
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
          <code className="mono">Defaulted</code> reports <code className="mono">slashed: 0</code>{' '}
          honestly — no underwriter had posted first-loss capital against this specific obligation, so
          there was nothing to slash. We also caught, and fixed, a Console bug that had asserted a
          slash on a different unbonded default that never checked actual bond state.
        </p>
      </>
    ),
  },
  {
    slug: 'attestcoin-cost-model',
    date: '19 Aug 2026',
    title: 'What does it actually cost to verify a foreign chain?',
    dek: "Creditcoin publishes a cost formula for ASC verification. We didn't take it on faith — we measured five real Ethereum transactions spanning twenty minutes to two years old.",
    full: `${REPO}/blob/main/docs/research/001-attestcoin-cost-model.md`,
    body: () => (
      <>
        <p>
          <strong>26% more cost for 51,529× the age.</strong> Past roughly a year the continuity proof
          saturates at 232 roots rather than growing without bound — proving a two-year-old fact costs
          about one twentieth of a US cent. That flatness is the entire economic argument for a
          permanent registry.
        </p>
        <p>
          We also found where our own measured number disagreed with Creditcoin's published formula —
          7.4× higher — and traced the entire gap to the guarded path a real integration needs
          (decoder, replay guard, liveness check) rather than the bare precompile call the published
          number describes. And a 1% gas anomaly on a legacy transaction turned up a real gap: our
          test suite had never exercised a pre-EIP-1559 transaction until then.
        </p>
      </>
    ),
  },
  {
    slug: 'first-verified-transfer',
    date: '19 Aug 2026',
    title: 'A real Ethereum transfer, verified inside a Creditcoin contract',
    dek: 'No bridge. No Ethereum-side contract. No centralized oracle. Attestcoin proof to Creditcoin verification, in one block.',
    body: () => (
      <>
        <p>
          375,746 gas · 0.000187873 CTC · about $0.0001 —{' '}
          <Tx hash="0x85234a5dc158c402adfd384be8800969d570357611a1b59f3326098affc18fc4" label="the transaction" />.
        </p>
        <p>
          This is the evidence layer Dokett is built on: a registry where an obligation moves only
          when a foreign-chain event is proven, never because someone said so.
        </p>
      </>
    ),
  },
];

function ByLine({ date }: { date: string }) {
  return (
    <div className="post-byline">
      <span>{date}</span>
      <span className="post-byline-sep">·</span>
      <span>Dokett</span>
    </div>
  );
}

export function PostsIndex() {
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
        <div className="post-list">
          {POSTS.map((p) => (
            <a key={p.slug} className="post-card" href={`#/posts/${p.slug}`}>
              <ByLine date={p.date} />
              <h2 className="post-card-title">{p.title}</h2>
              <p className="post-card-dek">{p.dek}</p>
              <span className="post-card-read">Read →</span>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}

export function PostDetail({ slug }: { slug: string }) {
  const post = POSTS.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="page page-head">
        <div className="state">
          <div className="state-title">No such post</div>
          <a href="#/posts">Back to posts</a>
        </div>
      </div>
    );
  }

  const i = POSTS.indexOf(post);
  const prev = POSTS[i - 1];
  const next = POSTS[i + 1];

  return (
    <>
      <div className="page page-head">
        <a href="#/posts" className="post-back">
          ← All posts
        </a>
        <ByLine date={post.date} />
        <h1 className="page-title" style={{ marginTop: 6 }}>
          {post.title}
        </h1>
        <p className="page-lede">{post.dek}</p>
      </div>

      <div className="page">
        <article className="post-article">{post.body()}</article>

        {post.full ? (
          <p style={{ marginTop: 22 }}>
            <a href={post.full} target="_blank" rel="noreferrer">
              Full report with methodology and every source transaction →
            </a>
          </p>
        ) : null}

        <div className="post-nav">
          {prev ? (
            <a href={`#/posts/${prev.slug}`} className="post-nav-link" data-dir="prev">
              <span className="post-nav-label">← Previous</span>
              <span className="post-nav-title">{prev.title}</span>
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a href={`#/posts/${next.slug}`} className="post-nav-link" data-dir="next">
              <span className="post-nav-label">Next →</span>
              <span className="post-nav-title">{next.title}</span>
            </a>
          ) : (
            <span />
          )}
        </div>
      </div>
    </>
  );
}
