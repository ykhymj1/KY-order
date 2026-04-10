// KY 주문 시스템 Service Worker
const CACHE = 'ky-order-v2';
const ASSETS = [
  '/KY-order/',
  '/KY-order/index.html',
  '/KY-order/manifest.json',
  '/KY-order/icon-192.png',
  '/KY-order/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (!e.request.url.startsWith(self.location.origin)) {
    return e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      const clone = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, clone));
      return res;
    }))
  );
});

self.addEventListener('push', e => {
  let data = { title: 'KY 주문 시스템', body: '새 알림이 있습니다.' };
  try { data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'KY 주문 시스템', {
      body: data.body || '',
      icon: '/KY-order/icon-192.png',
      badge: '/KY-order/icon-192.png',
      tag: data.tag || 'ky-order',
      data: data
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for(const client of clientList){
        if(client.url.includes('/KY-order/') && 'focus' in client) return client.focus();
      }
      if(clients.openWindow) return clients.openWindow('/KY-order/');
    })
  );
});
