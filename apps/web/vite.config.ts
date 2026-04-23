import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Vite config for @hw/web. Dev proxies /api to :3000. Production build is
 * a PWA: Service Worker precaches the app shell, and runtime caches handle
 * API responses, asset images (assets.cms.reearth.io), and GSI map tiles.
 */
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Meisho Explorer',
        short_name: 'Meisho',
        description: '日本の名所を地図と特集で巡る PWA',
        theme_color: '#b00020',
        background_color: '#fafafa',
        display: 'standalone',
        start_url: '/',
        lang: 'ja',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            // API responses (items / features / models / assets)
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'meisho-api',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Asset images served from assets.cms.reearth.io
            urlPattern: ({ url }) => url.hostname === 'assets.cms.reearth.io',
            handler: 'CacheFirst',
            options: {
              cacheName: 'meisho-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // GSI map tiles
            urlPattern: ({ url }) => url.hostname === 'cyberjapandata.gsi.go.jp',
            handler: 'CacheFirst',
            options: {
              cacheName: 'meisho-tiles',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
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
