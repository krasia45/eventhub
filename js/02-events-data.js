/* ---------- Category Definitions ---------- */
const CATEGORIES = [
  { id: "all",     label: "전체",       emoji: "🏠",
    icon: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="3" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.6"/><rect x="3" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="13" width="8" height="8" rx="2" stroke="currentColor" stroke-width="1.6"/></svg>` },
  { id: "fashion", label: "패션",       emoji: "👗",
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 4h6l1.5 2.5L21 9l-2.5 2-1-1.5V20a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V9.5l-1 1.5L3 9l4.5-2.5L9 4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="4" r="1.4" stroke="currentColor" stroke-width="1.4"/></svg>` },
  { id: "beauty",  label: "뷰티",       emoji: "💄",
    icon: `<svg viewBox="0 0 24 24" fill="none"><rect x="9" y="10" width="6" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M10 10V7a2 2 0 0 1 4 0v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M11 3.5h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>` },
  { id: "food",    label: "카페·디저트", emoji: "🍰",
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17" stroke="currentColor" stroke-width="1.6"/><path d="M8 3c0 1-1.2 1-1.2 2S8 6 8 7M12 3c0 1-1.2 1-1.2 2S12 6 12 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
  { id: "popup",   label: "팝업·컬처",   emoji: "🎪",
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M12 3v4M12 7 5 20h14L12 7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="3" r="1.3" stroke="currentColor" stroke-width="1.4"/><path d="M8.5 14.5h7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>` },
  { id: "living",  label: "라이프스타일", emoji: "🛋️",
    icon: `<svg viewBox="0 0 24 24" fill="none"><path d="M4 12v6M20 12v6M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2H4v-2Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M6 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="1.6"/></svg>` },
];

// BRD 확정 사항: 구매 주기가 긴 전자기기/숙박/배달/리빙은 이번 개편에서 제외
// (DB에는 그대로 남아있고, 프론트에서만 숨김 처리 — 나중에 필요하면 되살리기 쉽도록)
const ACTIVE_CATEGORY_IDS = CATEGORIES.filter(c => c.id !== "all").map(c => c.id);

/* ---------- 이벤트 대표 이미지 로드 실패 안전망 ----------
   브랜드 로고와 달리 이벤트 이미지는 외부 서비스 폴백이 없어서, 깨지면
   그대로 브라우저 기본 '깨진 이미지' 아이콘이 노출되던 문제.
   EventHub 브랜드 톤(연한 오렌지 배경 + 사진 아이콘)의 로컬 SVG로 대체해서
   카드/상세/캐러셀 어디서 실패해도 항상 자연스러운 모습을 유지한다. */
const EVENT_IMAGE_FALLBACK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" fill="#FFF1E6"/>
<rect x="52" y="62" width="96" height="76" rx="8" fill="none" stroke="#FF6A00" stroke-width="5" opacity="0.4"/>
<circle cx="74" cy="84" r="7" fill="#FF6A00" opacity="0.4"/>
<path d="M52 124 L82 98 L104 116 L126 92 L148 124 Z" fill="#FF6A00" opacity="0.4"/>
</svg>`;
const EVENT_IMAGE_FALLBACK_SRC = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(EVENT_IMAGE_FALLBACK_SVG);

function handleImageError(imgEl) {
  imgEl.onerror = null; // 폴백 자체가 또 실패해서 무한루프 도는 것 방지
  imgEl.src = EVENT_IMAGE_FALLBACK_SRC;
}

/* ---------- Event Dataset — Supabase(/api/events)에서 비동기로 로드 ---------- */
let EVENTS = [];
let eventsLoaded = false;

/* "🆕 신규오픈" 필터용 가상 이벤트. 실제 이벤트 스키마와 완전히 동일하게 맞췄고,
   id는 전부 "mock-"로 시작해서 실제 데이터와 절대 안 겹친다.
   실제로 "신규오픈" 태그가 붙은 이벤트가 3개 이상 쌓이면 아래에서 자동으로 안 섞인다
   (loadEventsFromApi 안의 실제 개수 체크 로직 참고). */
const MOCK_NEW_OPEN_EVENTS = [
  {
    id: "mock-newopen-cafe", category: "food", brand: "[예시] 성수 신상 카페",
    merchantType: "소상공인", isVerifiedReal: false, lat: 37.5445, lng: 127.0559,
    title: "[예시] 성수동 신규 오픈 카페", subtitle: "실제 이벤트 승인 시 자동 교체돼요",
    discount: "오픈 기념 음료 무료 증정", period: "2026.08.01 - 2026.08.31",
    periodStart: "2026-08-01", periodEnd: "2026-08-31", channel: "서울 성동구 성수동 일대",
    conditions: "", desc: "신규오픈 필터 레이아웃 확인용 예시 데이터입니다.",
    tags: ["카페", "신규오픈"], image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23E8E8EC'/%3E%3C/svg%3E",
    domain: "", link: "",
  },
  {
    id: "mock-newopen-beauty", category: "beauty", brand: "[예시] 홍대 신규 뷰티샵",
    merchantType: "브랜드", isVerifiedReal: false, lat: 37.5563, lng: 126.9236,
    title: "[예시] 홍대 신규 오픈 기념 이벤트", subtitle: "실제 이벤트 승인 시 자동 교체돼요",
    discount: "첫 방문 20% 할인", period: "2026.08.05 - 2026.08.20",
    periodStart: "2026-08-05", periodEnd: "2026-08-20", channel: "서울 마포구 홍대 일대",
    conditions: "", desc: "신규오픈 필터 레이아웃 확인용 예시 데이터입니다.",
    tags: ["뷰티", "신규오픈"], image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23E8E8EC'/%3E%3C/svg%3E",
    domain: "", link: "",
  },
  {
    id: "mock-newopen-fashion", category: "fashion", brand: "[예시] 강남 신규 편집숍",
    merchantType: "브랜드", isVerifiedReal: false, lat: 37.4979, lng: 127.0276,
    title: "[예시] 강남역 신규 오픈 매장", subtitle: "실제 이벤트 승인 시 자동 교체돼요",
    discount: "선착순 굿즈 증정", period: "2026.08.03 - 2026.08.17",
    periodStart: "2026-08-03", periodEnd: "2026-08-17", channel: "서울 강남구 강남역 일대",
    conditions: "", desc: "신규오픈 필터 레이아웃 확인용 예시 데이터입니다.",
    tags: ["패션", "신규오픈"], image: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23E8E8EC'/%3E%3C/svg%3E",
    domain: "", link: "",
  },
];

function computeDday(periodEnd) {
  if (!periodEnd) return "";
  const end = new Date(periodEnd + "T23:59:59");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Date 객체를 먼저 직접 비교해서 종료 여부를 확정한다.
  // (기존에는 diffDays < 0 으로만 판정했는데, 종료일 바로 다음날 자정 경계에서
  //  Math.ceil() 결과가 정확히 -0이 되는 부동소수점 케이스가 있었다.
  //  JS에서 -0 < 0은 false이면서 -0 === 0은 true라, 그 경우 "종료" 대신
  //  "D-Day"로 잘못 표시되고, 그 결과 종료 이벤트 제외 필터도 무력화됐다.)
  if (end < today) return "종료";
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "D-Day";
  return `D-${diffDays}`;
}

/* ---------- 스켈레톤 로딩 UI ---------- */
function renderFeedSkeleton(count = 6) {
  return Array.from({ length: count }).map(() => `
    <div class="event-card skeleton-card">
      <div class="skeleton-block skeleton-media"></div>
      <div class="card-body">
        <div class="skeleton-block skeleton-line" style="width:40%"></div>
        <div class="skeleton-block skeleton-line" style="width:80%; margin-top:8px;"></div>
        <div class="skeleton-block skeleton-line" style="width:60%; margin-top:6px;"></div>
      </div>
    </div>
  `).join("");
}

function renderRankingSkeleton(count = 5) {
  return Array.from({ length: count }).map(() => `
    <li class="rank-row skeleton-card" style="pointer-events:none;">
      <div class="skeleton-block" style="width:26px;height:26px;border-radius:50%;flex-shrink:0;"></div>
      <div class="skeleton-block" style="width:64px;height:64px;border-radius:14px;flex-shrink:0;"></div>
      <div style="flex:1;">
        <div class="skeleton-block skeleton-line" style="width:70%;margin-bottom:8px;"></div>
        <div class="skeleton-block skeleton-line" style="width:45%;"></div>
      </div>
    </li>
  `).join("");
}

async function loadEventsFromApi() {
  const grid = document.getElementById("feedGrid");
  const rankList = document.getElementById("rankingList");
  if (grid) grid.innerHTML = renderFeedSkeleton();
  if (rankList) rankList.innerHTML = renderRankingSkeleton();

  try {
    const res = await fetch("/api/events");
    if (!res.ok) throw new Error(`서버 오류 (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("잘못된 응답 형식입니다.");

    EVENTS = data
      .map(ev => ({ ...ev, dday: computeDday(ev.periodEnd) }))
      .filter(ev => ACTIVE_CATEGORY_IDS.includes(ev.category));

    // /api/events에 이미 조회수/좋아요가 포함되어 오므로, 이걸로 캐시를 초기화합니다.
    EVENTS.forEach(ev => {
      eventStatsCache[ev.id] = { views: ev.views || 0, likes: ev.likes || 0 };
    });

    eventsLoaded = true;

  } catch (err) {
    // ── 예외처리: 이벤트 로드 실패 시 안내 문구 표시 ──
    console.error("이벤트 목록 로드 오류:", err);
    EVENTS = [];
    if (grid) grid.innerHTML = `<p class="empty-state">이벤트를 불러오지 못했어요. 잠시 후 새로고침해주세요.</p>`;
  }

  // 데이터가 로드된 뒤에야 실제 화면을 그릴 수 있으므로, 초기 렌더링을 여기서 트리거합니다.
  renderCategoryTabs();
  renderRanking();
  renderFeed();
  renderHeroCarousel();
  renderNearbySection();
  renderPopupRegionBanner();

  // 공유받은 이벤트 링크(?event=id)로 들어온 경우, 자동으로 그 이벤트 시트를 열어준다.
  // (openSheet은 05-event-sheet.js에 정의되어 있지만, 이 함수가 실제로 "실행"되는 시점엔
  // 모든 스크립트가 이미 로드되어 있으므로 문제없이 호출된다)
  const sharedEventId = new URLSearchParams(location.search).get("event");
  if (sharedEventId && EVENTS.some(ev => ev.id === sharedEventId)) {
    openSheet(sharedEventId);
  }
}


/* ---------- State ---------- */
let currentCategory = "all";
let currentDiscountFilter = "all"; // "all" | "1+1" | "50plus"
let selectedBrands = new Set(); // 카테고리 탭에서만 사용되는 브랜드 로고 다중 필터
// '내 주변 인기 이벤트'는 GPS 결과에 따라 스스로 보임/숨김을 결정하는데,
// 필터 활성 시 억지로 숨겼다가 필터 해제 시 "원래 있었으면 다시 보이게" 복원하려면
// 그 원래 상태(위치 기반으로 실제 보여줄 데이터가 있었는지)를 따로 기억해둬야 함.
let nearbyHasData = false;
let endingSoonFilterActive = false; // 퀵메뉴 "종료 임박 알림" 토글 상태

document.getElementById("logoHomeBtn").addEventListener("click", () => {
  currentCategory = "all";
  selectedBrands.clear();
  endingSoonFilterActive = false;
  renderCategoryTabs();
  renderFeed();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
let gpsFilterActive = false;
let userLocation = null; // { lat, lng }
let likedEvents = new Set(JSON.parse(localStorage.getItem("eventhub-liked") || "[]"));
// 이벤트 단위 알림신청 — 브랜드 팔로우(user_follows)와는 별개 개념.
// 별도 Supabase 테이블 신설 없이, 기존 likedEvents와 동일한 로컬 저장 패턴만 재사용(MVP 최소 구조).
let notifiedEvents = new Set(JSON.parse(localStorage.getItem("eventhub-notified") || "[]"));
// 최근 본 이벤트 — 최신순 배열(중복 없음, 최대 20개), 로컬 저장만(별도 테이블 없음)
let recentlyViewed = JSON.parse(localStorage.getItem("eventhub-recent") || "[]");

// 종료된 이벤트 판별 — "발견용" 화면(홈/카테고리/AI추천/내주변/실시간인기/검색)에서 제외할 때 사용.
// 찜한 이벤트/최근 본 이벤트처럼 "내가 이미 참여·확인한 기록"을 보여주는 화면은 이 필터를 쓰지 않고
// EVENTS를 그대로 사용해서, 종료된 뒤에도 "종료" 배지와 함께 계속 조회할 수 있게 한다(의도된 동작).
function isEventLive(ev) {
  return ev.dday !== "종료";
}
let eventStatsCache = {}; // { eventId: { views, likes } } — /api/events 응답에서 초기화됨 (loadEventsFromApi 참고)

function sendEventStat(action, eventId) {
  // 실패해도 화면 동작에 영향 없는 백그라운드 요청 (fire-and-forget)
  fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, eventId }),
  }).catch(err => console.error("통계 전송 오류:", err));
}

// 카테고리/할인유형/서브태그 필터 실사용 여부 추적 (실사용자 테스트 검증용 최소 계측)
function trackFilterUse(filterKey) {
  fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "filterUse", filterKey }),
  }).catch(() => {}); // 부가 계측이라 실패해도 조용히 무시
}

function getEventScore(eventId) {
  const s = eventStatsCache[eventId] || { views: 0, likes: 0 };
  // BRD 확정 공식: 조회수×0.6 + 저장수(좋아요)×0.4
  // ⚠️ "최근 3시간 상승률" 같은 시간 감쇠는 시계열 스냅샷 테이블이 있어야 계산 가능해서
  //    이번 단계에는 포함 안 함 (다음 단계로 별도 예정)
  return s.views * 0.6 + s.likes * 0.4;
}