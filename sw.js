/* EventHub Service Worker — 최소 버전
   목적: PWA 설치 가능하게 만들고, 앱 셸(HTML/CSS/JS)을 캐싱해 재방문 시 로딩을 빠르게 함.
   ⚠️ 실시간 이벤트 데이터(/api/*)는 캐싱하지 않음 — 항상 최신 데이터를 받아야 하기 때문. */

const CACHE_NAME = "eventhub-shell-v1";
const APP_SHELL = ["/", "/index.html", "/css/style.css", "/js/main.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API 요청(/api/*)은 절대 캐시하지 않고 항상 네트워크에서 최신으로 받아옴
  if (url.pathname.startsWith("/api/")) return;

  // 앱 셸(정적 파일)은 캐시 우선, 없으면 네트워크 (Cache First)
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});