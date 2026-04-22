import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for @hw/web.
 *
 * Dev server proxies `/api` requests to the Express server on :3000 so the
 * browser makes same-origin calls. Production build is a standard SPA bundle.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: false,
      },
    },
  },
});
