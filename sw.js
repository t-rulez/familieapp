const CACHE_NAME = 'familie-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});

// Push-varsel mottat
self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  const title   = data.title || 'Familie';
  const options = {
    body:    data.body || '',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     data.tag || 'familie-msg',
    data:    { url: data.url || '/' },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: 'Åpne' },
      { action: 'dismiss', title: 'Lukk'  }
    ]
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// Klikk på varsel
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/');
    })
  );
});
