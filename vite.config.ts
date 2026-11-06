import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // A deploy shows a prompt instead of reloading the page under the user.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Gambit — Entraînement aux échecs',
        short_name: 'Gambit',
        description:
          'Puzzles, finales, ouvertures et parties contre le moteur. Sans compte, hors ligne.',
        lang: 'fr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // Both are the light `paper` of the app: the splash then melts into the
        // first frame instead of flashing a warmer cream, and the status bar
        // tints the same before and after the app paints itself.
        background_color: '#fbfaf8',
        theme_color: '#fbfaf8',
        icons: [
          { src: '/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,gz,wasm}'],
        // The Maia model and its runtime weigh 21 and 15 MB: precaching them would make every
        // install pay for a mode the user may never open. They are cached on first use instead.
        globIgnores: ['**/maia/**', '**/ort/**', '**/ort-wasm-*'],
        runtimeCaching: [
          {
            urlPattern: /\/(maia|ort)\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gambit-engine',
              expiration: { maxEntries: 8 },
            },
          },
        ],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // The prompt sends SKIP_WAITING to the new worker. Without claiming the clients, that
        // worker would activate but leave the page on the old one, and the reload would never
        // happen.
        clientsClaim: true,
      },
    }),
  ],
});
