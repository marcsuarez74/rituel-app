/// <reference lib="webworker" />
// Service worker custom (injectManifest) : precache du build + handlers push.
// Le serveur envoie { title, body } prêts à afficher — le SW n'interprète
// jamais le contenu.
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

self.addEventListener('push', (e) => {
  let titre = 'Rituel';
  let corps = '';
  try {
    const p = (e as PushEvent).data?.json() as { title?: string; body?: string } | undefined;
    if (p?.title) titre = p.title;
    if (p?.body) corps = p.body;
  } catch {
    /* payload non JSON : notification générique */
  }
  e.waitUntil(
    self.registration.showNotification(titre, {
      body: corps || undefined,
      icon: '/rituel-app/pwa-192x192.png',
      badge: '/rituel-app/pwa-64x64.png',
      data: { url: '/rituel-app/' },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const c = clients[0];
      if (c) return c.focus();
      return self.clients.openWindow('/rituel-app/');
    })(),
  );
});
