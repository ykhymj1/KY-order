// KY 주문 시스템 Service Worker v7
// 변경내역: 반품/교환 주문 처리, 코드 요청 기능, 동기화 버그 수정 반영
const CACHE = 'ky-order-v7';
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
  const url = e.request.url;

  // Firebase / Telegram / Google APIs / 외부 CDN → 네트워크 우선 (캐시 안 함)
  if (!url.startsWith(self.location.origin) ||
       url.includes('firebaseio.com') ||
       url.includes('googleapis.com') ||
       url.includes('api.telegram.org') ||
       url.includes('gstatic.com')) {
    return e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }

  // 앱 자체 파일 → 캐시 우선 + 백그라운드 업데이트 (stale-while-revalidate)
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type !== 'error') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || fetchPromise;
    })
  );
});

// Push 알림 수신 (주문 상태 변경 등)
self.addEventListener('push', e => {
  let data = { title: 'KY 주문 시스템', body: '새 알림이 있습니다.' };
  try { data = e.data.json(); } catch(err) {}
  e.waitUntil(
    self.registration.showNotification(data.title || 'KY 주문 시스템', {
      body: data.body || '',
      icon: '/KY-order/icon-192.png',
      badge: '/KY-order/icon-192.png',
      tag: data.tag || 'ky-order',
      requireInteraction: true,   // 사용자가 닫을 때까지 유지
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

// SW 메시지 수신 (강제 갱신 요청 처리)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data && e.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE).then(() =>
      caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
    );
  }
});
