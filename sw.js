// KY 주문 시스템 Service Worker v20260416-r1
const CACHE = 'ky-order-v20260416-r1';
const APP_ROOT = '';  // Netlify 루트 배포
const ASSETS = [
  APP_ROOT + '/',
  APP_ROOT + '/index.html',
  APP_ROOT + '/manifest.json',
  APP_ROOT + '/icon-192.png',
  APP_ROOT + '/icon-512.png'
];

// ── 설치: 핵심 에셋 캐시 ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

// ── 활성화: 구버전 캐시 삭제 ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(key => key !== CACHE).map(key => caches.delete(key))
    );
    await self.clients.claim();
    // 열린 탭에 업데이트 알림
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => client.postMessage({ type: 'SW_UPDATED', cache: CACHE }));
  })());
});

// ── 메시지 처리 ──────────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── fetch 전략 ────────────────────────────────────
// HTML: 항상 네트워크 우선 (최신 배포 즉시 반영)
// 그 외: 캐시 우선, 없으면 네트워크 후 캐시 저장
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 외부 도메인(Firebase, Telegram 등)은 네트워크 직접 요청
  if (url.origin !== self.location.origin) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  const isHtml = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    // HTML: 네트워크 우선 → 실패 시 캐시 폴백
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request, { cache: 'no-store' });
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
        return fresh;
      } catch {
        return (await caches.match(event.request)) ||
               (await caches.match(APP_ROOT + '/index.html'));
      }
    })());
    return;
  }

  // 정적 에셋: 캐시 우선
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const fresh = await fetch(event.request);
      if (fresh && fresh.status === 200 && fresh.type !== 'error') {
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch {
      return new Response('Network error', { status: 408 });
    }
  })());
});

// ── 푸시 알림 수신 ───────────────────────────────
self.addEventListener('push', event => {
  let data = { title: 'KY 주문 시스템', body: '새 알림이 있습니다.' };
  try { data = event.data.json(); } catch {}
  event.waitUntil(
    self.registration.showNotification(data.title || 'KY 주문 시스템', {
      body: data.body || '',
      icon: APP_ROOT + '/icon-192.png',
      badge: APP_ROOT + '/icon-192.png',
      tag: data.tag || 'ky-order-notif',
      requireInteraction: true,  // KY는 대리점 앱 → 주문 알림 유지
      data
    })
  );
});

// ── 알림 클릭 → 앱 포커스 또는 열기 ─────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (client.url.includes(APP_ROOT) && 'focus' in client) return client.focus();
    }
    if (clients.openWindow) return clients.openWindow(APP_ROOT + '/');
  })());
});
