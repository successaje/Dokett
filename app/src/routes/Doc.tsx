import { marked } from 'marked';
import { useEffect, useState } from 'react';
import { Failed, Loading } from '../components/primitives';

const REPO = 'https://github.com/successaje/covenant';

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
    dek: 'Exactly how Dokett uses Attestcoin Smart Contracts — measured gas costs, batching, the liveness gate, and the guarded path around BlockProver.',
  },
  {
    slug: 'use-cases',
    file: 'USE-CASES.md',
    eyebrow: 'Design & threat model',
    title: 'Use cases',
    dek: 'A full end-to-end walkthrough, the audience this actually serves, and an explicit section on what isn’t load-bearing yet.',
  },
];

/**
 * The real spec documents, rendered in-app rather than summarised.
 *
 * Fetched at runtime from `/docs/*.md` — a copy kept in `app/public/docs/` —
 * rather than a Vite build-time import reaching outside `app/`. Deploys run
 * `vercel --prod` from inside `app/`, so a sibling `../docs/` is never part
 * of the uploaded build; an `import.meta.glob` pointed there resolved to
 * nothing on Vercel and the page sat in Loading forever, with no error, since
 * nothing actually failed. `public/` assets are always in the deployed
 * bundle regardless of which directory Vercel treats as the project root.
 */
function useDocSource(file: string) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ok'; html: string } | { status: 'error'; message: string }
  >({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(`${import.meta.env.BASE_URL}docs/${file}`)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.text();
      })
      .then((raw) => {
        if (cancelled) return;
        setState({ status: 'ok', html: marked.parse(raw, { async: false }) as string });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ status: 'error', message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [file]);

  return state;
}

export default function Doc({ slug }: { slug: string }) {
  const def = DOCS.find((d) => d.slug === slug);
  const state = useDocSource(def?.file ?? '');

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
        {state.status === 'loading' && <Loading rows={8} />}
        {state.status === 'error' && (
          <Failed what={`${def.title.toLowerCase()}`} detail={state.message} />
        )}
        {state.status === 'ok' && <div className="doc-md" dangerouslySetInnerHTML={{ __html: state.html }} />}
      </div>
    </>
  );
}
