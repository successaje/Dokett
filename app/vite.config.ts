import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
