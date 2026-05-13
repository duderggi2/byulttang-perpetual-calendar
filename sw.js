// 별땅 만세력 Pro — Service Worker
// 버전을 바꾸면 캐시가 갱신됨
const CACHE_VERSION = 'byulddang-v1.5.1';  // 2026-05-13 — SPARQL 최적화 (503 박힘 해결)

// 캐시할 파일 목록
const CORE_ASSETS = [
  './',
  './index.html',
  './compare.html',
  './manifest.json'
];

// 인물DB는 별도 캐시 (크기가 크므로 분리)
const DB_CACHE = 'byulddang-db-v3-43893';  // 2026-05-13 — 43,893명 박힘
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
      // 인물DB 청크 별도 캐싱 (실패해도 설치는 진행)
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

// 요청 가로채기: 캐시 우선, 없으면 네트워크
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 외부 API 요청 (위키백과·wikidata 등)은 가로채지 않음
  // — 브라우저가 직접 처리 (SW 통과 시 timeout 자리에서 SW가 503 만드는 자리 박힘)
  if (url.origin !== self.location.origin) {
    return;
  }

  // 로컬 파일: 캐시 우선 → 네트워크 폴백
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // 정상 응답이면 캐시에 저장
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
