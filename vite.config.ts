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
        background_color: '#f7f3ea',
        theme_color: '#f7f3ea',
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
