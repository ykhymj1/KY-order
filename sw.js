// KY 주문 시스템 Service Worker v10
const CACHE = 'ky-order-v10';
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
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // 외부 요청(Firebase, Telegram, Google Fonts 등) → 네트워크 우선
  if (!e.request.url.startsWith(self.location.origin)) {
    return e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
  // 앱 자체 파일 → 캐시 우선, 없으면 네트워크
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'error') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      });
    })
  );
});

// Push 알림 수신
self.addEventListener('push', e => {
  let data = { title: 'KY 주문 시스템', body: '새 알림이 있습니다.' };
  try { data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'KY 주문 시스템', {
      body: data.body || '',
      icon: '/KY-order/icon-192.png',
      badge: '/KY-order/icon-192.png',
      tag: data.tag || 'ky-order',
      requireInteraction: true,
      data: data
    })
  );
});

// 알림 클릭 시 앱 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/KY-order/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow('/KY-order/');
    })
  );
});
