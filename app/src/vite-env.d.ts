/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Override the Lens origin. Defaults to /api, proxied by vite in dev. */
  readonly VITE_LENS_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
