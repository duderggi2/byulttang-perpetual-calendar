// 별땅 만세력 Pro — Service Worker
// 버전을 바꾸면 캐시가 갱신됨
const CACHE_VERSION = 'byulddang-v1.9.2';  // 2026-05-26 — 시간미상 자세 술시(20시) 박음 (별땅 짚음)

// 캐시할 파일 목록
const CORE_ASSETS = [
  './',
  './index.html',
  './compare.html',
  './manifest.json'
];

// 인물DB는 별도 캐시 (크기가 크므로 분리)
const DB_CACHE = 'byulddang-db-v5-44517';
const DB_CHUNKS = [
  './db_chunk_1.json',
  './db_chunk_2.json',
  './db_chunk_3.json'
];

// 설치: 핵심 파일 캐싱
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      console.log('[SW] 핵심 파일 캐싱 중...');
      return cache.addAll(CORE_ASSETS);
    }).then(() => {
      return caches.open(DB_CACHE).then(cache => {
        console.log('[SW] 인물DB 청크 캐싱 시작...');
        return Promise.all(
          DB_CHUNKS.map(chunk =>
            cache.add(chunk).catch(err =>
              console.warn('[SW] 청크 캐싱 실패:', chunk, err)
            )
          )
        );
      });
    }).then(() => self.skipWaiting())
  );
});

// 활성화: 이전 버전 캐시 정리
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_VERSION && key !== DB_CACHE)
            .map(key => {
              console.log('[SW] 이전 캐시 삭제:', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

// 요청 가로채기
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 외부 API 요청은 가로채지 않음 — 브라우저가 직접 처리
  if (url.origin !== self.location.origin) {
    return;
  }

  // ★ version.json은 절대 캐시 X — 항상 네트워크에서 최신 데이터 버전 확인 (자동 감지용)
  if (url.pathname.endsWith('version.json')) {
    event.respondWith(fetch(event.request, {cache:'no-store'}).catch(()=>caches.match(event.request)));
    return;
  }

  // index.html, .html, 루트 자리, compare.html — network-first
  // (옛 캐시 자리 박혀있어도 항상 네트워크에서 새 자리 받음)
  const isHTML = url.pathname.endsWith('.html') ||
                 url.pathname.endsWith('/') ||
                 url.pathname === '' ||
                 url.pathname === '/byulttang-perpetual-calendar/' ||
                 url.pathname === '/byulttang-perpetual-calendar';
  
  if (isHTML) {
    // Network-first: 네트워크 우선 → 실패 시 캐시
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // 네트워크 실패 시 캐시 박힌 자리 박음
          return caches.match(event.request);
        })
    );
    return;
  }

  // 청크 자리·기타 자산은 캐시 우선 (큰 자리·자주 박지 X)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          const cacheName = event.request.url.includes('db_chunk') ? DB_CACHE : CACHE_VERSION;
          caches.open(cacheName).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
