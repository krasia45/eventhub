/* EventHub Service Worker
   목적: PWA 설치 가능하게 만들고, 오프라인일 때만 캐시된 화면을 보여줌.

   ⚠️ 이전 버전의 버그: "캐시 우선(Cache First)" 전략을 써서, 인터넷이 멀쩡해도
   무조건 저장된 옛날 파일부터 보여주고 서버의 새 버전은 확인하지 않았습니다.
   그래서 배포를 새로 해도 강력 새로고침을 해야만 반영되는 문제가 있었습니다.

   수정된 전략: "네트워크 우선(Network First)" — 온라인이면 항상 서버의 최신 파일을
   먼저 받아오고, 그 요청이 실패했을 때(오프라인 등)만 캐시된 화면을 보여줍니다. */

const CACHE_NAME = "eventhub-shell-v2";
const APP_SHELL = ["/", "/index.html", "/css/style.css", "/js/main.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting(); // 새 서비스워커를 설치 즉시 활성화 (탭을 안 닫아도 바로 적용되도록)
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim(); // 이미 열려있는 탭에도 새 서비스워커가 즉시 적용되도록
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API 요청(/api/*)은 서비스워커가 아예 관여하지 않음 — 항상 네트워크로 직행
  if (url.pathname.startsWith("/api/")) return;

  // 네트워크 우선: 서버에서 최신 파일을 받아오고, 성공하면 캐시도 최신으로 갱신.
  // 오프라인 등으로 네트워크 요청이 실패할 때만 캐시된 예전 화면을 보여줌.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});