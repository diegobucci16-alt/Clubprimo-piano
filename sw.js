/* ================================================
   CLUB 1 PIANO — SERVICE WORKER
   Gestisce push notifications in background
   ================================================ */

const CACHE_NAME = 'club1piano-v1';

// ===== INSTALL =====
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

// ===== PUSH ricevuto (anche con browser chiuso) =====
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}

  const title = data.title || 'Club 1 Piano';
  const options = {
    body:      data.body  || 'Scopri le offerte di stasera',
    icon:      data.icon  || 'https://www.portagalliana-clubprimopiano.com/assets/logo.png',
    badge:     data.badge || 'https://www.portagalliana-clubprimopiano.com/assets/logo.png',
    data:      { url: data.url || '/' },
    tag:       data.tag   || 'club1piano',
    renotify:  true,
    vibrate:   [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ===== Click sulla notifica → apri app =====
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Porta in primo piano se già aperta
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Altrimenti apri nuova finestra
      return clients.openWindow(url);
    })
  );
});
