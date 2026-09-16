/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string;
};

// https://vite.dev/config/
export default defineConfig({
  // Nom du repo GitHub — mettre à jour si le repo est renommé
  base: '/rituel-app/',
  // Version du build (package.json), affichée en bas de l'écran Profil
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Rituel — cuisine & sport',
        short_name: 'Rituel',
        description: 'Suivi cuisine, diet et sport — Marc & Mélanie',
        lang: 'fr',
        display: 'standalone',
        start_url: '.',
        theme_color: '#f0f2eb',
        background_color: '#f0f2eb',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
          { src: 'apple-touch-icon-180x180.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Les miniatures de rayons (jpg hashées) sont servies en CacheFirst :
        // hors-ligne OK après la 1ʳᵉ vue, sans gonfler le précache.
        runtimeCaching: [
          {
            urlPattern: /\.(?:jpg|jpeg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /^https:\/\/images\.unsplash\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
      // Les icônes sont déjà pré-cachées par le glob **/*.png : on désactive la
      // seconde injection via manifest.icons sinon chaque icône est precachée 2×.
      includeManifestIcons: false,
    }),
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: './tests/setup.ts',
    // tests/e2e = Playwright (navigateur réel), pas du vitest ;
    // .worktrees = worktrees git locaux (leur propre node_modules, pas notre code)
    exclude: ['**/node_modules/**', 'tests/e2e/**', '.worktrees/**'],
  },
})
