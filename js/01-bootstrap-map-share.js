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

/* 이미지가 여러 장인 이벤트(카드뉴스 형태로 여러 장에 정보를 나눠 담은 게시물) 지원.
   DB 스키마를 새로 안 늘리고, channel 필드와 동일한 기존 관행(여러 개면 줄바꿈으로 구분)을
   그대로 재사용한다 — 기존 단일 이미지 데이터도 그대로 호환된다(줄바꿈 없으면 1개짜리 배열). */
function getEventImages(ev) {
  return (ev.image || "").split("\n").map(s => s.trim()).filter(Boolean);
}
/* 카드처럼 좁은 공간에서는 항상 "브랜드가 정한 원본 순서"의 첫 장만 대표이미지로 쓴다. */
function getEventThumbnail(ev) {
  // ⚠️ 예전엔 `|| ev.image`로 원본 문자열을 폴백에 뒀는데, image가 공백/줄바꿈만 있는
  // 경우(getEventImages가 다 걸러내서 빈 배열) 그 무의미한 공백 문자열이 그대로 img
  // src에 들어가버리는 버그가 있었다. 진짜 이미지가 하나도 없으면 그냥 빈 문자열을 줘서
  // 기존 handleImageError(onerror) 폴백이 정상적으로 대체 이미지를 보여주게 한다.
  return getEventImages(ev)[0] || "";
}

/* "상세안내" 텍스트 안에 이미지 URL을 그냥 한 줄로 섞어 넣을 수 있게 지원한다.
   관리자가 "상세안내"와 "상세페이지 이미지"를 별도 칸으로 헷갈려서 이미지 URL을 텍스트
   칸에 넣는 바람에 이미지가 하나도 안 뜨던 문제가 있었다 — 아예 필드를 하나로 합쳐서,
   그 줄이 이미지 URL처럼 생겼으면 이미지로, 아니면 텍스트 단락으로 순서 그대로 보여준다. */
const IMAGE_URL_LINE_PATTERN = /^https?:\/\/\S+\.(jpg|jpeg|png|webp|gif|avif)(\?\S*)?$/i;

function renderMixedTextAndImages(text) {
  const lines = (text || "").split("\n").map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  return lines.map(line => {
    if (IMAGE_URL_LINE_PATTERN.test(line)) {
      return `<img class="sheet-desc-inline-img" src="${line}" alt="" loading="lazy" onerror="this.style.display='none'">`;
    }
    return `<p>${escapeHtml(line)}</p>`;
  }).join("");
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
  // ⚠️ 실패한(reject된) 프로미스를 그대로 캐시해두면, 원인(도메인 미등록 등)을 고친
  // 뒤에도 새로고침 전까진 계속 같은 실패만 재사용되어 재시도가 아예 안 됐다.
  // 실패했을 땐 캐시를 비워서 다음 호출이 스크립트를 다시 불러오도록 한다.
  kakaoMapSdkPromise.catch(() => { kakaoMapSdkPromise = null; });
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
  // ⚠️ 예전엔 ev.image를 그대로 넣었는데, 두 가지 경우에 카카오톡 공유 자체가 실패했다:
  //  1) 대표이미지가 비어있는 이벤트 — Kakao Share API는 imageUrl이 빈 문자열이면 거부한다.
  //  2) 대표이미지 칸에 여러 장(줄바꿈 구분)이 들어있는 이벤트 — 그 여러 줄짜리 문자열을
  //     통째로 "하나의 URL"로 보내니 당연히 유효하지 않은 값이 된다.
  // 카드 썸네일에 이미 쓰고 있는 getEventThumbnail()로 "첫 장만, 없으면 빈 문자열"을 뽑고,
  // 그래도 없으면 프로젝트에 실제로 있는 아이콘 이미지로 대체한다.
  const imageUrl = getEventThumbnail(ev) || `${window.location.origin}/icons/icon-512.png`;
  window.Kakao.Share.sendDefault({
    objectType: "feed",
    content: {
      title: `${ev.brand} · ${ev.title}`,
      description: `${ev.discount} · ${ev.period}`,
      imageUrl,
      link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
    },
    buttons: [{ title: "이벤트 보러가기", link: { mobileWebUrl: shareUrl, webUrl: shareUrl } }],
  });
}

/* ---------- 모바일 OS 감지 + "앱으로 열기 시도 → 실패하면 스토어로" 공통 로직 ----------
   커스텀 URL 스킴(fb://, twitter:// 등)은 앱이 없을 때 그냥 조용히 아무 반응 없이 실패하는
   경우가 많아 신뢰하기 어렵다는 걸 확인했음. 대신 표준 웹 URL(sharer.php, intent/tweet)은
   실제로 유니버설 링크로 등록돼 있어서, 그 자체가 이미 "앱 설치돼 있으면 앱으로 자동 전환"
   되는 걸 활용한다. 그 다음 짧은 시간 안에 페이지가 여전히 떠 있으면(=앱으로 전환 안 됨)
   앱이 없는 것으로 보고 스토어로 보낸다. */
function getMobileOS() {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return null;
}

function openAppElseStore(appUrl, storeUrlAndroid, storeUrlIOS) {
  const os = getMobileOS();
  if (!os) {
    // 데스크톱: instagram:// 같은 커스텀 스킴은 브라우저가 처리 못 해서 빈 탭만 뜬다.
    // 실제 웹 URL(http/https)일 때만 새 탭으로 열고, 커스텀 스킴이면 아무것도 하지 않는다
    // (인스타그램처럼 데스크톱 공유 대상이 애초에 없는 경우 — 클립보드 복사 안내만으로 충분).
    if (/^https?:\/\//.test(appUrl)) {
      window.open(appUrl, "_blank", "noopener,noreferrer");
    }
    return;
  }
  const storeUrl = os === "android" ? storeUrlAndroid : storeUrlIOS;
  let left = false;
  const markLeft = () => { left = true; };
  document.addEventListener("visibilitychange", markLeft, { once: true });
  window.addEventListener("pagehide", markLeft, { once: true });
  window.location.href = appUrl;
  setTimeout(() => {
    if (!left) window.location.href = storeUrl; // 앱으로 안 넘어갔다 = 미설치로 판단, 스토어로
  }, 1500);
}

const APP_STORE_LINKS = {
  facebook: { android: "https://play.google.com/store/apps/details?id=com.facebook.katana", ios: "https://apps.apple.com/app/facebook/id284882215" },
  x: { android: "https://play.google.com/store/apps/details?id=com.twitter.android", ios: "https://apps.apple.com/app/x/id333903271" },
  instagram: { android: "https://play.google.com/store/apps/details?id=com.instagram.android", ios: "https://apps.apple.com/app/instagram/id389801252" },
};

/* ---------- 공유하기: 인스타그램/페이스북/X(트위터)/카카오톡 실제 앱 아이콘 스타일 그리드 ---------- */
function openShareFlow(ev) {
  const shareUrl = getEventShareUrl(ev);
  // 카카오톡 버튼을 누른 "그 순간"에 SDK 로딩(네트워크 요청)이 시작되면, 로딩이 끝나고
  // Kakao.Share.sendDefault()가 실제로 실행될 땐 탭(사용자 제스처) 시점에서 시간이 좀
  // 지나있게 된다. PC 브라우저는 이 정도 지연에 관대해서 로그인 팝업이라도 뜨지만,
  // 모바일 브라우저(특히 iOS Safari)는 훨씬 엄격해서 그 사이 지연이 있으면 앱 전환/팝업을
  // 조용히 막아버린다 — 그래서 PC에선 되는데 폰에서는 반응이 없는 증상으로 나타났다.
  // 공유 시트를 여는 시점에 미리 백그라운드로 로딩을 걸어두면(에러는 무시—실제 실패
  // 처리는 클릭 시점에 shareToKakao에서 함), 사용자가 카카오톡 버튼을 누를 때쯤엔 이미
  // 로딩이 끝나있어서 탭과 거의 동시에 실행된다.
  loadKakaoShareSdk().catch(() => {});
  openShareMenu(ev, shareUrl);
}

function openShareMenu(ev, shareUrl) {
  const grid = document.getElementById("sharePlatformGrid");
  const platforms = [
    {
      id: "instagram", label: "Instagram",
      bg: "linear-gradient(45deg,#F58529,#FEDA77,#DD2A7B,#8134AF,#515BD4)",
      svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><rect x="2" y="2" width="20" height="20" rx="6" stroke="white" stroke-width="1.8"/><circle cx="12" cy="12" r="4.2" stroke="white" stroke-width="1.8"/><circle cx="17.4" cy="6.6" r="1.1" fill="white"/></svg>`,
    },
    {
      id: "facebook", label: "Facebook", bg: "#1877F2",
      svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M15.5 8.5h-2c-.3 0-.5.2-.5.5v2h2.4l-.3 2.5H13v7h-3v-7H8v-2.5h2v-2.2c0-2 1.2-3.3 3.4-3.3h2.1v2.5Z" fill="white"/></svg>`,
    },
    {
      id: "x", label: "X", bg: "#000",
      svg: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none"><path d="M13.6 10.6 20 3h-2l-5.4 6.1L8.1 3H3l6.7 9.4L3 20h2l5.7-6.5L15.9 20H21l-7.4-9.4Zm-2 2.3-.7-1L5.9 4.6h2.1l4.2 5.9.7 1 5.5 7.7h-2.1l-4.5-6.3Z" fill="white"/></svg>`,
    },
    {
      id: "kakao", label: "KakaoTalk", bg: "#FEE500",
      svg: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none"><path d="M12 4C6.9 4 2.8 7.2 2.8 11.1c0 2.5 1.7 4.7 4.2 6-.2.7-.8 2.6-.9 3-.1.5.2.5.4.4.2-.1 2.4-1.6 3.4-2.3.7.1 1.4.2 2.1.2 5.1 0 9.2-3.2 9.2-7.1S17.1 4 12 4Z" fill="#191919"/></svg>`,
    },
  ];

  grid.innerHTML = platforms.map(p => `
    <button type="button" class="share-platform-btn" data-platform="${p.id}">
      <span class="share-platform-icon" style="background:${p.bg};">${p.svg}</span>
      <span class="share-platform-label">${p.label}</span>
    </button>
  `).join("");

  grid.querySelectorAll(".share-platform-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const platform = btn.dataset.platform;
      const text = encodeURIComponent(`${ev.brand} · ${ev.title} — ${ev.discount}`);
      const url = encodeURIComponent(shareUrl);

      if (platform === "kakao") {
        try { await shareToKakao(ev, shareUrl); }
        catch (err) {
          console.error(
            "카카오톡 공유 실패:", err,
            "\n→ 흔한 원인: 카카오 디벨로퍼스에서 이 앱에 '카카오톡 공유' 제품이 활성화 안 됐거나,\n" +
            "  Web 플랫폼 도메인 등록이 안 돼 있을 수 있어요(지도 SDK 문제와 같은 원인 계열)."
          );
          showToast("카카오톡 공유를 불러오지 못했어요.");
        }
      } else if (platform === "facebook") {
        // sharer.php는 유니버설 링크로 등록돼 있어 앱 설치 시 자동으로 앱이 뜨고,
        // 앱이 없으면 페이지에 남아있는 걸 감지해서 스토어로 보낸다.
        openAppElseStore(`https://www.facebook.com/sharer/sharer.php?u=${url}`, APP_STORE_LINKS.facebook.android, APP_STORE_LINKS.facebook.ios);
      } else if (platform === "x") {
        openAppElseStore(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, APP_STORE_LINKS.x.android, APP_STORE_LINKS.x.ios);
      } else if (platform === "instagram") {
        // 인스타그램은 피드/스토리에 외부 링크를 직접 공유하는 웹 API가 없어서
        // (게시물 작성은 앱에서만 가능), 링크를 복사한 뒤 앱을 직접 열어준다(없으면 스토어로).
        try {
          await navigator.clipboard.writeText(shareUrl);
          showToast("링크가 복사됐어요! 인스타그램 스토리·DM에 붙여넣어 공유해보세요 📸");
        } catch { showToast(`링크: ${shareUrl}`); }
        openAppElseStore("instagram://app", APP_STORE_LINKS.instagram.android, APP_STORE_LINKS.instagram.ios);
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
  // ⚠️ 예전엔 브랜드+제목으로 텍스트 검색을 했는데("스타벅스 SUMMER2 프로모션"),
  // "SUMMER2 프로모션" 같은 캠페인명은 실제 장소명이 아니라서 네이버지도가 엉뚱한
  // 곳을 검색 결과로 보여주거나 검색 결과 목록만 뜨는 문제가 있었다. 카카오맵
  // 버튼(getKakaoRouteLink)처럼 좌표 기반으로 바꿔서 항상 실제 이벤트 위치로
  // 고정되게 한다. (네이버는 공식적으로 앱 전용 URL Scheme(nmap://)만 문서화하고
  // 있고, 앱 미설치 환경까지 고려한 웹 링크는 공식 문서가 없어 커뮤니티에서 널리
  // 쓰이는 좌표 기반 웹 링크 형식을 사용한다 — 배포 후 실제 기기에서 한 번 눌러
  // 확인해보는 걸 권장한다.)
  return `https://map.naver.com/p?lat=${ev.lat}&lng=${ev.lng}&title=${encodeURIComponent(ev.brand)}`;
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
// ⚠️ history.back()은 비동기다 — 호출한 그 자리에서 즉시 히스토리가 줄어드는 게 아니라,
// 브라우저가 나중 시점에 popstate를 발생시키며 처리한다. 그런데 "닫고 나서 다른 화면을
// 다시 연다"(예: 지갑 닫고 프로필 재오픈) 같은 경우, back() 호출 직후 같은 틱 안에서
// pushModalHistory가 또 호출돼 history.pushState()가 실행되곤 했다 — 아직 처리 안 된
// back()과 그 직후의 pushState()가 서로 경합하면서, 실제 브라우저 히스토리 깊이가
// 우리가 추적하는 것보다 계속 줄어드는 문제가 있었다. 여러 화면을 오가다 보면 이게
// 누적되어, 결국 뒤로가기/X 버튼이 앱의 히스토리를 다 지나쳐 앱 자체를 벗어나버리는
// 심각한 버그로 이어졌다. 이 플래그가 켜져 있으면 pushModalHistory가 pushState 대신
// replaceState를 쓴다 — replaceState는 완전히 동기적이라 경합 자체가 생기지 않는다.
let nextPushShouldReplace = false;

function pushModalHistory(closeFn, url) {
  modalCloseStack.push(closeFn);
  if (nextPushShouldReplace) {
    nextPushShouldReplace = false;
    history.replaceState({ eventhubModalDepth: modalCloseStack.length }, "", url || location.href);
  } else {
    history.pushState({ eventhubModalDepth: modalCloseStack.length }, "", url || location.href);
  }
}

// 버튼/바깥영역 클릭 등 "UI 조작으로" 모달을 닫을 때 호출.
// 실제 화면을 닫는 로직(예: closeSheet())은 호출한 쪽에서 이미 실행했다고 가정하고,
// 여기서는 히스토리 스택만 정리한다.
//
// closeFn이 순수하게 "닫기"만 한다면 history.back()으로 이전 URL을 복원한다. 하지만
// closeFn 안에서 (wrapTopModalClose로 걸어둔) "닫고 나서 다른 화면을 새로 연다"가
// 실행되면, 그 화면이 자체적으로 pushModalHistory를 호출해 스택 깊이가 다시 늘어난다
// — 이 경우엔 back()을 부르면 안 된다(위 설명 참고). 실행 전후로 스택 깊이를 비교해서
// 어느 쪽인지 판단한다.
function popModalHistory() {
  if (modalCloseStack.length === 0) return;
  const closeFn = modalCloseStack.pop();
  const depthBeforeClose = modalCloseStack.length;
  nextPushShouldReplace = true; // closeFn이 뭔가 새로 열면 그 push가 replaceState를 쓰게 함
  closeFn();
  if (modalCloseStack.length === depthBeforeClose) {
    // closeFn이 새로 아무것도 안 열었다 — 순수하게 "닫기"였으므로 진짜로 뒤로가기 처리
    nextPushShouldReplace = false; // 안 쓰였을 수 있으니 다음 무관한 push에 영향 안 주게 정리
    suppressNextPopstate = true;
    history.back();
  }
  // else: closeFn 안에서 이미 새 화면이 replaceState로 열렸으므로 여기서 더 손댈 게 없다.
}

// ── 스택 맨 위 닫기 함수를 "닫힌 뒤 추가로 이걸 한다"와 합쳐서 교체한다.
// openFromProfile()이 원래 이 로직을 자체적으로 갖고 있었는데, 상세시트가 목록 화면
// 위에서 열릴 때도 똑같은 패턴이 필요해져서 공용 함수로 뺐다.
function wrapTopModalClose(afterCloseFn) {
  if (modalCloseStack.length === 0) return;
  const originalClose = modalCloseStack[modalCloseStack.length - 1];
  modalCloseStack[modalCloseStack.length - 1] = () => {
    originalClose();
    afterCloseFn();
  };
}

// ── 어떤 모달형 화면(A)에서 다른 화면(B)으로 "이동"할 때 공통으로 쓴다(닫는 게 아니라
// 대체하는 것). B를 닫으면 정확히 A로 돌아가야 하는데, A가 어떻게 열렸는지(프로필 메뉴를
// 거쳤는지, 하단 탭을 바로 눌렀는지, 목록 화면에서 항목을 눌러 들어왔는지 등)는 매번
// 다를 수 있다. 그래서 "지금 스택 맨 위에 있던 게 뭐였는지"를 그대로 캡처해뒀다가, B가
// 닫힐 때 A를 다시 열고 캡처해둔 걸 그대로 복원한다 — 그러면 A가 프로필/다른 화면에서
// 열렸었다면 그 관계도 끊기지 않고 그대로 이어진다. 즉 "어디서 들어왔든 닫으면 들어왔던
// 곳으로 돌아간다"가 화면이 몇 단계로 이어져 있든 항상 성립한다.
//   closeCurrentFn: 지금 화면(A)을 닫는 함수
//   openTargetFn: 새로 열 화면(B)을 여는 함수 — 내부에서 pushModalHistory를 호출해야 함
//   reopenCurrentFn: B가 닫힐 때 다시 A를 여는 함수 — openCalendar()처럼 비동기(async)일 수
//   있어 await로 처리한다
//
// ⚠️ closeCurrentFn()과 openTargetFn()을 각각 따로 실행하면 popModalHistory와 무관하게
// history.back()이 끼어들 틈이 없어 보이지만, 예전 버전은 popModalHistorySilent()(내부적
// 으로 history.back() 호출)를 부른 "직후" 같은 틱에서 openTargetFn()이 pushModalHistory로
// pushState를 또 호출해 위에서 설명한 것과 동일한 경합이 있었다. 이제는 "닫고+연다"를
// 하나의 closeFn으로 합쳐서 popModalHistory() 한 번에 맡긴다 — popModalHistory()가
// 스스로 depth 변화를 감지해 안전하게 replaceState로 처리해준다.
function navigateReplacingScreen(closeCurrentFn, openTargetFn, reopenCurrentFn) {
  const capturedEntry = modalCloseStack.length > 0
    ? modalCloseStack[modalCloseStack.length - 1]
    : null;

  if (modalCloseStack.length > 0) {
    modalCloseStack[modalCloseStack.length - 1] = () => {
      closeCurrentFn();
      openTargetFn();
    };
    popModalHistory();
  } else {
    // 스택이 비어있는 예외적인 경우 — popModalHistory를 거칠 대상이 없으므로 그냥 순서대로 처리
    closeCurrentFn();
    openTargetFn();
  }

  wrapTopModalClose(async () => {
    await reopenCurrentFn();
    if (capturedEntry) {
      modalCloseStack[modalCloseStack.length - 1] = capturedEntry;
    }
  });
}

// ── "찜한 이벤트/최근 본 이벤트/캘린더/알림" 같은 목록 화면에서 항목을 눌러 상세시트를
// 열 때 쓰는 편의 함수. navigateReplacingScreen의 특수한 형태(대상 화면이 항상 상세시트).
function openSheetFromParentScreen(eventId, closeParentFn, reopenParentFn) {
  navigateReplacingScreen(closeParentFn, () => openSheet(eventId), reopenParentFn);
}

window.addEventListener("popstate", () => {
  if (suppressNextPopstate) {
    suppressNextPopstate = false;
    return;
  }
  // 시스템 뒤로가기(제스처/버튼)가 눌린 경우: 가장 최근에 연 모달을 닫는다.
  // closeFn이 (wrapTopModalClose로 걸린) 재오픈까지 포함하고 있다면, 그 재오픈이
  // 새로 쌓는 히스토리는 pushState 대신 replaceState를 쓰게 한다 — 그래야 뒤로가기
  // 한 번이 실제로 한 단계만 이동한 것과 일치한다(위 popModalHistory 설명 참고).
  if (modalCloseStack.length > 0) {
    const closeFn = modalCloseStack.pop();
    nextPushShouldReplace = true;
    closeFn();
    nextPushShouldReplace = false; // closeFn이 아무것도 새로 안 열었다면 다음 무관한 push에 영향 안 주게 정리
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