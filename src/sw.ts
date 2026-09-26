/// <reference lib="webworker" />
// Service worker custom (injectManifest) : precache du build + stratégies
// images. Aucun handler métier : la sync passe par la page, pas par le SW.
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: unknown[] };

precacheAndRoute(self.__WB_MANIFEST);

// Miniatures de rayons + images de recettes : CacheFirst — hors-ligne OK
// après la 1ʳᵉ vue, sans gonfler le précache (parité avec l'ancien generateSW).
registerRoute(
  /\.(?:jpg|jpeg|webp)$/,
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);

registerRoute(
  /^https:\/\/images\.unsplash\.com\/.*/,
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 30 }),
      new CacheableResponsePlugin({ statuses: [200] }),
    ],
  }),
);
