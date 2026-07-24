/* =========================================================
   EventHub Prototype — js/01-bootstrap-map-share.js
   (원래 하나였던 main.js를 기능별로 여러 파일로 분리했습니다.
    index.html에 로드 순서대로 <script> 태그가 나열되어 있으며,
    모든 파일이 하나의 전역 스코프를 공유합니다 — 순서를 바꾸면 안 됩니다.
    백엔드: Supabase 기반 /api/events(GET+POST 통합), /api/inquiries.
    Google Sheets/Apps Script는 더 이상 사용하지 않습니다.)
   ========================================================= */

/* 카카오맵 JavaScript 키 — Kakao Developers에서 발급, 배포 도메인 등록 필요 */
const KAKAO_JS_KEY = "2a4211503ca5201a29e348b22957fba4";

/* ── XSS 방지: 사용자가 입력한 텍스트(검색어, 개인 일정 메모 등)를 innerHTML에
   끼워넣을 때는 반드시 이 함수로 이스케이프한 뒤 사용합니다. ── */
function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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
  // 이전엔 그냥 현재 페이지 주소를 공유해서, 받은 사람이 열면 그 이벤트가 아니라
  // 홈 화면이 떴다. openSheet()가 주소창을 ?event=id로 이미 바꿔주므로, 지금은
  // 시트가 열려있는 상태에서 공유 버튼을 누른다는 전제하에 location.href를 써도 되지만,
  // 만약을 대비해 getEventShareUrl()로 명시적으로 조립한다.
  const shareUrl = getEventShareUrl(ev);
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

      closeShareMenu();
      popModalHistory();
    });
  });

  document.getElementById("shareMenuOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  pushModalHistory(closeShareMenu);
}

function closeShareMenu() {
  document.getElementById("shareMenuOverlay").classList.remove("open");
}

document.getElementById("shareMenuClose").addEventListener("click", () => {
  closeShareMenu();
  popModalHistory();
});
document.getElementById("shareMenuOverlay").addEventListener("click", (e) => {
  if (e.target.id === "shareMenuOverlay") { closeShareMenu(); popModalHistory(); }
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
        strokeColor: "#FF6A00",
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

/* ==================================================================
   뒤로가기(히스토리 API) 연동 + 공유 링크 정상화 공통 유틸
   ------------------------------------------------------------------
   모달/바텀시트가 열려도 브라우저(폰)의 시스템 뒤로가기가 그 존재를
   전혀 몰라서, 뒤로가기를 눌러도 안 닫히고 페이지를 벗어나버리는
   문제를 해결한다. 이벤트 상세시트처럼 "고유 링크가 있어야 하는" 모달은
   url 인자로 실제 주소창 URL도 같이 바꿔서, 공유했을 때 그 이벤트로
   바로 열리게 한다 (그냥 뒤로가기만 감지하면 되는 모달은 url을 생략하면 됨).

   사용법: 모달을 열 때 pushModalHistory(닫는함수, [선택:URL])를 호출하고,
   "X 버튼"이나 "바깥 영역 클릭"으로 닫을 때는 실제 닫기 함수 호출
   직후에 popModalHistory()도 같이 호출한다.
   ================================================================== */
const modalCloseStack = []; // 열려있는 모달들의 "닫기 함수" 스택 (맨 위 = 가장 최근에 연 모달)
let suppressNextPopstate = false;

function pushModalHistory(closeFn, url) {
  modalCloseStack.push(closeFn);
  history.pushState({ eventhubModalDepth: modalCloseStack.length }, "", url || location.href);
}

// 버튼/바깥영역 클릭 등 "UI 조작으로" 모달을 닫을 때 호출.
// 실제 화면을 닫는 로직(예: closeSheet())은 호출한 쪽에서 이미 실행했다고 가정하고,
// 여기서는 히스토리 스택만 정리한다. history.back()이 이전 URL로 자동 복원해준다.
function popModalHistory() {
  if (modalCloseStack.length === 0) return;
  modalCloseStack.pop();
  suppressNextPopstate = true;
  history.back();
}

window.addEventListener("popstate", () => {
  if (suppressNextPopstate) {
    suppressNextPopstate = false;
    return;
  }
  // 시스템 뒤로가기(제스처/버튼)가 눌린 경우: 가장 최근에 연 모달을 닫는다
  if (modalCloseStack.length > 0) {
    const closeFn = modalCloseStack.pop();
    closeFn();
  }
});

// 이벤트 상세시트 전용 공유 URL. 주소창 URL이 이미 ?event=id로 맞춰져 있으면
// 그걸 그대로 쓰고(공유 시점에 시트가 열려있는 상태라 항상 맞음), 혹시 모를
// 예외 상황을 대비해 안전하게 직접 조립하는 경로도 마련해둔다.
function getEventShareUrl(ev) {
  const url = new URL(location.href);
  url.searchParams.set("event", ev.id);
  return url.toString();
}