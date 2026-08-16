import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  /*
   * Read .env from the repo root rather than from app/.
   *
   * Vite defaults envDir to its own root, which would mean the Console needed a
   * second .env while the keeper and Lens read the first. Two env files for one
   * project is a trap: you set a key in the obvious place, nothing happens, and
   * there is no error — the variable is simply undefined, and the feature stays
   * invisible.
   *
   * Sharing the file is safe because Vite only exposes VITE_-prefixed keys to
   * the client. KEEPER_PRIVATE_KEY and friends sit in the same file and never
   * reach the bundle.
   */
  envDir: '..',

  server: {
    port: 5173,
    // The Lens is a separate read-only service. Proxying in dev keeps the app
    // origin-clean so a judge does not have to think about CORS.
    proxy: {
      '/api': {
        target: process.env.LENS_URL || 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
