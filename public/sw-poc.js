// SW minimal — POC notifications push (temporaire, remplacé par src/sw.ts en phase 3).
self.addEventListener('push', (event) => {
  let titre = 'Rituel';
  let corps = 'Notification';
  try {
    const data = event.data ? event.data.json() : {};
    titre = data.title ?? titre;
    corps = data.body ?? corps;
  } catch {
    corps = event.data ? event.data.text() : corps;
  }
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: corps,
      icon: 'pwa-192x192.png',
      badge: 'pwa-64x64.png',
    }),
  );
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow('/rituel-app/'));
});
