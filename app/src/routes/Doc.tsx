import { marked } from 'marked';
import { useMemo } from 'react';
import { Loading } from '../components/primitives';

const REPO = 'https://github.com/successaje/covenant';

// Vite's `?raw` reads the file at build/dev time — these are the real spec
// documents, not a summary of them. Rendered in-app so depth doesn't require
// leaving the site; the GitHub link on each page is for history and diffs,
// not because the content itself lives elsewhere.
const SOURCES = import.meta.glob('../../../docs/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

interface DocDef {
  slug: string;
  file: string;
  eyebrow: string;
  title: string;
  dek: string;
}

export const DOCS: DocDef[] = [
  {
    slug: 'architecture',
    file: 'ARCHITECTURE.md',
    eyebrow: 'Design & threat model',
    title: 'Architecture',
    dek: 'System diagram, data model, contract responsibilities, ASC reference, build order. Carries its own corrections log for where the first draft was wrong.',
  },
  {
    slug: 'threat-model',
    file: 'THREAT-MODEL.md',
    eyebrow: 'Design & threat model',
    title: 'Threat model',
    dek: 'T-01 through T-15, and the protocol invariants the test suite exists to defend.',
  },
  {
    slug: 'asc-integration',
    file: 'ASC-INTEGRATION.md',
    eyebrow: 'Design & threat model',
    title: 'ASC integration',
    dek: 'Exactly how Covenant uses Attestcoin Smart Contracts — measured gas costs, batching, the liveness gate, and the guarded path around BlockProver.',
  },
  {
    slug: 'use-cases',
    file: 'USE-CASES.md',
    eyebrow: 'Design & threat model',
    title: 'Use cases',
    dek: 'A full end-to-end walkthrough, the audience this actually serves, and an explicit section on what isn’t load-bearing yet.',
  },
];

function findSource(file: string): string | undefined {
  const entry = Object.entries(SOURCES).find(([path]) => path.endsWith(`/${file}`));
  return entry?.[1];
}

export default function Doc({ slug }: { slug: string }) {
  const def = DOCS.find((d) => d.slug === slug);
  const raw = def ? findSource(def.file) : undefined;

  const html = useMemo(() => {
    if (!raw) return '';
    return marked.parse(raw, { async: false }) as string;
  }, [raw]);

  if (!def) {
    return (
      <div className="page page-head">
        <div className="state">
          <div className="state-title">No such document</div>
          <a href="#/developers">Back to Developers</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page page-head">
        <a href="#/developers" className="post-back">
          ← Developers
        </a>
        <div className="eyebrow">{def.eyebrow}</div>
        <h1 className="page-title" style={{ marginTop: 6 }}>
          {def.title}
        </h1>
        <p className="page-lede">{def.dek}</p>
        <p style={{ marginTop: 10 }}>
          <a href={`${REPO}/blob/main/docs/${def.file}`} target="_blank" rel="noreferrer">
            View source on GitHub ↗
          </a>{' '}
          <span className="note" style={{ marginLeft: 6 }}>
            — for history, diffs, and raw markdown.
          </span>
        </p>
      </div>

      <div className="page">
        {raw ? (
          <div className="doc-md" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <Loading rows={8} />
        )}
      </div>
    </>
  );
}
