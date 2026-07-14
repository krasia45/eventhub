/* =========================================================
   EventHub Prototype — main.js
   (백엔드: Supabase 기반 /api/events, /api/stats, /api/inquiries.
    Google Sheets/Apps Script는 더 이상 사용하지 않습니다.)
   ========================================================= */

/* 카카오맵 JavaScript 키 — Kakao Developers에서 발급, 배포 도메인 등록 필요 */
const KAKAO_JS_KEY = "2a4211503ca5201a29e348b22957fba4";

/* Supabase 클라이언트 (로그인/회원 데이터용) — anon key는 공개용 키라 노출돼도 안전합니다.
   실제 데이터 보호는 서버가 아니라 RLS(Row Level Security) 정책이 담당합니다.
   ⚠️ 아래 두 값을 실제 Supabase 프로젝트 값으로 바꿔주세요. */
const SUPABASE_URL = "https://czcpjgjyvxymhqziizgq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_44ho1osigeeuv_yq6zsTjg_pSlMexzl";

// ── 안전장치: 이 초기화가 실패해도(값을 아직 안 채웠거나 SDK 로드 실패 등)
//    사이트의 나머지 기능(탭, 이벤트 목록 등)은 절대 멈추지 않도록 try/catch로 감쌉니다.
//    로그인 관련 기능만 비활성화되고, 나머지는 정상 작동합니다.
let supabaseClient = null;
try {
  if (SUPABASE_URL.startsWith("http") && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.warn("Supabase 설정이 비어있어 로그인 기능이 비활성화됩니다. SUPABASE_URL/SUPABASE_ANON_KEY를 확인하세요.");
  }
} catch (err) {
  console.error("Supabase 클라이언트 초기화 실패:", err);
}

let currentUser = null; // 로그인한 사용자 (없으면 null)

let kakaoMapSdkPromise = null;
function loadKakaoMapSdk() {
  if (kakaoMapSdkPromise) return kakaoMapSdkPromise;
  kakaoMapSdkPromise = new Promise((resolve, reject) => {
    if (window.kakao && window.kakao.maps) { resolve(); return; }
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false`;
    script.onload = () => window.kakao.maps.load(resolve);
    script.onerror = () => reject(new Error("카카오맵 SDK 로드 실패"));
    document.head.appendChild(script);
  });
  return kakaoMapSdkPromise;
}

/* ---------- 카카오톡 공유 (일반 Kakao JS SDK, 지도 SDK와는 별개) ---------- */
let kakaoShareSdkPromise = null;
function loadKakaoShareSdk() {
  if (kakaoShareSdkPromise) return kakaoShareSdkPromise;
  kakaoShareSdkPromise = new Promise((resolve, reject) => {
    if (window.Kakao && window.Kakao.isInitialized && window.Kakao.isInitialized()) { resolve(); return; }
    const script = document.createElement("script");
    script.src = "https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js";
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (!window.Kakao.isInitialized()) window.Kakao.init(KAKAO_JS_KEY);
      resolve();
    };
    script.onerror = () => reject(new Error("카카오 공유 SDK 로드 실패"));
    document.head.appendChild(script);
  });
  return kakaoShareSdkPromise;
}

async function shareToKakao(ev, shareUrl) {
  await loadKakaoShareSdk();
  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `${ev.brand} · ${ev.title}`,
      description: `${ev.discount} · ${ev.period}`,
      imageUrl: ev.image,
      link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
    },
    buttons: [{ title: "이벤트 보러가기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
  });
}

/* ---------- 공유하기: 인스타그램/페이스북/X(트위터)/카카오톡 4개만 선택지로 제공 ---------- */
function openShareFlow(ev) {
  const shareUrl = window.location.href;
  openShareMenu(ev, shareUrl);
}

function openShareMenu(ev, shareUrl) {
  const grid = document.getElementById("sharePlatformGrid");
  const platforms = [
    { id: "instagram", label: "인스타그램", emoji: "📸", bg: "linear-gradient(45deg,#F58529,#DD2A7B,#8134AF)", color: "#fff" },
    { id: "facebook", label: "페이스북", emoji: "📘", bg: "#1877F2", color: "#fff" },
    { id: "x", label: "X(트위터)", emoji: "𝕏", bg: "#000", color: "#fff" },
    { id: "kakao", label: "카카오톡", emoji: "💬", bg: "#FEE500", color: "#191919" },
  ];

  grid.innerHTML = platforms.map(p => `
    <button type="button" class="share-platform-btn" data-platform="${p.id}" style="background:${p.bg}; color:${p.color};">
      <span class="share-platform-emoji">${p.emoji}</span>
      <span>${p.label}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".share-platform-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const platform = btn.dataset.platform;
      const text = encodeURIComponent(`${ev.brand} · ${ev.title} — ${ev.discount}`);
      const url = encodeURIComponent(shareUrl);

      if (platform === "kakao") {
        try { await shareToKakao(ev, shareUrl); }
        catch { showToast("카카오톡 공유를 불러오지 못했어요."); }
      } else if (platform === "facebook") {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank", "noopener,noreferrer");
      } else if (platform === "x") {
        window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank", "noopener,noreferrer");
      } else if (platform === "instagram") {
        // 인스타그램은 피드/스토리에 외부 링크를 직접 공유하는 웹 API를 제공하지 않아
        // (게시물 작성은 앱에서만 가능), 링크를 복사해서 스토리/DM에 직접 붙여넣도록 안내합니다.
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast("링크가 복사됐어요! 인스타그램 스토리·DM에 붙여넣어 공유해보세요 📸");
        } catch { showToast(`링크: ${shareUrl}`); }
      }

      document.getElementById("shareMenuOverlay").classList.remove("open");
    });
  });

  document.getElementById("shareMenuOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

document.getElementById("shareMenuClose").addEventListener("click", () => {
  document.getElementById("shareMenuOverlay").classList.remove("open");
});
document.getElementById("shareMenuOverlay").addEventListener("click", (e) => {
  if (e.target.id === "shareMenuOverlay") document.getElementById("shareMenuOverlay").classList.remove("open");
});

async function renderEventMap(ev) {
  const mapEl = document.getElementById("kakaoMap");
  mapEl.innerHTML = `<div class="map-status">지도를 불러오는 중...</div>`;

  try {
    await loadKakaoMapSdk();
    mapEl.innerHTML = "";

    const center = new kakao.maps.LatLng(ev.lat, ev.lng);
    const map = new kakao.maps.Map(mapEl, { center, level: 6 });

    new kakao.maps.Marker({ position: center, map });

    // 위치 권한을 이미 허용한 상태라면(GPS 필터 사용 시) 내 위치 ↔ 이벤트 위치 직선을 함께 표시.
    // 실제 도보/차량 경로는 아래 "카카오맵에서 실제 길찾기" 버튼으로 안내합니다.
    if (userLocation) {
      const userPos = new kakao.maps.LatLng(userLocation.lat, userLocation.lng);
      new kakao.maps.Marker({
        position: userPos,
        map,
        image: new kakao.maps.MarkerImage(
          "https://t1.daumcdn.net/mapjsapi/images/marker.png",
          new kakao.maps.Size(24, 35)
        ),
      });

      new kakao.maps.Polyline({
        map,
        path: [userPos, center],
        strokeWeight: 3,
        strokeColor: "#FF6F00",
        strokeOpacity: 0.75,
        strokeStyle: "dashed",
      });

      const bounds = new kakao.maps.LatLngBounds();
      bounds.extend(userPos);
      bounds.extend(center);
      map.setBounds(bounds);
    }
  } catch (err) {
    // ── 예외처리: 지도 SDK 로드 실패(도메인 미등록 등) ──
    console.error("카카오맵 로드 오류:", err);
    mapEl.innerHTML = `<div class="map-status map-error">지도를 불러오지 못했어요. 카카오 개발자 콘솔에서 이 도메인이 등록되어 있는지 확인해주세요.</div>`;
  }
}

function getKakaoRouteLink(ev) {
  // 카카오맵 딥링크: API 키 없이도 동작하는 무료 길찾기 링크 (실제 도보/차량 경로 안내는 카카오맵이 처리)
  const to = `${encodeURIComponent(ev.brand)},${ev.lat},${ev.lng}`;
  if (userLocation) {
    const from = `${encodeURIComponent("내 위치")},${userLocation.lat},${userLocation.lng}`;
    return `https://map.kakao.com/link/from/${from}/to/${to}`;
  }
  return `https://map.kakao.com/link/to/${to}`;
}

function getNaverMapLink(ev) {
  // 네이버지도 검색 링크 (좌표+브랜드명 기반)
  return `https://map.naver.com/p/search/${encodeURIComponent(ev.brand + " " + ev.title)}`;
}

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
    <li class="rank-card skeleton-card">
      <div class="skeleton-block skeleton-media"></div>
      <div class="rank-card-body">
        <div class="skeleton-block" style="width:26px;height:26px;border-radius:50%;"></div>
        <div class="skeleton-block skeleton-line" style="width:70%;"></div>
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

/* ---------- 날씨 위젯 ---------- */
const DEFAULT_WEATHER_LOCATION = { lat: 37.5665, lng: 126.9780 }; // 서울시청 기준

function getQuietLocation() {
  // GPS 필터처럼 명시적 버튼 클릭 없이, 이미 허용된 위치 권한이 있으면 사용하고
  // 없거나 거부되면 서울 기준으로 조용히 대체합니다.
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(DEFAULT_WEATHER_LOCATION); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(DEFAULT_WEATHER_LOCATION),
      { timeout: 5000 }
    );
  });
}

async function loadWeather(loc) {
  const iconEl = document.getElementById("weatherIcon");
  const summaryEl = document.getElementById("weatherSummary");
  const subEl = document.getElementById("weatherSub");
  const headerIconEl = document.getElementById("weatherHeaderIcon");
  const headerTempEl = document.getElementById("weatherHeaderTemp");

  const target = loc || await getQuietLocation();

  try {
    const res = await fetch(`/api/weather?lat=${target.lat}&lng=${target.lng}`);
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error || "날씨 조회 실패");

    iconEl.textContent = data.icon || "🌤";
    summaryEl.textContent = `${data.location} 현재 ${data.tempC}°C, ${data.description}`;
    subEl.textContent = data.advice || "";
    headerIconEl.textContent = data.icon || "🌤";
    headerTempEl.textContent = `${data.tempC}°`;

  } catch (err) {
    // ── 예외처리: 날씨 API 실패 시 Fallback UI ──────────
    console.error("날씨 조회 오류:", err);
    iconEl.textContent = "⚠️";
    summaryEl.textContent = "날씨 정보를 불러오지 못했어요.";
    subEl.textContent = "잠시 후 다시 시도해주세요.";
    headerIconEl.textContent = "⚠️";
    headerTempEl.textContent = "";
  }
}

document.getElementById("weatherHeaderChip").addEventListener("click", () => {
  const popover = document.getElementById("weatherPopover");
  popover.hidden = !popover.hidden;
});
document.addEventListener("click", (e) => {
  const popover = document.getElementById("weatherPopover");
  if (!popover.hidden && !e.target.closest(".weather-popover") && !e.target.closest("#weatherHeaderChip")) {
    popover.hidden = true;
  }
});

/* ---------- 거리 계산 (Haversine) & GPS 20km 필터 ---------- */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // 지구 반지름(km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesDiscountFilter(ev, filter) {
  if (filter === "all") return true;
  if (filter === "1+1") return ev.discount.includes("1+1");
  if (filter === "50plus") {
    const match = ev.discount.match(/(\d+)\s*%/);
    return !!match && parseInt(match[1], 10) >= 50;
  }
  return true;
}

/* 카테고리 + 할인유형 + GPS(선택) 필터를 모두 적용한 이벤트 목록 */
function getFilteredEvents() {
  let list = currentCategory === "all"
    ? EVENTS
    : EVENTS.filter(ev => ev.category === currentCategory);

  if (selectedBrands.size > 0) {
    list = list.filter(ev => selectedBrands.has(ev.brand));
  }

  list = list.filter(ev => matchesDiscountFilter(ev, currentDiscountFilter));

  if (gpsFilterActive && userLocation) {
    list = list.filter(ev => haversineDistanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng) <= 20);
  }

  if (endingSoonFilterActive) {
    list = [...list].sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
  }

  return list;
}

/* ---------- GPS 20km 필터 토글 ---------- */
function toggleGpsFilter() {
  const btn = document.getElementById("gpsFilterChip");

  if (gpsFilterActive) {
    gpsFilterActive = false;
    btn.classList.remove("active");
    btn.textContent = "📍 내 주변 20km";
    renderFeed();
    renderRanking();
    return;
  }

  if (!navigator.geolocation) {
    showToast("이 브라우저는 위치 정보를 지원하지 않아요.");
    return;
  }

  btn.textContent = "📍 위치 확인 중...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gpsFilterActive = true;
      btn.classList.add("active");
      btn.textContent = "📍 내 주변 20km ✓";
      renderFeed();
      renderRanking();
      loadWeather(userLocation);
    },
    (err) => {
      console.error("위치 정보 오류:", err);
      btn.textContent = "📍 내 주변 20km";
      if (err.code === err.PERMISSION_DENIED) {
        showToast("위치 권한이 거부되어 전체 이벤트를 표시할게요.");
      } else {
        showToast("위치 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    },
    { timeout: 8000 }
  );
}

/* ---------- Real Brand Logo Helper ----------
   Fetches each brand's actual logo straight from their real company domain
   using Hunter's free Logo API (https://logos.hunter.io/{domain}) — a
   no-key, no-signup service that returns each company's real logo image.
   (Note: Clearbit's old logo.clearbit.com API, commonly used for this,
   was permanently shut down in Dec 2025 — this is its direct successor.)

   Because logo availability can vary per domain, attachLogoFallback wires
   up a 2-step safety net so the layout never breaks:
     1) Hunter logo API (real logo)
     2) Google's favicon service for that domain (real site icon)
     3) A clean initials badge, generated from the brand name, as a last resort */
function getLogoUrl(domain) {
  return `https://logos.hunter.io/${domain}`;
}

function getFaviconFallbackUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function attachLogoFallback(imgEl, brandName, domain) {
  imgEl.addEventListener("error", () => {
    const stage = imgEl.dataset.fallbackStage || "0";
    if (stage === "0" && domain) {
      imgEl.dataset.fallbackStage = "1";
      imgEl.src = getFaviconFallbackUrl(domain);
    } else {
      const initial = brandName.trim().charAt(0).toUpperCase();
      imgEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=FF6F00&color=fff&bold=true&size=128`;
    }
  });
}

/* ---------- Utilities ---------- */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function getCategoryLabel(id) {
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? cat.label : "";
}

/* ---------- Render: Category Tabs ---------- */
function renderCategoryTabs() {
  const nav = document.getElementById("categoryTabs");
  nav.innerHTML = CATEGORIES.map(cat => `
    <button class="tab-pill ${cat.id === currentCategory ? "active" : ""}" data-cat="${cat.id}">
      <span class="tab-emoji">${cat.emoji}</span>${cat.label}
    </button>
  `).join("");

  nav.querySelectorAll(".tab-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.cat;
      selectedBrands.clear(); // 카테고리 바뀌면 이전 카테고리의 브랜드 선택은 초기화
      renderCategoryTabs();
      renderBrandFilter();
      renderFeed();
      renderRanking();
    });
  });

  renderBrandFilter();
}

/* ---------- Render: 브랜드 로고 필터 (전체 탭에서는 숨김, 카테고리 탭에서만 노출) ---------- */
function renderBrandFilter() {
  const wrap = document.getElementById("brandFilterRow");
  // 요청에 따라 브랜드 로고 필터 줄 자체를 제거함 (참고 디자인이 더 깔끔한 필터만 쓰는 걸 선호)
  wrap.hidden = true;
  wrap.innerHTML = "";
}

/* ---------- Discount Quick Filters (1+1 / 50%+) ---------- */
function bindDiscountTabs() {
  const wrap = document.getElementById("discountTabs");
  wrap.querySelectorAll(".discount-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      currentDiscountFilter = btn.dataset.discount;
      wrap.querySelectorAll(".discount-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderFeed();
      renderRanking();
    });
  });
}

document.getElementById("gpsFilterChip").addEventListener("click", toggleGpsFilter);

/* ---------- Render: Ranking (조회수·좋아요 기반 실제 랭킹, 카테고리별) ---------- */
function renderRanking() {
  const list = document.getElementById("rankingList");
  const titleEl = document.getElementById("rankingTitle");

  const pool = getFilteredEvents();

  titleEl.textContent = currentCategory === "all"
    ? "🔥 실시간 인기 이벤트"
    : `🔥 ${getCategoryLabel(currentCategory)} 인기 이벤트`;

  if (pool.length === 0) {
    list.innerHTML = `<li class="empty-state">아직 랭킹에 표시할 이벤트가 없어요.</li>`;
    return;
  }

  // 좋아요*3 + 조회수 점수로 정렬. 아직 통계가 없으면(전부 0점) 데모 노출을 위해 무작위 섞기.
  const hasAnyStats = Object.keys(eventStatsCache).length > 0;
  const sorted = hasAnyStats
    ? [...pool].sort((a, b) => getEventScore(b.id) - getEventScore(a.id))
    : shuffleArray(pool);

  const rankedEvents = sorted.slice(0, 5);

  list.innerHTML = rankedEvents.map((ev, idx) => `
    <li class="rank-card" data-id="${ev.id}">
      <span class="rank-badge">${idx + 1}</span>
      <div class="rank-card-media">
        <img class="rank-card-photo" src="${ev.image}" alt="${ev.title}" loading="lazy">
        <span class="rank-card-discount">${ev.discount}</span>
      </div>
      <div class="rank-card-body">
        <img class="rank-card-logo" data-domain="${ev.domain}" data-brand="${ev.brand}" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고">
        <div class="rank-card-info">
          <p class="rank-card-brand">${ev.brand}</p>
          <p class="rank-card-title">${ev.title}</p>
        </div>
      </div>
    </li>
  `).join("");

  list.querySelectorAll(".rank-card").forEach(item => {
    item.addEventListener("click", () => openSheet(item.dataset.id));
  });

  list.querySelectorAll(".rank-card-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}

/* ---------- Render: Feed Grid ---------- */
function renderFeed() {
  const grid = document.getElementById("feedGrid");
  const title = document.getElementById("feedTitle");
  const count = document.getElementById("feedCount");

  const filtered = getFilteredEvents();

  title.textContent = currentCategory === "all" ? "전체 이벤트" : `${getCategoryLabel(currentCategory)} 이벤트`;
  count.textContent = `${filtered.length}개`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">아직 등록된 이벤트가 없어요.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(ev => {
    const distanceLabel = (gpsFilterActive && userLocation)
      ? `<span class="card-distance">${haversineDistanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng).toFixed(1)}km</span>`
      : "";
    const merchantBadge = ev.merchantType === "소상공인"
      ? `<span class="card-merchant-badge">소상공인</span>`
      : "";
    const verifiedBadge = ev.isVerifiedReal
      ? `<span class="card-verified-badge">✓ 실제 진행중</span>`
      : "";
    return `
    <div class="event-card" data-id="${ev.id}">
      <div class="card-media">
        <img class="card-photo" src="${ev.image}" alt="${ev.title}" loading="lazy">
        <button class="card-like-btn ${likedEvents.has(ev.id) ? "liked" : ""}" data-id="${ev.id}" aria-label="관심 이벤트로 등록">
          <span class="card-like-icon">${likedEvents.has(ev.id) ? "❤️" : "🤍"}</span>
        </button>
        <span class="card-logo-badge">
          <img data-domain="${ev.domain}" data-brand="${ev.brand}" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고">
        </span>
        <span class="card-discount">${ev.discount}</span>
        <span class="card-dday">${ev.dday}</span>
        ${distanceLabel}
      </div>
      <div class="card-body">
        <p class="card-brand-name">${ev.brand} ${merchantBadge}</p>
        ${verifiedBadge}
        <p class="card-title">${ev.title}</p>
        <p class="card-sub">${ev.subtitle}</p>
        <p class="card-meta">📍 ${ev.channel}</p>
        <div class="card-stats">
          <span>👁 ${formatCount((eventStatsCache[ev.id] || {}).views || 0)}</span>
          <span class="stat-heart">❤️ ${formatCount((eventStatsCache[ev.id] || {}).likes || 0)}</span>
        </div>
      </div>
    </div>
  `;
  }).join("");

  grid.querySelectorAll(".event-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });

  grid.querySelectorAll(".card-like-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // 카드 클릭(상세 열기)으로 전파되지 않도록 방지
      toggleLike(btn.dataset.id);
    });
  });

  grid.querySelectorAll(".card-logo-badge img").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}

/* ---------- Bottom Sheet Modal ---------- */
const sheetOverlay = document.getElementById("sheetOverlay");
let activeEventId = null;

function openSheet(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  activeEventId = eventId;

  document.getElementById("sheetImage").src = ev.image;
  document.getElementById("sheetImage").alt = ev.title;
  const sheetLogoEl = document.getElementById("sheetBrandLogo");
  sheetLogoEl.src = getLogoUrl(ev.domain);
  sheetLogoEl.alt = `${ev.brand} 로고`;
  attachLogoFallback(sheetLogoEl, ev.brand, ev.domain);
  document.getElementById("sheetSubtitle").textContent = `${ev.brand} · ${getCategoryLabel(ev.category)}`;
  document.getElementById("sheetTitle").textContent = ev.title;
  document.getElementById("sheetDiscount").textContent = ev.discount;
  document.getElementById("sheetDiscountRow").textContent = ev.discount;
  document.getElementById("sheetPeriod").textContent = ev.period;
  document.getElementById("sheetDesc").textContent = ev.desc;

  // D-day 배지 (이미지 우측 상단)
  document.getElementById("sheetDdayBadge").textContent = ev.dday || "";

  // 참여방법: 텍스트에 줄바꿈이 있으면 번호 목록으로, 없으면 그냥 한 줄로 표시
  const channelEl = document.getElementById("sheetChannel");
  const channelLines = (ev.channel || "").split("\n").map(s => s.trim()).filter(Boolean);
  if (channelLines.length > 1) {
    channelEl.innerHTML = `<ol class="channel-steps">${channelLines.map(line => `<li>${line}</li>`).join("")}</ol>`;
  } else {
    channelEl.textContent = ev.channel;
  }

  // 이미지 위 태그 칩 (참고 디자인처럼 이미지 하단에 오버레이)
  document.getElementById("sheetHeroTags").innerHTML = ev.tags.slice(0, 3).map((t, i) =>
    `<span class="hero-tag-chip ${i === 0 ? "hero-tag-primary" : ""}">${t}</span>`
  ).join("");

  // 조건(예: "네이버페이 결제 시에만 적용") — 값이 있을 때만 노출
  const conditionsRow = document.getElementById("sheetConditionsRow");
  if (ev.conditions && ev.conditions.trim()) {
    conditionsRow.hidden = false;
    document.getElementById("sheetConditions").textContent = ev.conditions;
  } else {
    conditionsRow.hidden = true;
  }

  // 대상(예: "신규 가입자 한정") — 값이 있을 때만 노출
  const targetRow = document.getElementById("sheetTargetRow");
  if (ev.targetAudience && ev.targetAudience.trim()) {
    targetRow.hidden = false;
    document.getElementById("sheetTarget").textContent = ev.targetAudience;
  } else {
    targetRow.hidden = true;
  }

  const verifiedNote = document.getElementById("sheetVerifiedNote");
  if (verifiedNote) verifiedNote.hidden = !ev.isVerifiedReal;

  const isPopup = ev.category === "popup";

  // 지도/길찾기는 "실제로 찾아가는 장소"인 팝업스토어에서만 의미가 있어 그 카테고리에서만 노출
  const mapSection = document.getElementById("mapSection");
  const routeBtn = document.getElementById("kakaoRouteBtn");
  const iconActions = document.getElementById("sheetIconActions");

  if (isPopup) {
    mapSection.hidden = false;
    routeBtn.hidden = false;
    iconActions.classList.remove("three-col");
    routeBtn.href = getKakaoRouteLink(ev);
    renderEventMap(ev);

    document.getElementById("locationAddress").textContent = ev.title;
    document.getElementById("locationSub").textContent = `${ev.channel.split("\n")[0]}`;
    document.getElementById("locationRouteBtn").href = getKakaoRouteLink(ev);
    document.getElementById("locationNaverBtn").href = getNaverMapLink(ev);
    document.getElementById("locationKakaoBtn").href = getKakaoRouteLink(ev);
  } else {
    mapSection.hidden = true;
    routeBtn.hidden = true;
    iconActions.classList.add("three-col");
  }

  // 하단 고정 CTA: 팝업 → 길찾기+공유 / 그 외 → 브랜드사이트이동+공유 (참고 디자인 반영)
  const primaryBtn = document.getElementById("stickyCtaPrimaryBtn");
  if (isPopup) {
    document.getElementById("stickyCtaPrimaryIcon").textContent = "🗺";
    document.getElementById("stickyCtaPrimaryLabel").textContent = "길찾기";
    primaryBtn.href = getKakaoRouteLink(ev);
    primaryBtn.target = "_blank";
  } else {
    document.getElementById("stickyCtaPrimaryIcon").textContent = "🔗";
    document.getElementById("stickyCtaPrimaryLabel").textContent = "브랜드 사이트 이동";
    primaryBtn.href = ev.link;
    primaryBtn.target = "_blank";
  }

  updateLikeButton();
  renderBrandFollowButton(ev);

  // 조회수 집계 (백그라운드로 전송, 화면 동작 차단 안 함)
  eventStatsCache[eventId] = eventStatsCache[eventId] || { views: 0, likes: 0 };
  eventStatsCache[eventId].views += 1;
  sendEventStat("trackView", eventId);

  sheetOverlay.classList.add("open");
  document.body.style.overflow = "hidden";

  // "다녀왔어요" 후기는 실제로 방문하는 장소(팝업스토어)에만 의미가 있음.
  // 단순 할인 정보성 이벤트(패션/뷰티/카페 쿠폰 등)는 "방문"이라는 행위 자체가 없어서 숨김.
  const visitSection = document.getElementById("visitSection");
  if (isPopup) {
    visitSection.hidden = false;
    loadEventVisits(eventId);
  } else {
    visitSection.hidden = true;
  }
}

function closeSheet() {
  sheetOverlay.classList.remove("open");
  document.body.style.overflow = "";
  activeEventId = null;
}

function updateLikeButton() {
  const likeBtn = document.getElementById("likeBtn");
  const likeIcon = document.getElementById("likeIcon");
  const isLiked = likedEvents.has(activeEventId);

  likeBtn.classList.toggle("liked", isLiked);
  likeBtn.setAttribute("aria-label", isLiked ? "관심 이벤트에서 삭제" : "관심 이벤트로 등록");
  likeIcon.textContent = isLiked ? "❤️" : "🤍";

  // 카드 그리드에 노출된 동일 이벤트의 하트 아이콘도 함께 동기화
  document.querySelectorAll(`.card-like-btn[data-id="${activeEventId}"] .card-like-icon`).forEach(el => {
    el.textContent = isLiked ? "❤️" : "🤍";
  });
  document.querySelectorAll(`.card-like-btn[data-id="${activeEventId}"]`).forEach(el => {
    el.classList.toggle("liked", isLiked);
  });
}

/* ---------- 다녀왔어요 / 한줄평 (소셜 증거) ---------- */
async function renderBrandFollowButton(ev) {
  const btn = document.getElementById("brandFollowBtn");
  document.getElementById("brandFollowBox").querySelector(".brand-follow-text").textContent =
    `${ev.brand}을(를) 팔로우하고 새로운 이벤트 알림을 받아보세요`;

  if (!currentUser || !supabaseClient) {
    btn.textContent = "+ 팔로우";
    btn.classList.remove("following");
    btn.onclick = () => showToast("로그인하시면 브랜드를 팔로우할 수 있어요.");
    return;
  }

  let isFollowing = false;
  try {
    const { data } = await supabaseClient
      .from("user_follows")
      .select("brand")
      .eq("user_id", currentUser.id)
      .eq("brand", ev.brand)
      .maybeSingle();
    isFollowing = !!data;
  } catch (err) {
    console.error("팔로우 상태 조회 오류:", err);
  }

  updateFollowBtnUI(btn, isFollowing);

  btn.onclick = async () => {
    if (isFollowing) {
      const { error } = await supabaseClient.from("user_follows").delete().eq("user_id", currentUser.id).eq("brand", ev.brand);
      if (error) { showToast("팔로우 해제 중 오류가 발생했어요."); return; }
      isFollowing = false;
      showToast(`${ev.brand} 팔로우를 해제했어요`);
    } else {
      const { error } = await supabaseClient.from("user_follows").insert({ user_id: currentUser.id, brand: ev.brand });
      if (error) { showToast("팔로우 중 오류가 발생했어요."); return; }
      isFollowing = true;
      showToast(`${ev.brand}을(를) 팔로우했어요! 🔔`);
    }
    updateFollowBtnUI(btn, isFollowing);
  };
}

function updateFollowBtnUI(btn, isFollowing) {
  btn.textContent = isFollowing ? "✓ 팔로잉" : "+ 팔로우";
  btn.classList.toggle("following", isFollowing);
}

async function loadEventVisits(eventId) {
  const listEl = document.getElementById("visitCommentList");
  const countEl = document.getElementById("visitCount");
  const loginNotice = document.getElementById("visitLoginNotice");
  const formEl = document.getElementById("visitForm");

  loginNotice.hidden = !!currentUser;
  formEl.hidden = !currentUser;

  if (!supabaseClient) {
    listEl.innerHTML = "";
    countEl.textContent = "";
    return;
  }

  try {
    const { data } = await supabaseClient
      .from("event_visits")
      .select("comment, visited_at")
      .eq("event_id", eventId)
      .order("visited_at", { ascending: false })
      .limit(10);

    const visits = data || [];
    countEl.textContent = visits.length > 0 ? `(${visits.length}건)` : "";

    const withComments = visits.filter(v => v.comment && v.comment.trim());
    listEl.innerHTML = withComments.length === 0
      ? `<li class="empty-state">아직 한줄평이 없어요. 첫 방문 후기를 남겨보세요!</li>`
      : withComments.map(v => `
          <li class="visit-comment-item">
            ${v.comment}
            <div class="visit-comment-time">${new Date(v.visited_at).toLocaleDateString("ko-KR")}</div>
          </li>
        `).join("");

  } catch (err) {
    console.error("방문 기록 로드 오류:", err);
    listEl.innerHTML = "";
  }
}

document.getElementById("visitSubmitBtn").addEventListener("click", async () => {
  if (!supabaseClient || !currentUser || !activeEventId) {
    showToast("로그인 후 이용할 수 있어요.");
    return;
  }

  const comment = document.getElementById("visitComment").value.trim();
  const btn = document.getElementById("visitSubmitBtn");
  btn.disabled = true;

  try {
    const { error } = await supabaseClient.from("event_visits").upsert({
      user_id: currentUser.id,
      event_id: activeEventId,
      comment: comment || null,
    }, { onConflict: "user_id,event_id" });

    if (error) throw error;

    showToast("방문 인증 완료! 감사해요 🙌");
    document.getElementById("visitComment").value = "";
    loadEventVisits(activeEventId);

  } catch (err) {
    console.error("다녀왔어요 등록 오류:", err);
    showToast("등록 중 오류가 발생했어요.");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("sheetClose").addEventListener("click", closeSheet);
sheetOverlay.addEventListener("click", (e) => {
  if (e.target === sheetOverlay) closeSheet();
});

function toggleLike(eventId) {
  eventStatsCache[eventId] = eventStatsCache[eventId] || { views: 0, likes: 0 };
  const nowLiked = !likedEvents.has(eventId);

  if (!nowLiked) {
    likedEvents.delete(eventId);
    eventStatsCache[eventId].likes = Math.max(0, eventStatsCache[eventId].likes - 1);
    sendEventStat("unlike", eventId);
    showToast("관심 이벤트에서 삭제되었습니다");
  } else {
    likedEvents.add(eventId);
    eventStatsCache[eventId].likes += 1;
    sendEventStat("like", eventId);
    showToast("관심 이벤트로 등록되었습니다 ❤");
  }

  localStorage.setItem("eventhub-liked", JSON.stringify([...likedEvents]));

  // 로그인 상태라면 기기와 무관하게 유지되도록 user_saves 테이블에도 반영
  if (currentUser) {
    const query = nowLiked
      ? supabaseClient.from("user_saves").upsert({ user_id: currentUser.id, event_id: eventId }, { onConflict: "user_id,event_id" })
      : supabaseClient.from("user_saves").delete().eq("user_id", currentUser.id).eq("event_id", eventId);
    query.then(({ error }) => { if (error) console.error("찜 동기화 오류:", error); });
  }

  // 카드 그리드의 하트 아이콘 동기화
  document.querySelectorAll(`.card-like-btn[data-id="${eventId}"]`).forEach(btn => {
    const isLiked = likedEvents.has(eventId);
    btn.classList.toggle("liked", isLiked);
    btn.querySelector(".card-like-icon").textContent = isLiked ? "❤️" : "🤍";
  });

  // 상세 시트가 같은 이벤트를 보고 있다면 그쪽 하트도 동기화
  if (activeEventId === eventId) updateLikeButton();

  renderRanking(); // 좋아요 반영된 최신 랭킹으로 갱신
}

document.getElementById("likeBtn").addEventListener("click", () => {
  if (!activeEventId) return;
  toggleLike(activeEventId);
});

document.getElementById("stickyCtaShareBtn").addEventListener("click", () => {
  const ev = EVENTS.find(e => e.id === activeEventId);
  if (!ev) return;
  openShareFlow(ev);
});

/* ---------- 캘린더 등록 (구글 캘린더 바로가기 링크) ---------- */
function parsePeriodToGCalDates(period) {
  // "2026.05.28 - 2026.06.22" → { start: "20260528", end: "20260623" }
  // (구글 캘린더 종료일은 배타적이라 실제 종료일 다음날로 +1일 처리)
  const parts = period.split("-").map(s => s.trim());
  if (parts.length !== 2) return null;

  const parseDatePart = (str) => {
    const m = str.match(/(\d{4})\.(\d{2})\.(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  const startDate = parseDatePart(parts[0]);
  const endDateRaw = parseDatePart(parts[1]);
  if (!startDate || !endDateRaw) return null;

  const endDate = new Date(endDateRaw);
  endDate.setDate(endDate.getDate() + 1);

  const fmt = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return { start: fmt(startDate), end: fmt(endDate) };
}

document.getElementById("calendarBtn").addEventListener("click", () => {
  const ev = EVENTS.find(e => e.id === activeEventId);
  if (!ev) return;

  const dates = parsePeriodToGCalDates(ev.period);
  if (!dates) {
    showToast("일정 등록 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    return;
  }

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `[EventHub] ${ev.brand} - ${ev.title}`,
    dates: `${dates.start}/${dates.end}`,
    details: `${ev.desc}\n\n혜택: ${ev.discount}\n참여 방법: ${ev.channel}\n\n${ev.link}`,
  });

  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank", "noopener,noreferrer");
});

document.getElementById("shareBtn").addEventListener("click", () => {
  const ev = EVENTS.find(e => e.id === activeEventId);
  if (!ev) return;
  openShareFlow(ev);
});

/* ---------- AI 추천 피드 (검색 없이 로그인 키워드 기반으로 상시 노출) ---------- */
let aiFeedExpanded = false; // "더보기" 눌러서 로컬 매칭으로 카드를 더 보여준 상태인지

async function loadAiFeed(keywords) {
  const grid = document.getElementById("aiFeedGrid");
  aiFeedExpanded = false;

  if (!keywords || keywords.length === 0) {
    renderAiFeedSetupPrompt();
    return;
  }

  if (EVENTS.length === 0) { grid.innerHTML = renderFeedSkeleton(3); return; }

  grid.innerHTML = renderFeedSkeleton(3);

  try {
    const eventsSummary = EVENTS.map(ev => ({
      id: ev.id, brand: ev.brand, category: ev.category,
      title: ev.title, tags: ev.tags, discount: ev.discount
    }));

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interest: keywords.join(", "), events: eventsSummary }),
    });
    const data = await res.json();

    if (!res.ok || data.error || !Array.isArray(data.ids) || data.ids.length === 0) {
      renderAiFeedFallback(keywords);
      return;
    }

    const matched = data.ids.map(id => EVENTS.find(ev => ev.id === id)).filter(Boolean);
    if (matched.length === 0) { renderAiFeedFallback(keywords); return; }
    renderAiFeedCards(matched);

  } catch (err) {
    console.error("AI 추천 피드 로드 오류:", err);
    renderAiFeedFallback(keywords);
  }
}

// AI 호출이 실패하거나 결과가 없을 때: 키워드가 태그/제목에 실제로 매칭되는 진짜 이벤트로 대체
// (AI가 안 되더라도 화면이 비지 않게 하면서, 없는 데이터를 지어내지는 않음)
function renderAiFeedFallback(keywords) {
  const kwLower = (keywords || []).map(k => k.toLowerCase());
  let candidates = EVENTS.filter(ev =>
    kwLower.some(kw => ev.tags.some(t => t.toLowerCase().includes(kw)) || ev.title.toLowerCase().includes(kw))
  );
  if (candidates.length === 0) {
    candidates = [...EVENTS].sort((a, b) => getEventScore(b.id) - getEventScore(a.id));
  }
  renderAiFeedCards(candidates.slice(0, 3));
}

function renderAiFeedSetupPrompt() {
  const grid = document.getElementById("aiFeedGrid");
  grid.innerHTML = `
    <div class="ai-feed-setup-card">
      <span class="ai-feed-setup-emoji">🤖</span>
      <p class="ai-feed-setup-title">AI 맞춤 추천을 받아보세요</p>
      <p class="ai-feed-setup-sub">관심 키워드를 설정하면 취향에 맞는 이벤트를 바로 보여드려요.</p>
      <button type="button" class="ai-btn" id="aiFeedSetupBtn">설정하기</button>
    </div>
  `;
  const setupBtn = document.getElementById("aiFeedSetupBtn");
  setupBtn.addEventListener("click", () => {
    if (!currentUser) { showToast("로그인 후 키워드를 설정할 수 있어요."); openAuthModal(); return; }
    openOnboarding(true, []);
  });
}

function renderAiFeedCards(events) {
  const grid = document.getElementById("aiFeedGrid");
  grid.innerHTML = events.map(ev => {
    const stats = eventStatsCache[ev.id] || { views: 0, likes: 0 };
    // 배지는 실제 데이터(할인문구/카테고리)에서만 유도 — 없는 정보를 지어내지 않음
    let badge = "";
    if (ev.discount.includes("1+1")) badge = "1+1";
    else if (ev.category === "popup") badge = "POPUP";
    else {
      const pct = ev.discount.match(/(\d+)\s*%/);
      if (pct && parseInt(pct[1], 10) >= 50) badge = "SALE";
    }
    return `
      <div class="ai-result-card" data-id="${ev.id}">
        <div class="ai-result-card-media">
          <img class="ai-result-card-img" src="${ev.image}" alt="${ev.title}" loading="lazy">
          ${badge ? `<span class="ai-result-card-badge">${badge}</span>` : ""}
        </div>
        <p class="ai-result-card-brand">${ev.brand}</p>
        <p class="ai-result-card-title">${ev.title}</p>
        <span class="ai-result-card-dday">${ev.dday}</span>
        <div class="ai-result-card-stats">
          <span>👁 ${formatCount(stats.views)}</span>
          <span class="stat-heart">❤️ ${formatCount(stats.likes)}</span>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".ai-result-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });
}

document.getElementById("aiFeedMoreBtn").addEventListener("click", () => {
  // AI를 매번 다시 호출하지 않고, 로컬에서 점수순으로 더 보여줌 (비용/속도 모두 안전)
  aiFeedExpanded = !aiFeedExpanded;
  const sorted = [...EVENTS].sort((a, b) => getEventScore(b.id) - getEventScore(a.id));
  renderAiFeedCards(sorted.slice(0, aiFeedExpanded ? 9 : 3));
  document.getElementById("aiFeedMoreBtn").textContent = aiFeedExpanded ? "접기 ^" : "더보기 >";
});

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

/* ---------- Global Search (simple filter feedback) ---------- */
document.getElementById("globalSearch").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const q = e.target.value.trim();
  if (!q) return;
  const match = EVENTS.find(ev =>
    ev.brand.toLowerCase().includes(q.toLowerCase()) ||
    ev.title.toLowerCase().includes(q.toLowerCase())
  );
  if (match) {
    openSheet(match.id);
    hideSearchSuggestions();
  } else {
    showToast(`"${q}"에 대한 검색 결과가 없어요`);
  }
});

/* ---------- 검색 자동완성 / 인기 검색어 ---------- */
const searchInput = document.getElementById("globalSearch");
const suggestionsEl = document.getElementById("searchSuggestions");

function getTrendingBrands(limit = 6) {
  const seen = new Set();
  const uniqueBrandEvents = [];
  [...EVENTS].sort((a, b) => getEventScore(b.id) - getEventScore(a.id)).forEach(ev => {
    if (!seen.has(ev.brand)) { seen.add(ev.brand); uniqueBrandEvents.push(ev); }
  });
  return uniqueBrandEvents.slice(0, limit);
}

function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return `${text.slice(0, idx)}<span class="hl">${text.slice(idx, idx + query.length)}</span>${text.slice(idx + query.length)}`;
}

function showSearchSuggestions() {
  const q = searchInput.value.trim();

  if (!q) {
    const trending = getTrendingBrands();
    if (trending.length === 0) { hideSearchSuggestions(); return; }
    suggestionsEl.innerHTML = `
      <p class="search-suggestions-label">🔥 인기 검색어</p>
      ${trending.map(ev => `<button type="button" class="search-suggestion-item" data-id="${ev.id}">${ev.brand}</button>`).join("")}
    `;
  } else {
    const matches = EVENTS.filter(ev =>
      ev.brand.toLowerCase().includes(q.toLowerCase()) || ev.title.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 6);

    if (matches.length === 0) {
      suggestionsEl.innerHTML = `<p class="search-suggestions-label">"${q}"에 대한 검색 결과가 없어요</p>`;
    } else {
      suggestionsEl.innerHTML = matches.map(ev => `
        <button type="button" class="search-suggestion-item" data-id="${ev.id}">
          ${highlightMatch(ev.brand, q)} · ${highlightMatch(ev.title, q)}
        </button>
      `).join("");
    }
  }

  suggestionsEl.hidden = false;
  suggestionsEl.querySelectorAll(".search-suggestion-item[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      openSheet(btn.dataset.id);
      hideSearchSuggestions();
      searchInput.blur();
    });
  });
}

function hideSearchSuggestions() {
  suggestionsEl.hidden = true;
}

searchInput.addEventListener("focus", showSearchSuggestions);
searchInput.addEventListener("input", showSearchSuggestions);
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-bar-wrap")) hideSearchSuggestions();
});

/* ---------- Hero Button ---------- */
/* ---------- 히어로 배너 캐러셀 (카테고리별 실제 인기 이벤트 1위로 자동 구성, 스와이프 가능) ---------- */
const HERO_GRADIENTS = [
  "linear-gradient(135deg, #FF7A45 0%, #FF4D6D 100%)",
  "linear-gradient(135deg, #6C63FF 0%, #A78BFA 100%)",
  "linear-gradient(135deg, #16A085 0%, #38EF7D 100%)",
  "linear-gradient(135deg, #F857A6 0%, #FF5858 100%)",
  "linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)",
];

function renderHeroCarousel() {
  const track = document.getElementById("heroCarousel");
  const counterEl = document.getElementById("heroCarouselCounter");

  // 카테고리(전체 제외)별로 실제 등록된 이벤트 중 인기순 1위를 뽑아 슬라이드 구성
  const slides = [];
  CATEGORIES.filter(c => c.id !== "all").forEach((cat, i) => {
    const top = [...EVENTS]
      .filter(ev => ev.category === cat.id)
      .sort((a, b) => getEventScore(b.id) - getEventScore(a.id))[0];
    if (top) slides.push({ event: top, category: cat, gradient: HERO_GRADIENTS[i % HERO_GRADIENTS.length] });
  });

  if (slides.length === 0) {
    track.innerHTML = `<div class="hero-slide" style="background:${HERO_GRADIENTS[0]}"><p class="hero-eyebrow">EVENTHUB</p><h2 class="hero-title">흩어진 모든 할인,<br>하나의 앱</h2></div>`;
    counterEl.textContent = "1/1";
    return;
  }

  track.innerHTML = slides.map(s => `
    <div class="hero-slide" data-cat="${s.category.id}" data-event-id="${s.event.id}" style="background:${s.gradient}">
      <p class="hero-eyebrow">${s.category.label.toUpperCase()}</p>
      <h2 class="hero-title">${s.event.brand}<br>${s.event.title}</h2>
      <p class="hero-sub">${s.event.discount}</p>
      <button class="hero-btn" data-event-id="${s.event.id}">지금 확인하기 →</button>
      <img class="hero-slide-img" src="${s.event.image}" alt="${s.event.title}">
    </div>
  `).join("");

  counterEl.textContent = `1/${slides.length}`;

  track.querySelectorAll(".hero-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSheet(btn.dataset.eventId);
    });
  });

  // 스크롤 위치로 현재 슬라이드 번호 계산해서 카운터 갱신
  track.addEventListener("scroll", () => {
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    counterEl.textContent = `${Math.min(idx + 1, slides.length)}/${slides.length}`;
  });
}

/* ---------- 내 주변 인기 이벤트 (GPS 조용히 시도 → 실패 시 서울 기준으로 대체) ---------- */
async function renderNearbySection() {
  const section = document.getElementById("nearbySection");
  const scroll = document.getElementById("nearbyScroll");

  if (EVENTS.length === 0) { section.hidden = true; return; }

  const loc = await getQuietLocation();
  const NEARBY_RADIUS_KM = 15;

  const nearby = EVENTS
    .map(ev => ({ ev, dist: haversineDistanceKm(loc.lat, loc.lng, ev.lat, ev.lng) }))
    .filter(x => x.dist <= NEARBY_RADIUS_KM)
    .sort((a, b) => getEventScore(b.ev.id) - getEventScore(a.ev.id))
    .slice(0, 8);

  if (nearby.length === 0) { section.hidden = true; return; }

  section.hidden = false;

  scroll.innerHTML = nearby.map(({ ev, dist }) => {
    const distLabel = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
    const stats = eventStatsCache[ev.id] || { views: 0, likes: 0 };
    return `
      <div class="nearby-card" data-id="${ev.id}">
        <div class="nearby-card-media">
          <img src="${ev.image}" alt="${ev.title}" loading="lazy">
          <span class="nearby-card-distance">📍 ${distLabel}</span>
        </div>
        <p class="nearby-card-brand">${ev.brand}</p>
        <p class="nearby-card-title">${ev.title}</p>
        <div class="nearby-card-stats">
          <span>👁 ${formatCount(stats.views)}</span>
          <span class="stat-heart">❤️ ${formatCount(stats.likes)}</span>
        </div>
      </div>
    `;
  }).join("");

  scroll.querySelectorAll(".nearby-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });
}

/* ---------- Bottom Nav (visual only, Home is functional) ---------- */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    if (btn.dataset.nav === "saved") {
      openCouponWallet();
    } else if (btn.dataset.nav === "search") {
      openTravelPlanner();
    } else if (btn.dataset.nav !== "home") {
      showToast("준비 중인 기능이에요");
    }
  });
});

/* ---------- 통합 쿠폰함 (관심 등록한 이벤트 모아보기) ---------- */
const couponWalletOverlay = document.getElementById("couponWalletOverlay");

function openCouponWallet() {
  renderCouponWallet();
  couponWalletOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCouponWallet() {
  couponWalletOverlay.classList.remove("open");
  document.body.style.overflow = "";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelector('.nav-item[data-nav="home"]').classList.add("active");
}

function renderCouponWallet() {
  const listEl = document.getElementById("couponWalletList");
  const likedList = EVENTS.filter(ev => likedEvents.has(ev.id));

  if (likedList.length === 0) {
    listEl.innerHTML = `<li class="empty-state">아직 관심 등록한 이벤트가 없어요. 이벤트 상세에서 ♡를 눌러보세요!</li>`;
    return;
  }

  listEl.innerHTML = likedList.map(ev => `
    <li class="coupon-wallet-item" data-id="${ev.id}">
      <img class="coupon-wallet-logo" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고" data-domain="${ev.domain}" data-brand="${ev.brand}">
      <div class="coupon-wallet-info">
        <p class="coupon-wallet-brand">${ev.brand}</p>
        <p class="coupon-wallet-item-title">${ev.title}</p>
        <p class="coupon-wallet-period">${ev.period}</p>
      </div>
      <span class="coupon-wallet-discount">${ev.discount}</span>
    </li>
  `).join("");

  listEl.querySelectorAll(".coupon-wallet-item").forEach(item => {
    item.addEventListener("click", () => {
      closeCouponWallet();
      openSheet(item.dataset.id);
    });
  });
  listEl.querySelectorAll(".coupon-wallet-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}

document.getElementById("couponWalletClose").addEventListener("click", closeCouponWallet);
couponWalletOverlay.addEventListener("click", (e) => {
  if (e.target === couponWalletOverlay) closeCouponWallet();
});

document.getElementById("couponNavBtn").addEventListener("click", openCouponWallet);

/* =========================================================
   캘린더 (찜한 이벤트 자동 표기 + 개인 일정)
   ========================================================= */
const calendarOverlay = document.getElementById("calendarOverlay");
const scheduleFormOverlay = document.getElementById("scheduleFormOverlay");

let calendarViewDate = new Date(); // 현재 보고 있는 달(일자는 항상 1일로 고정해서 사용)
let calendarSelectedDate = null;   // "YYYY-MM-DD" 형태로 선택된 날짜
let personalSchedules = [];        // Supabase user_schedules에서 로드
let likedEventPeriods = [];        // 찜한 이벤트의 {start, end, title, brand} 목록

function formatDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dateHasSomething(dateKey) {
  const hasEvent = likedEventPeriods.some(p => p.start && p.end && dateKey >= p.start && dateKey <= p.end);
  const hasPersonal = personalSchedules.some(s => s.schedule_date === dateKey);
  return { hasEvent, hasPersonal };
}

async function openCalendar() {
  calendarOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("calendarLoginNotice").hidden = !!currentUser;
  document.getElementById("calendarDayDetail").hidden = true;
  calendarSelectedDate = null;

  // 찜한 이벤트 기간은 로그인 여부와 무관하게 항상 표시 (localStorage 기준으로도 동작)
  likedEventPeriods = EVENTS.filter(ev => likedEvents.has(ev.id)).map(ev => ({
    start: ev.periodStart, end: ev.periodEnd, title: ev.title, brand: ev.brand, id: ev.id,
  }));

  if (currentUser && supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from("user_schedules")
        .select("*")
        .eq("user_id", currentUser.id);
      personalSchedules = data || [];
    } catch (err) {
      console.error("개인 일정 로드 오류:", err);
      personalSchedules = [];
    }
  } else {
    personalSchedules = [];
  }

  renderCalendarGrid();
}

function closeCalendar() {
  calendarOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

function renderCalendarGrid() {
  const y = calendarViewDate.getFullYear();
  const m = calendarViewDate.getMonth();
  document.getElementById("calendarMonthLabel").textContent = `${y}년 ${m + 1}월`;

  const firstDayOfWeek = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  let cells = "";
  for (let i = 0; i < firstDayOfWeek; i++) cells += `<div class="calendar-day-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = formatDateKey(y, m, d);
    const { hasEvent, hasPersonal } = dateHasSomething(dateKey);
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === calendarSelectedDate;

    const dots = [];
    if (hasEvent) dots.push(`<span class="calendar-day-dot" style="background:var(--accent)"></span>`);
    if (hasPersonal) dots.push(`<span class="calendar-day-dot" style="background:#4F8EF7"></span>`);

    cells += `
      <button class="calendar-day-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${dateKey}">
        <span>${d}</span>
        <span class="calendar-day-dots">${dots.join("")}</span>
      </button>
    `;
  }

  document.getElementById("calendarGrid").innerHTML = cells;

  document.querySelectorAll(".calendar-day-cell:not(.empty)").forEach(cell => {
    cell.addEventListener("click", () => {
      calendarSelectedDate = cell.dataset.date;
      renderCalendarGrid();
      renderCalendarDayDetail(calendarSelectedDate);
    });
  });
}

function renderCalendarDayDetail(dateKey) {
  const detailEl = document.getElementById("calendarDayDetail");
  const listEl = document.getElementById("calendarDayList");
  detailEl.hidden = false;

  const [y, m, d] = dateKey.split("-").map(Number);
  document.getElementById("calendarDayDetailTitle").textContent = `${m}월 ${d}일`;

  const eventsToday = likedEventPeriods.filter(p => p.start && p.end && dateKey >= p.start && dateKey <= p.end);
  const schedulesToday = personalSchedules.filter(s => s.schedule_date === dateKey);

  if (eventsToday.length === 0 && schedulesToday.length === 0) {
    listEl.innerHTML = `<li class="empty-state">이 날 등록된 일정이 없어요.</li>`;
    return;
  }

  const eventItems = eventsToday.map(ev => `
    <li class="calendar-day-item event-type" data-event-id="${ev.id}">
      <span class="calendar-day-item-time">🎟 이벤트</span>
      <div class="calendar-day-item-body">
        <p class="calendar-day-item-title">${ev.brand} · ${ev.title}</p>
      </div>
    </li>
  `);

  const scheduleItems = schedulesToday.map(s => `
    <li class="calendar-day-item personal-type">
      <span class="calendar-day-item-time">${s.start_time ? s.start_time.slice(0, 5) : ""}${s.end_time ? " ~ " + s.end_time.slice(0, 5) : ""}</span>
      <div class="calendar-day-item-body">
        <p class="calendar-day-item-title">${s.title}</p>
        ${s.memo ? `<p class="calendar-day-item-memo">${s.memo}</p>` : ""}
      </div>
      <button class="calendar-day-item-delete" data-schedule-id="${s.id}">삭제</button>
    </li>
  `);

  listEl.innerHTML = [...eventItems, ...scheduleItems].join("");

  listEl.querySelectorAll(".calendar-day-item.event-type").forEach(item => {
    item.addEventListener("click", () => {
      closeCalendar();
      openSheet(item.dataset.eventId);
    });
  });

  listEl.querySelectorAll(".calendar-day-item-delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deletePersonalSchedule(btn.dataset.scheduleId);
    });
  });
}

async function deletePersonalSchedule(scheduleId) {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from("user_schedules").delete().eq("id", scheduleId);
  if (error) { showToast("삭제 중 오류가 발생했어요."); return; }
  personalSchedules = personalSchedules.filter(s => s.id !== scheduleId);
  renderCalendarGrid();
  renderCalendarDayDetail(calendarSelectedDate);
}

document.getElementById("calendarNavBtn").addEventListener("click", openCalendar);
document.getElementById("calendarClose").addEventListener("click", closeCalendar);
calendarOverlay.addEventListener("click", (e) => { if (e.target === calendarOverlay) closeCalendar(); });

document.getElementById("calendarPrevMonth").addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
  renderCalendarGrid();
});
document.getElementById("calendarNextMonth").addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
  renderCalendarGrid();
});

/* ---------- 개인 일정 추가 모달 ---------- */
document.getElementById("calendarAddScheduleBtn").addEventListener("click", () => {
  if (!currentUser) {
    showToast("로그인하시면 개인 일정을 추가할 수 있어요.");
    return;
  }
  const [y, m, d] = calendarSelectedDate.split("-").map(Number);
  document.getElementById("scheduleFormDate").textContent = `📅 ${m}월 ${d}일 일정 추가`;
  document.getElementById("scheduleForm").reset();
  scheduleFormOverlay.classList.add("open");
});

document.getElementById("scheduleFormClose").addEventListener("click", () => {
  scheduleFormOverlay.classList.remove("open");
});
scheduleFormOverlay.addEventListener("click", (e) => {
  if (e.target === scheduleFormOverlay) scheduleFormOverlay.classList.remove("open");
});

document.getElementById("scheduleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabaseClient || !currentUser) { showToast("로그인이 필요해요."); return; }

  const startTime = document.getElementById("scheduleStartTime").value;
  const endTime = document.getElementById("scheduleEndTime").value;
  const title = document.getElementById("scheduleTitle").value.trim();
  const memo = document.getElementById("scheduleMemo").value.trim();

  if (!title) { showToast("일정 제목을 입력해주세요."); return; }

  const { data, error } = await supabaseClient.from("user_schedules").insert({
    user_id: currentUser.id,
    schedule_date: calendarSelectedDate,
    start_time: startTime || null,
    end_time: endTime || null,
    title, memo,
  }).select();

  if (error) {
    showToast("일정 저장 중 오류가 발생했어요.");
    console.error("일정 저장 오류:", error);
    return;
  }

  if (data && data[0]) personalSchedules.push(data[0]);
  scheduleFormOverlay.classList.remove("open");
  showToast("일정이 저장됐어요 📅");
  renderCalendarGrid();
  renderCalendarDayDetail(calendarSelectedDate);
});

/* =========================================================
   로그인 / 회원가입 / 온보딩
   ========================================================= */
const authOverlay = document.getElementById("authOverlay");
const onboardingOverlay = document.getElementById("onboardingOverlay");
let authMode = "login"; // "login" | "signup"

const KEYWORD_POOL = {
  region: ["#성수동", "#홍대·연남", "#더현대서울", "#압구정로데오", "#한남동", "#강남역"],
  style: ["#포토존맛집", "#비건뷰티", "#리미티드에디션", "#신상디저트", "#코덕필수템", "#스트릿패션", "#미니멀룩"],
  benefit: ["#1+1", "#반값할인", "#무료체험·증정", "#선착순한정", "#타임세일", "#즉시쿠폰"],
};
let selectedKeywords = new Set();

/* ---------- 모달 열기/닫기 ---------- */
function updateProfileButton() {
  const btn = document.getElementById("profileBtn");
  const label = document.getElementById("profileBtnLabel");
  if (currentUser) {
    btn.classList.add("logged-in");
    btn.setAttribute("aria-label", "내 계정");
    const shortName = (currentUser.email || currentUser.user_metadata?.name || "내 계정").split("@")[0];
    label.textContent = shortName;
  } else {
    btn.classList.remove("logged-in");
    btn.setAttribute("aria-label", "로그인");
    label.textContent = "로그인";
  }
}

function openAuthModal() {
  if (currentUser) {
    document.getElementById("authFormBody").hidden = true;
    document.getElementById("authAccountBody").hidden = false;
    document.getElementById("authUserEmail").textContent =
      currentUser.email || "카카오 계정으로 로그인됨";
  } else {
    document.getElementById("authFormBody").hidden = false;
    document.getElementById("authAccountBody").hidden = true;
  }
  authOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeAuthModal() {
  authOverlay.classList.remove("open");
  document.body.style.overflow = "";
}
document.getElementById("profileBtn").addEventListener("click", openAuthModal);
document.getElementById("authClose").addEventListener("click", closeAuthModal);
authOverlay.addEventListener("click", (e) => { if (e.target === authOverlay) closeAuthModal(); });

/* ---------- 소셜 로그인 ---------- */
document.getElementById("googleLoginBtn").addEventListener("click", async () => {
  if (!supabaseClient) { showToast("로그인 기능을 일시적으로 사용할 수 없어요."); return; }
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
});
document.getElementById("kakaoLoginBtn").addEventListener("click", async () => {
  if (!supabaseClient) { showToast("로그인 기능을 일시적으로 사용할 수 없어요."); return; }
  // Supabase 기본 요청 스코프(account_email 포함)는 일반(개인) 카카오 앱에 없는 동의항목이라
  // KOE205 에러가 남 → 실제로 설정된 동의항목(닉네임)만 명시적으로 요청하도록 제한
  await supabaseClient.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: window.location.origin,
      scopes: "profile_nickname",
    },
  });
});

/* ---------- 이메일/비밀번호 로그인 (보조 수단) ---------- */
function setAuthMode(mode) {
  authMode = mode;
  document.getElementById("authFormTitle").textContent = mode === "login" ? "로그인" : "회원가입";
  document.getElementById("authSubmitBtn").textContent = mode === "login" ? "로그인" : "회원가입";
  document.getElementById("authToggleMode").innerHTML = mode === "login"
    ? `계정이 없으신가요? <button type="button" id="authToggleBtn">회원가입</button>`
    : `이미 계정이 있으신가요? <button type="button" id="authToggleBtn">로그인</button>`;
}
// 이벤트 위임: authToggleBtn이 매번 새로 그려져도(innerHTML 교체) 계속 동작하도록
// 부모 요소(authFormBody)에 클릭 리스너를 한 번만 등록합니다.
document.getElementById("authFormBody").addEventListener("click", (e) => {
  if (e.target && e.target.id === "authToggleBtn") {
    setAuthMode(authMode === "login" ? "signup" : "login");
  }
});

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const errorEl = document.getElementById("authError");
  errorEl.hidden = true;

  if (!supabaseClient) {
    errorEl.hidden = false;
    errorEl.textContent = "로그인 기능을 일시적으로 사용할 수 없어요.";
    return;
  }

  const { error } = authMode === "login"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });

  if (error) {
    errorEl.hidden = false;
    errorEl.textContent = error.message.includes("Invalid login")
      ? "이메일 또는 비밀번호가 올바르지 않아요."
      : error.message;
    return;
  }

  if (authMode === "signup") {
    errorEl.hidden = false;
    errorEl.style.color = "#1E8A4C";
    errorEl.textContent = "가입 완료! 바로 로그인됩니다.";
  }
});

document.getElementById("authLogoutBtn").addEventListener("click", async () => {
  if (!supabaseClient) { closeAuthModal(); return; }
  await supabaseClient.auth.signOut();
  closeAuthModal();
  showToast("로그아웃되었습니다");
});

/* ---------- 온보딩 (최초 로그인 시 키워드 3개 이상 + 알림 이메일) ---------- */
let onboardingEditMode = false; // true면 "키워드 편집"(AI 섹션 + 버튼)으로 열린 것 — 이메일/최소개수 요구 안 함

function renderKeywordChips() {
  Object.entries(KEYWORD_POOL).forEach(([group, keywords]) => {
    const wrap = document.querySelector(`.keyword-chips[data-group="${group}"]`);
    wrap.innerHTML = keywords.map(k => `<button type="button" class="keyword-chip" data-kw="${k}">${k}</button>`).join("");
    wrap.querySelectorAll(".keyword-chip").forEach(chip => {
      if (selectedKeywords.has(chip.dataset.kw)) chip.classList.add("selected");
      chip.addEventListener("click", () => {
        const kw = chip.dataset.kw;
        if (selectedKeywords.has(kw)) {
          selectedKeywords.delete(kw);
          chip.classList.remove("selected");
        } else {
          selectedKeywords.add(kw);
          chip.classList.add("selected");
        }
        updateOnboardingState();
      });
    });
  });
}

function updateOnboardingState() {
  const count = selectedKeywords.size;
  const emailStep = document.getElementById("onboardingEmailStep");
  const submitBtn = document.getElementById("onboardingSubmitBtn");

  if (onboardingEditMode) {
    document.getElementById("onboardingCount").textContent = `${count}개 선택됨`;
    emailStep.hidden = true;
    submitBtn.disabled = count === 0;
    submitBtn.textContent = "키워드 저장";
    return;
  }

  document.getElementById("onboardingCount").textContent = `${count}개 선택됨 (최소 3개)`;
  emailStep.hidden = count < 3;
  const emailVal = document.getElementById("onboardingEmail").value.trim();
  submitBtn.disabled = !(count >= 3 && emailVal.length > 3);
  submitBtn.textContent = "이벤트허브 시작하기";
}
document.getElementById("onboardingEmail").addEventListener("input", updateOnboardingState);

async function openOnboarding(editMode = false, existingKeywords = []) {
  onboardingEditMode = editMode;
  selectedKeywords = new Set(existingKeywords);
  document.querySelector(".onboarding-title").textContent = editMode
    ? "관심 키워드를 편집해보세요 ✏️"
    : "환영해요! 좋아하는 관심사를\n3개 이상 골라주세요 ✨";
  renderKeywordChips();
  updateOnboardingState();
  // 구글 로그인이면 이메일이 이미 있으니 미리 채워줌 (수정 가능)
  document.getElementById("onboardingEmail").value = currentUser?.email || "";
  onboardingOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

document.getElementById("onboardingSubmitBtn").addEventListener("click", async () => {
  if (!supabaseClient || !currentUser) { showToast("로그인 상태를 확인해주세요."); return; }

  const updatePayload = { user_id: currentUser.id, keywords: [...selectedKeywords] };
  if (!onboardingEditMode) {
    updatePayload.contact_email = document.getElementById("onboardingEmail").value.trim();
  }

  const { error } = await supabaseClient.from("user_preferences").upsert(updatePayload);

  if (error) {
    showToast("저장 중 오류가 발생했어요. 다시 시도해주세요.");
    console.error("온보딩 저장 오류:", error);
    return;
  }

  onboardingOverlay.classList.remove("open");
  document.body.style.overflow = "";
  showToast(onboardingEditMode ? "키워드가 저장됐어요 ✅" : "환영해요! 맞춤 추천이 준비됐어요 🎉");

  if (onboardingEditMode) {
    renderAiKeywordChips([...selectedKeywords]);
    loadAiFeed([...selectedKeywords]);
  } else {
    await loadUserPreferencesAndSync();
  }
});

/* ---------- AI 섹션 키워드 태그 (X 삭제 + "+" 추가) ---------- */
function renderAiKeywordChips(keywords) {
  const row = document.getElementById("aiKeywordRow");

  if (!currentUser) {
    row.innerHTML = `<button type="button" class="ai-keyword-login-btn" id="aiKeywordLoginBtn">로그인하고 맞춤 키워드 설정하기 →</button>`;
    document.getElementById("aiKeywordLoginBtn").addEventListener("click", openAuthModal);
    renderAiFeedSetupPrompt();
    return;
  }

  const chips = (keywords || []).map(k => `
    <span class="ai-keyword-chip">
      ${k}
      <button type="button" class="ai-keyword-remove" data-kw="${k}" aria-label="${k} 삭제">✕</button>
    </span>
  `).join("");

  row.innerHTML = `${chips}<button type="button" class="ai-keyword-add-btn" id="aiKeywordAddBtn">+ 추가</button>`;

  row.querySelectorAll(".ai-keyword-remove").forEach(btn => {
    btn.addEventListener("click", async () => {
      const updated = (keywords || []).filter(k => k !== btn.dataset.kw);
      const { error } = await supabaseClient.from("user_preferences").update({ keywords: updated }).eq("user_id", currentUser.id);
      if (error) { showToast("키워드 삭제 중 오류가 발생했어요."); return; }
      renderAiKeywordChips(updated);
      loadAiFeed(updated);
    });
  });

  document.getElementById("aiKeywordAddBtn").addEventListener("click", () => openOnboarding(true, keywords || []));
}

/* ---------- 로그인 상태 변화 감지 + 좋아요 동기화 ---------- */
async function loadUserPreferencesAndSync() {
  if (!currentUser) return;

  // 1) 온보딩 완료 여부 확인
  const { data: pref } = await supabaseClient
    .from("user_preferences")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!pref) {
    openOnboarding(); // 최초 로그인 → 온보딩 강제 노출
    return;
  }

  renderAiKeywordChips(pref.keywords || []);
  loadAiFeed(pref.keywords || []);

  // 2) 로그인 전 localStorage에 쌓인 좋아요를 DB로 마이그레이션 (한 번만)
  if (likedEvents.size > 0) {
    const rows = [...likedEvents].map(eventId => ({ user_id: currentUser.id, event_id: eventId }));
    await supabaseClient.from("user_saves").upsert(rows, { onConflict: "user_id,event_id" });
  }

  // 3) DB에 저장된 좋아요를 진짜 소스로 다시 불러옴
  const { data: saves } = await supabaseClient
    .from("user_saves")
    .select("event_id")
    .eq("user_id", currentUser.id);

  if (saves) {
    likedEvents = new Set(saves.map(s => s.event_id));
    localStorage.setItem("eventhub-liked", JSON.stringify([...likedEvents]));
    renderFeed();
    renderRanking();
  }

  await ensureReferralCode();
  checkNewFollowedEvents();
}

/* ---------- 친구 초대 (그로스 루프) ---------- */
function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function ensureReferralCode() {
  if (!supabaseClient || !currentUser) return;

  const { data: existing } = await supabaseClient
    .from("user_referrals")
    .select("referral_code")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (existing) {
    document.getElementById("inviteCode").textContent = existing.referral_code;
    return;
  }

  // 최초 로그인 시에만 생성. 가입 전 초대 링크(?ref=CODE)로 들어왔다면 invited_by에 연결
  const pendingRef = localStorage.getItem("eventhub-pending-ref");
  const newCode = generateReferralCode();

  const { error } = await supabaseClient.from("user_referrals").insert({
    user_id: currentUser.id,
    referral_code: newCode,
    invited_by: pendingRef || null,
  });

  if (!error) {
    localStorage.removeItem("eventhub-pending-ref");
    document.getElementById("inviteCode").textContent = newCode;
  }
}

document.getElementById("inviteShareBtn").addEventListener("click", async () => {
  const code = document.getElementById("inviteCode").textContent;
  if (!code || code === "코드 생성 중...") { showToast("잠시 후 다시 시도해주세요."); return; }

  const inviteLink = `${window.location.origin}/?ref=${code}`;

  try {
    await loadKakaoShareSdk();
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "EventHub — 놓치면 아까운 할인/팝업 정보 모음",
        description: "친구가 EventHub로 초대했어요! 가입하고 같이 써봐요 🎉",
        imageUrl: `${window.location.origin}/img/eventhub-share.png`,
        link: { mobileWebUrl: inviteLink, webUrl: inviteLink },
      },
      buttons: [{ title: "EventHub 시작하기", link: { mobileWebUrl: inviteLink, webUrl: inviteLink } }],
    });
  } catch (err) {
    // 카카오 공유 실패 시 링크 복사로 대체
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast("초대 링크가 복사됐어요! 친구에게 붙여넣기 해주세요.");
    } catch {
      showToast(`초대 링크: ${inviteLink}`);
    }
  }
});

// ⚠️ 이 등록이 최상위(top-level) 코드에서 바로 실행되기 때문에, supabaseClient가 null이면
//    (설정값이 비어있거나 SDK 로드 실패) 여기서 에러가 나서 이 아래에 있는 모든 코드
//    (카테고리 탭, 이벤트 로딩 등 Init 블록 전체)가 실행이 안 되는 심각한 문제가 있었습니다.
//    반드시 null 체크로 감싸서, 로그인 설정이 잘못돼도 사이트 나머지 기능은 정상 작동하게 합니다.
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateProfileButton();

    // "SIGNED_IN"은 방금 로그인했을 때, "INITIAL_SESSION"은 이미 로그인된 상태로
    // 페이지를 새로고침했을 때 발생함 — 두 경우 모두 동기화가 필요함
    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && currentUser) {
      if (event === "SIGNED_IN") closeAuthModal();
      loadUserPreferencesAndSync();
    }
    if (event === "SIGNED_OUT") {
      // 로그아웃 시 좋아요는 localStorage 기준으로 되돌아감 (다음 로그인 시 다시 동기화)
    }
  });
}

/* ---------- AI 섹션 모드 전환 (맞춤 이벤트 추천 ↔ 여행 플래너) ---------- */
/* ---------- AI 여행 플래너 오버레이 (하단 "검색" 탭에서 진입) ---------- */
function openTravelPlanner() {
  const dateInput = document.getElementById("travelDate");
  const endDateInput = document.getElementById("travelEndDate");
  const today = new Date().toISOString().slice(0, 10);
  if (!dateInput.value) dateInput.value = today;
  if (!endDateInput.value) endDateInput.value = today;

  document.getElementById("travelPlannerOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

document.getElementById("travelPlannerClose").addEventListener("click", () => {
  document.getElementById("travelPlannerOverlay").classList.remove("open");
  document.body.style.overflow = "";
});
document.getElementById("travelPlannerOverlay").addEventListener("click", (e) => {
  if (e.target.id === "travelPlannerOverlay") {
    document.getElementById("travelPlannerOverlay").classList.remove("open");
    document.body.style.overflow = "";
  }
});

document.getElementById("travelPlannerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const startDate = document.getElementById("travelDate").value;
  const endDate = document.getElementById("travelEndDate").value;
  const region = document.getElementById("travelRegion").value.trim();
  const spinnerWrap = document.getElementById("travelSpinnerWrap");
  const errorEl = document.getElementById("travelError");
  const resultEl = document.getElementById("travelResult");
  const submitBtn = document.getElementById("travelPlannerSubmitBtn");

  errorEl.hidden = true;
  resultEl.hidden = true;

  if (!startDate || !endDate || !region) {
    showTravelError("날짜와 지역을 모두 입력해 주세요.", null);
    return;
  }
  if (endDate < startDate) {
    showTravelError("종료일은 시작일보다 빠를 수 없어요.", null);
    return;
  }

  spinnerWrap.hidden = false;
  submitBtn.disabled = true;
  submitBtn.textContent = "계획 짜는 중...";

  try {
    const res = await fetch("/api/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, start_date: startDate, end_date: endDate }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || `서버 오류 (${res.status})`);
    }

    renderTravelResult(data);

  } catch (err) {
    // ── 예외처리: AI/네이버 API 실패 시 안내 문구 + 폴백 데이터 표시 ──
    console.error("여행 플래너 오류:", err);
    showTravelError(
      "AI 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주시거나, 하단의 백업(폴백) 데이터를 확인해 주세요.",
      { destination: region, start_date: startDate, end_date: endDate }
    );

  } finally {
    spinnerWrap.hidden = true;
    submitBtn.disabled = false;
    submitBtn.textContent = "여행 계획 짜기";
  }
});

function showTravelError(message, fallbackContext) {
  const errorEl = document.getElementById("travelError");
  errorEl.hidden = false;
  errorEl.innerHTML = `<p>${message}</p>`;

  // 완전 실패 시에도 화면이 텅 비지 않도록 최소한의 안전 폴백 카드를 보여줌
  if (fallbackContext) {
    renderTravelResult({
      destination: fallbackContext.destination,
      start_date: fallbackContext.start_date,
      end_date: fallbackContext.end_date,
      num_days: 1,
      days: [],
      lodgings: [],
      errors: [{ step: "Client", type: "Fetch Error", message: "네트워크 또는 서버 응답 오류" }],
    });
  }
}

function renderTravelResult(data) {
  const resultEl = document.getElementById("travelResult");
  resultEl.hidden = false;

  const lodgingsHtml = (data.lodgings || []).length
    ? data.lodgings.map(l => `
        <div class="travel-place-card">
          <p class="travel-place-name">${l.name}</p>
          <p class="travel-place-meta">${l.category || ""} ${l.address ? "· " + l.address : ""}</p>
          ${l.url ? `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="travel-place-link">자세히 보기 ↗</a>` : ""}
        </div>`).join("")
    : `<p class="travel-empty">추천 숙박 정보를 불러오지 못했어요.</p>`;

  const activityBlock = (label, slot) => {
    if (!slot || !slot.name) return "";
    const badge = slot.activity_type ? `<span class="travel-activity-badge">${slot.activity_type}</span>` : "";
    return `
      <div class="travel-slot">
        <p class="travel-slot-label">${label} ${badge}</p>
        <p class="travel-slot-name">${slot.name}</p>
        <p class="travel-slot-desc">${slot.description || ""}</p>
      </div>`;
  };

  const mealBlock = (label, place) => {
    if (!place || !place.name) return `<div class="travel-slot"><p class="travel-slot-label">${label}</p><p class="travel-empty">추천 정보를 불러오지 못했어요.</p></div>`;
    return `
      <div class="travel-slot">
        <p class="travel-slot-label">${label}</p>
        <p class="travel-slot-name">${place.name}</p>
        <p class="travel-slot-desc">${place.category || ""} ${place.address ? "· " + place.address : ""}</p>
        ${place.url ? `<a href="${place.url}" target="_blank" rel="noopener noreferrer" class="travel-place-link">자세히 보기 ↗</a>` : ""}
      </div>`;
  };

  const daysHtml = (data.days || []).map(day => `
    <div class="travel-day-card">
      <p class="travel-day-title">Day ${day.day_number} · ${day.date}</p>
      ${activityBlock("🌅 오전", day.morning)}
      ${mealBlock("🍚 점심", day.lunch)}
      ${activityBlock("☀️ 오후", day.afternoon)}
      ${mealBlock("🍽 저녁", day.dinner)}
      ${activityBlock("🌙 저녁 활동", day.evening)}
      ${day.route_tip ? `<p class="travel-slot-desc travel-day-route">🗺 ${day.route_tip}</p>` : ""}
    </div>
  `).join("");

  const kakaoSearchLink = `https://map.kakao.com/link/search/${encodeURIComponent(data.destination)}`;
  const dateRangeLabel = data.start_date === data.end_date
    ? data.start_date
    : `${data.start_date} ~ ${data.end_date}`;

  resultEl.innerHTML = `
    <h3 class="travel-section-title">📍 ${data.destination} · ${dateRangeLabel} (${data.num_days || (data.days || []).length}일)</h3>

    <p class="travel-disclaimer">⚠️ 명소·행사 정보는 AI가 생성한 참고용 추천입니다. 실제 운영 여부·정확한 일정은 방문 전 꼭 확인해주세요. 맛집·숙박 정보는 네이버 실시간 검색 결과입니다.</p>

    ${daysHtml || `<p class="travel-empty">일정을 불러오지 못했어요.</p>`}

    <div class="travel-block">
      <p class="travel-block-label">🏨 추천 숙박</p>
      <div class="travel-place-grid">${lodgingsHtml}</div>
    </div>

    <a class="kakao-route-btn" href="${kakaoSearchLink}" target="_blank" rel="noopener noreferrer">🗺 카카오맵에서 ${data.destination} 검색하기</a>

    ${data.errors && data.errors.length ? `
    <details class="travel-error-log">
      <summary>⚠️ 일부 데이터는 백업 정보로 대체되었어요 (${data.errors.length}건)</summary>
      <ul>
        ${data.errors.map(e => `<li>[${e.step}] ${e.message}</li>`).join("")}
      </ul>
    </details>` : ""}
  `;
}

/* ---------- Init ---------- */
// 초대 링크(?ref=CODE)로 들어온 경우, 나중에 회원가입 완료 시 연결할 수 있도록 저장해둠
const urlRefCode = new URLSearchParams(window.location.search).get("ref");
if (urlRefCode) localStorage.setItem("eventhub-pending-ref", urlRefCode);

bindDiscountTabs();
loadEventsFromApi(); // 내부에서 renderCategoryTabs/renderRanking/renderFeed까지 트리거함
loadWeather(); // 위치 권한 없으면 서울 기준으로 기본 표시
renderAiKeywordChips(); // 기본(비로그인) 상태 — 로그인하면 onAuthStateChange에서 다시 그려짐

/* ---------- Day / Night Theme (자동 감지만, 수동 토글 버튼은 제거됨) ----------
   저장된 선호도가 있으면 그대로, 없으면 OS 설정을 따름.
   ⚠️ 다크모드 토글 버튼은 삭제하고 그 자리에 알림벨을 넣기로 했으므로,
   여기서 버튼 관련 엘리먼트를 참조하면 존재하지 않아 에러가 나서 이 아래 코드
   전체가 실행이 안 되는 문제가 생길 뻔했음 — 자동 감지 로직만 남기고 정리함. */
const THEME_KEY = "eventhub-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

applyTheme(getInitialTheme());

/* ---------- 헤더 알림벨 (관심 브랜드/키워드 관련 새 이벤트 안내) ---------- */
document.getElementById("notifBellBtn").addEventListener("click", () => {
  openNotificationPanel();
});

async function openNotificationPanel() {
  document.getElementById("notifDot").hidden = true;
  localStorage.setItem("eventhub-last-seen-notif", Date.now().toString());

  if (!currentUser || !supabaseClient) {
    showToast("로그인하시면 관심 브랜드의 새 이벤트를 알려드려요.");
    return;
  }

  try {
    const { data: follows } = await supabaseClient
      .from("user_follows")
      .select("brand")
      .eq("user_id", currentUser.id);

    const followedBrands = (follows || []).map(f => f.brand);
    if (followedBrands.length === 0) {
      showToast("아직 팔로우한 브랜드가 없어요. 이벤트 상세에서 브랜드를 팔로우해보세요!");
      return;
    }

    const matches = EVENTS.filter(ev => followedBrands.includes(ev.brand)).slice(0, 5);
    if (matches.length === 0) {
      showToast("팔로우한 브랜드의 진행 중인 이벤트가 아직 없어요.");
      return;
    }
    openSheet(matches[0].id);
    showToast(`팔로우한 ${matches[0].brand}의 이벤트예요!`);
  } catch (err) {
    console.error("알림 조회 오류:", err);
  }
}

// 마지막 방문 이후 팔로우한 브랜드의 새 이벤트가 있으면 벨에 점 표시
async function checkNewFollowedEvents() {
  if (!currentUser || !supabaseClient || EVENTS.length === 0) return;
  try {
    const { data: follows } = await supabaseClient.from("user_follows").select("brand").eq("user_id", currentUser.id);
    const followedBrands = (follows || []).map(f => f.brand);
    if (followedBrands.length > 0 && EVENTS.some(ev => followedBrands.includes(ev.brand))) {
      document.getElementById("notifDot").hidden = false;
    }
  } catch { /* 조용히 무시 — 알림은 부가 기능이라 실패해도 사이트 기능에 영향 없어야 함 */ }
}

/* ---------- 고정 퀵메뉴 4버튼 ---------- */
document.getElementById("quickMenuCalendarBtn").addEventListener("click", () => openCalendar());

document.getElementById("quickMenuLocalBtn").addEventListener("click", () => {
  if (!gpsFilterActive) toggleGpsFilter();
  document.querySelector(".feed-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("quickMenuEndingBtn").addEventListener("click", () => {
  endingSoonFilterActive = !endingSoonFilterActive;
  showToast(endingSoonFilterActive ? "종료 임박 순으로 정렬했어요 ⏰" : "종료 임박 정렬을 해제했어요");
  renderFeed();
  document.querySelector(".feed-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("quickMenuFollowBtn").addEventListener("click", openFollowedBrandsPanel);

async function openFollowedBrandsPanel() {
  if (!currentUser || !supabaseClient) {
    showToast("로그인하시면 관심 브랜드를 팔로우하고 알림을 받을 수 있어요.");
    return;
  }
  try {
    const { data } = await supabaseClient.from("user_follows").select("brand").eq("user_id", currentUser.id);
    const brands = (data || []).map(f => f.brand);
    if (brands.length === 0) {
      showToast("아직 팔로우한 브랜드가 없어요. 이벤트 상세에서 브랜드를 팔로우해보세요!");
      return;
    }
    showToast(`팔로우 중: ${brands.join(", ")}`);
  } catch (err) {
    console.error("팔로우 목록 조회 오류:", err);
  }
}

/* =========================================================
   문의하기 (Inquiry) — Google Apps Script 웹앱 연동
   ========================================================= */
const inquiryForm = document.getElementById("inquiryForm");
const inquiryStatus = document.getElementById("inquiryStatus");
const inquirySubmitBtn = document.getElementById("inquirySubmitBtn");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showInquiryStatus(message, isError) {
  inquiryStatus.hidden = false;
  inquiryStatus.textContent = message;
  inquiryStatus.style.color = isError ? "#E53E3E" : "";
}

if (inquiryForm) {
  inquiryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("inquiryName").value.trim();
    const email = document.getElementById("inquiryEmail").value.trim();
    const message = document.getElementById("inquiryMessage").value.trim();

    // ── 예외처리 1: 이메일 형식 오류
    if (!email || !isValidEmail(email)) {
      showInquiryStatus("올바른 이메일을 입력해주세요.", true);
      return;
    }
    // ── 예외처리 2: 빈 문의 내용
    if (!message) {
      showInquiryStatus("문의 내용을 입력해주세요.", true);
      return;
    }

    inquirySubmitBtn.disabled = true;
    inquirySubmitBtn.textContent = "등록 중...";
    showInquiryStatus("문의를 등록하는 중입니다...", false);

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const result = await res.json();

      // ── 이전 버전의 버그: 응답을 확인하지 않고 항상 "성공"으로 표시했음.
      //    백엔드가 에러를 반환해도 화면에는 성공 메시지가 떠서 문제를 알아챌 수 없었습니다.
      if (!res.ok || result.error) {
        throw new Error(result.error || `서버 오류 (${res.status})`);
      }

      showInquiryStatus("문의가 정상적으로 접수되었습니다. 감사합니다!", false);
      inquiryForm.reset();

    } catch (err) {
      // ── 예외처리 3: 네트워크/서버 오류
      console.error("문의 등록 오류:", err);
      showInquiryStatus(err.message || "잠시 후 다시 시도해주세요.", true);

    } finally {
      inquirySubmitBtn.disabled = false;
      inquirySubmitBtn.textContent = "문의 등록하기";
    }
  });
}

/* ---------- PWA: 서비스 워커 등록 (설치 가능 + 기본 오프라인 셸 캐싱) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("서비스 워커 등록 실패(치명적이지 않음):", err);
    });
  });
}