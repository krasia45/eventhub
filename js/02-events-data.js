/* ---------- Category Definitions ---------- */
const CATEGORIES = [
  { id: "all",     label: "전체",       emoji: "🏠" },
  { id: "fashion", label: "패션",       emoji: "👗" },
  { id: "beauty",  label: "뷰티",       emoji: "💄" },
  { id: "food",    label: "카페·디저트", emoji: "🍰" },
  { id: "popup",   label: "팝업·컬처",   emoji: "🎪" },
  { id: "living",  label: "라이프스타일", emoji: "🛋️" },
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

function computeDday(periodEnd) {
  if (!periodEnd) return "";
  const end = new Date(periodEnd + "T23:59:59");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return "종료";
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
}


/* ---------- State ---------- */
let currentCategory = "all";
let currentDiscountFilter = "all"; // "all" | "1+1" | "50plus"
let selectedBrands = new Set(); // 카테고리 탭에서만 사용되는 브랜드 로고 다중 필터
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
let eventStatsCache = {}; // { eventId: { views, likes } } — /api/events 응답에서 초기화됨 (loadEventsFromApi 참고)

function sendEventStat(action, eventId) {
  // 실패해도 화면 동작에 영향 없는 백그라운드 요청 (fire-and-forget)
  fetch("/api/stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, eventId }),
  }).catch(err => console.error("통계 전송 오류:", err));
}

function getEventScore(eventId) {
  const s = eventStatsCache[eventId] || { views: 0, likes: 0 };
  // BRD 확정 공식: 조회수×0.6 + 저장수(좋아요)×0.4
  // ⚠️ "최근 3시간 상승률" 같은 시간 감쇠는 시계열 스냅샷 테이블이 있어야 계산 가능해서
  //    이번 단계에는 포함 안 함 (다음 단계로 별도 예정)
  return s.views * 0.6 + s.likes * 0.4;
}