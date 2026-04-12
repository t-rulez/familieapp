const CACHE_NAME = 'brief-v2';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

self.addEventListener('push', e => {
  if (!e.data) return;
  const data = e.data.json();
  e.waitUntil(self.registration.showNotification(data.title || 'Brief', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'brief-msg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/?filter=unread' },
    actions: [
      { action: 'open', title: 'Åpne' },
      { action: 'dismiss', title: 'Lukk' }
    ]
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  const url = e.notification.data?.url || '/?filter=unread';
  const fullUrl = self.location.origin + url;
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.includes(self.location.origin)) {
          c.postMessage({ type: 'NAVIGATE', filter: 'unread' });
          return c.focus();
        }
      }
      return clients.openWindow(fullUrl);
    })
  );
});
