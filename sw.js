// KY 주문 시스템 Service Worker v20260413-hotfix1
const CACHE = 'ky-order-v20260413-hotfix1';
const APP_ROOT = '/KY-order';
const ASSETS = [
  APP_ROOT + '/',
  APP_ROOT + '/index.html',
  APP_ROOT + '/manifest.json',
  APP_ROOT + '/icon-192.png',
  APP_ROOT + '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', cache: CACHE }));
  })());
});

self.addEventListener('message', event => {
  if(event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if(url.origin !== self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  const isHtml = event.request.mode === 'navigate' || (event.request.headers.get('accept') || '').includes('text/html');

  if(isHtml) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch (error) {
        return (await caches.match(event.request)) || (await caches.match(APP_ROOT + '/index.html'));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if(cached) return cached;
    try {
      const fresh = await fetch(event.request);
      if(fresh && fresh.status === 200 && fresh.type !== 'error') {
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      return cached;
    }
  })());
});

self.addEventListener('push', event => {
  let data = { title: 'KY 주문 시스템', body: '새 알림이 있습니다.' };
  try { data = event.data.json(); } catch (err) {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'KY 주문 시스템', {
      body: data.body || '',
      icon: APP_ROOT + '/icon-192.png',
      badge: APP_ROOT + '/icon-192.png',
      tag: data.tag || 'ky-order-notif',
      requireInteraction: true,
      data
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if(client.url.includes(APP_ROOT) && 'focus' in client) return client.focus();
    }
    if(clients.openWindow) return clients.openWindow(APP_ROOT + '/');
  })());
});
