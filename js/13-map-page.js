/* =========================================================
   지도 페이지 — "원하는 지역에서 이벤트를 직접 탐색하는" 검색 도구
   =========================================================
   홈 하단탭 "주변 이벤트" / 헤더 지도아이콘 / "지도에서 더 찾아보기"로 진입.

   핵심 UX (네이버지도의 "현 지도에서 검색" 패턴):
     지도 진입 → 현재 위치 주변 이벤트 표시
       → 사용자가 지도를 원하는 지역으로 이동 (이때는 리스트 안 바뀜)
       → [📍 현재 지역에서 찾기] 버튼 표시
       → 클릭 시에만 현재 지도 화면 영역(Bounds) 안의 이벤트 재검색
       → 마커 + 리스트 동시 갱신 (항상 같은 데이터 상태 공유)

   ⚠️ 가상 데이터 안내
   실제 좌표 있는 이벤트가 아직 적어서, 지도가 휑하지 않도록 MOCK_MAP_EVENTS를
   같이 섞어 보여준다. id가 "mock-"으로 시작하며 실제 이벤트와 같은 스키마.
   실제 이벤트가 늘어나면 MOCK_MAP_EVENTS 항목만 지우면 된다.
   ========================================================= */

const MOCK_MAP_EVENTS = [
  {
    id: "mock-map-seongsu",
    category: "popup",
    brand: "[예시] 스튜디오 언노운",
    merchantType: "브랜드",
    isVerifiedReal: false,
    lat: 37.5445,
    lng: 127.0559,
    title: "[예시] 성수동 컨셉 팝업스토어",
    subtitle: "실제 이벤트 승인 시 자동으로 교체돼요",
    discount: "체험형 팝업 · 굿즈 판매",
    period: "2026.08.01 - 2026.08.31",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-31",
    channel: "서울 성동구 성수동 일대",
    conditions: "",
    desc: "지도 페이지 레이아웃 확인을 위한 예시 데이터입니다. 성수동 지역에 실제 팝업이 승인되면 이 자리에 실제 정보로 대체됩니다.",
    tags: ["팝업", "성수동"],
    image: MOCK_IMAGE_PLACEHOLDER(),
    domain: "",
    link: "",
  },
  {
    id: "mock-map-hongdae",
    category: "fashion",
    brand: "[예시] 홍대 스트릿 편집숍",
    merchantType: "브랜드",
    isVerifiedReal: false,
    lat: 37.5563,
    lng: 126.9236,
    title: "[예시] 홍대 스트릿패션 기획전",
    subtitle: "실제 이벤트 승인 시 자동으로 교체돼요",
    discount: "최대 40% 할인",
    period: "2026.08.05 - 2026.08.20",
    periodStart: "2026-08-05",
    periodEnd: "2026-08-20",
    channel: "서울 마포구 홍대 일대",
    conditions: "",
    desc: "지도 페이지 레이아웃 확인을 위한 예시 데이터입니다. 홍대 지역에 실제 이벤트가 승인되면 이 자리에 실제 정보로 대체됩니다.",
    tags: ["패션", "홍대"],
    image: MOCK_IMAGE_PLACEHOLDER(),
    domain: "",
    link: "",
  },
  {
    id: "mock-map-thehyundai",
    category: "beauty",
    brand: "[예시] 더현대서울 뷰티관",
    merchantType: "브랜드",
    isVerifiedReal: false,
    lat: 37.5259,
    lng: 126.9295,
    title: "[예시] 더현대서울 뷰티 팝업",
    subtitle: "실제 이벤트 승인 시 자동으로 교체돼요",
    discount: "구매 시 미니어처 증정",
    period: "2026.08.10 - 2026.08.24",
    periodStart: "2026-08-10",
    periodEnd: "2026-08-24",
    channel: "서울 영등포구 여의도 더현대서울",
    conditions: "",
    desc: "지도 페이지 레이아웃 확인을 위한 예시 데이터입니다. 더현대서울 지역에 실제 이벤트가 승인되면 이 자리에 실제 정보로 대체됩니다.",
    tags: ["뷰티", "더현대서울"],
    image: MOCK_IMAGE_PLACEHOLDER(),
    domain: "",
    link: "",
  },
  {
    id: "mock-map-hannam",
    category: "food",
    brand: "[예시] 한남동 디저트 카페",
    merchantType: "소상공인",
    isVerifiedReal: false,
    lat: 37.5347,
    lng: 127.0007,
    title: "[예시] 한남동 신메뉴 출시 이벤트",
    subtitle: "실제 이벤트 승인 시 자동으로 교체돼요",
    discount: "1+1",
    period: "2026.08.01 - 2026.08.15",
    periodStart: "2026-08-01",
    periodEnd: "2026-08-15",
    channel: "서울 용산구 한남동 일대",
    conditions: "",
    desc: "지도 페이지 레이아웃 확인을 위한 예시 데이터입니다. 한남동 지역에 실제 이벤트가 승인되면 이 자리에 실제 정보로 대체됩니다.",
    tags: ["카페", "한남동"],
    image: MOCK_IMAGE_PLACEHOLDER(),
    domain: "",
    link: "",
  },
  {
    id: "mock-map-gangnam",
    category: "living",
    brand: "[예시] 강남역 라이프스타일관",
    merchantType: "브랜드",
    isVerifiedReal: false,
    lat: 37.4979,
    lng: 127.0276,
    title: "[예시] 강남역 라이프스타일 기획전",
    subtitle: "실제 이벤트 승인 시 자동으로 교체돼요",
    discount: "전 품목 20%",
    period: "2026.08.03 - 2026.08.17",
    periodStart: "2026-08-03",
    periodEnd: "2026-08-17",
    channel: "서울 강남구 강남역 일대",
    conditions: "",
    desc: "지도 페이지 레이아웃 확인을 위한 예시 데이터입니다. 강남역 지역에 실제 이벤트가 승인되면 이 자리에 실제 정보로 대체됩니다.",
    tags: ["라이프스타일", "강남역"],
    image: MOCK_IMAGE_PLACEHOLDER(),
    domain: "",
    link: "",
  },
];

// 외부 이미지 서버에 의존하지 않는 회색 플레이스홀더 (네트워크 실패 걱정 없음)
function MOCK_IMAGE_PLACEHOLDER() {
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23E8E8EC'/%3E%3C/svg%3E";
}

/* ---------- 지역 검색용 좌표 사전 ----------
   검색창에 지역명을 치면 그 지역으로 지도를 옮기기 위한 최소 사전.
   (서버 지오코딩 없이 브라우저에서 즉시 반응하도록 자주 찾는 지역만 하드코딩.
    사전에 없는 지역은 검색어가 이벤트 텍스트 매칭으로만 동작.) */
const MAP_REGION_COORDS = {
  "성수": { lat: 37.5445, lng: 127.0559, level: 5 },
  "성수동": { lat: 37.5445, lng: 127.0559, level: 5 },
  "홍대": { lat: 37.5563, lng: 126.9236, level: 5 },
  "연남": { lat: 37.5602, lng: 126.9250, level: 5 },
  "연남동": { lat: 37.5602, lng: 126.9250, level: 5 },
  "강남": { lat: 37.4979, lng: 127.0276, level: 5 },
  "강남역": { lat: 37.4979, lng: 127.0276, level: 5 },
  "압구정": { lat: 37.5274, lng: 127.0286, level: 5 },
  "한남": { lat: 37.5347, lng: 127.0007, level: 5 },
  "한남동": { lat: 37.5347, lng: 127.0007, level: 5 },
  "여의도": { lat: 37.5259, lng: 126.9295, level: 5 },
  "더현대": { lat: 37.5259, lng: 126.9295, level: 5 },
  "잠실": { lat: 37.5133, lng: 127.1001, level: 5 },
  "이태원": { lat: 37.5346, lng: 126.9945, level: 5 },
  "명동": { lat: 37.5637, lng: 126.9838, level: 5 },
  "가로수길": { lat: 37.5203, lng: 127.0227, level: 5 },
  "부산": { lat: 35.1796, lng: 129.0756, level: 8 },
  "해운대": { lat: 35.1587, lng: 129.1604, level: 6 },
  "대구": { lat: 35.8714, lng: 128.6014, level: 8 },
  "인천": { lat: 37.4563, lng: 126.7052, level: 8 },
  "제주": { lat: 33.4996, lng: 126.5312, level: 9 },
};

/* ---------- 상태 ----------
   지도와 리스트는 반드시 이 단일 상태를 공유한다. 따로 관리 금지. */
let mapPageKakaoMapInstance = null;
let mapPageMarkers = [];
let mapPageCurrentCategory = "all";
let mapPageSearchTerm = "";
let mapPageResults = [];        // 현재 검색 결과 (지도+리스트 공통 데이터)
let mapPageVisibleCount = 20;   // 리스트/마커에 현재까지 표시 중인 개수
const MAP_PAGE_PAGE_SIZE = 20;
let mapPageMoved = false;       // 지도를 움직였는지 (버튼 표시용)
let mapPageInitialized = false;

function getMapPageAllEvents() {
  const realOnes = (typeof EVENTS !== "undefined" ? EVENTS : [])
    .filter(ev => isEventLive(ev) && ev.lat != null && ev.lng != null);
  return [...realOnes, ...MOCK_MAP_EVENTS];
}

/* ---------- 검색 실행: 현재 지도 Bounds + 카테고리 + 검색어 기준 ----------
   1순위: 현재 지도 화면 영역 안의 이벤트
   2순위: 검색어가 있으면 브랜드/제목/태그/채널 텍스트 매칭 추가 적용 */
function runMapPageSearch() {
  const all = getMapPageAllEvents();

  let filtered = all;

  // 카테고리 필터
  if (mapPageCurrentCategory !== "all") {
    filtered = filtered.filter(ev => ev.category === mapPageCurrentCategory);
  }

  // 검색어 필터 (브랜드/제목/태그/채널/혜택)
  if (mapPageSearchTerm) {
    const q = mapPageSearchTerm.toLowerCase();
    filtered = filtered.filter(ev =>
      (ev.brand || "").toLowerCase().includes(q) ||
      (ev.title || "").toLowerCase().includes(q) ||
      (ev.channel || "").toLowerCase().includes(q) ||
      (ev.discount || "").toLowerCase().includes(q) ||
      (ev.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  // 현재 지도 화면 영역(Bounds) 필터 — 지도가 준비된 경우에만
  if (mapPageKakaoMapInstance) {
    try {
      const bounds = mapPageKakaoMapInstance.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      filtered = filtered.filter(ev =>
        ev.lat >= sw.getLat() && ev.lat <= ne.getLat() &&
        ev.lng >= sw.getLng() && ev.lng <= ne.getLng()
      );
    } catch (e) { /* 지도 미준비 시 전체 사용 */ }
  }

  mapPageResults = filtered;
  mapPageVisibleCount = MAP_PAGE_PAGE_SIZE;
  renderMapPageResults();
  hideMapRefreshBtn();
}

/* ---------- 렌더링: 리스트 + 마커를 같은 데이터로 동시 갱신 ---------- */
function renderMapPageResults() {
  const visible = mapPageResults.slice(0, mapPageVisibleCount);
  renderMapPageList(visible, mapPageResults.length);
  renderMapPageMarkers(visible);

  const moreBtn = document.getElementById("mapPageMoreBtn");
  moreBtn.hidden = mapPageResults.length <= mapPageVisibleCount;
}

function renderMapPageList(events, totalCount) {
  const listEl = document.getElementById("mapPageList");
  const countEl = document.getElementById("mapPageListCount");
  countEl.textContent = totalCount > 0 ? `${totalCount}개` : "";

  if (events.length === 0) {
    listEl.innerHTML = `<p class="map-page-empty">이 지역에는 표시할 이벤트가 없어요.<br>지도를 이동한 뒤 '현재 지역에서 찾기'를 눌러보세요.</p>`;
    return;
  }
  listEl.innerHTML = events.map(ev => `
    <div class="map-page-list-item" data-id="${ev.id}">
      <img class="map-page-list-thumb" src="${ev.image}" alt="" loading="lazy" onerror="handleImageError(this)">
      <div class="map-page-list-body">
        <p class="map-page-list-brand">${escapeHtml(ev.brand)}${ev.id.startsWith("mock-") ? '<span class="map-page-mock-badge">예시</span>' : ""}</p>
        <p class="map-page-list-title">${escapeHtml(ev.title)}</p>
        <p class="map-page-list-meta">${escapeHtml(ev.discount || "")} · ${escapeHtml(ev.channel || "")}</p>
      </div>
    </div>
  `).join("");

  listEl.querySelectorAll(".map-page-list-item").forEach(item => {
    item.addEventListener("click", () => {
      const ev = mapPageResults.find(e => e.id === item.dataset.id);
      if (!ev) return;
      if (ev.id.startsWith("mock-")) {
        showToast("예시 데이터예요 — 실제 이벤트가 승인되면 상세페이지로 연결돼요.");
        return;
      }
      closeMapPage();
      popModalHistory();
      openSheet(ev.id);
    });
  });
}

function renderMapPageMarkers(events) {
  if (!mapPageKakaoMapInstance) return;

  mapPageMarkers.forEach(m => m.setMap(null));
  mapPageMarkers = [];

  events.forEach(ev => {
    const pos = new kakao.maps.LatLng(ev.lat, ev.lng);
    const marker = new kakao.maps.Marker({ position: pos, map: mapPageKakaoMapInstance });

    kakao.maps.event.addListener(marker, "click", () => {
      // 마커 클릭 → 해당 리스트 카드 강조 + 스크롤 + 지도 중심 이동
      document.querySelectorAll(".map-page-list-item").forEach(el => el.classList.remove("active-pin"));
      const listItem = document.querySelector(`.map-page-list-item[data-id="${ev.id}"]`);
      if (listItem) {
        listItem.classList.add("active-pin");
        listItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      mapPageKakaoMapInstance.panTo(pos);
    });

    mapPageMarkers.push(marker);
  });
}

/* ---------- "현재 지역에서 찾기" 버튼 ----------
   지도 이동(idle) 감지 시 표시. 이동 중에는 리스트를 절대 자동 갱신하지 않는다. */
function showMapRefreshBtn() {
  if (!mapPageMoved) return;
  document.getElementById("mapRefreshBtn").hidden = false;
}
function hideMapRefreshBtn() {
  mapPageMoved = false;
  document.getElementById("mapRefreshBtn").hidden = true;
}

/* ---------- 페이지 열기/닫기 ---------- */
async function openMapPage() {
  document.getElementById("mapPageOverlay").classList.add("open");
  pushModalHistory(closeMapPage);
  renderMapPageFilters();
  await initMapPageMap();
  runMapPageSearch();
}

function closeMapPage() {
  document.getElementById("mapPageOverlay").classList.remove("open");
  // 하단탭 활성 상태를 홈으로 복원 (지도 진입이 하단탭에서 이뤄졌을 수 있음)
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  const homeBtn = document.querySelector('.nav-item[data-nav="home"]');
  if (homeBtn) homeBtn.classList.add("active");
}

/* ---------- 지도 초기화: 현재 위치 기준 시작 ---------- */
async function initMapPageMap() {
  const mapEl = document.getElementById("mapPageKakaoMap");

  try {
    await loadKakaoMapSdk();

    if (!mapPageInitialized) {
      // 현재 사용자 위치(거부/실패 시 서울시청)로 시작
      const loc = await getQuietLocation();
      mapPageKakaoMapInstance = new kakao.maps.Map(mapEl, {
        center: new kakao.maps.LatLng(loc.lat, loc.lng),
        level: 7,
      });

      // 지도 이동/확대축소 감지 → "현재 지역에서 찾기" 버튼 표시
      // (idle: 드래그/줌이 끝나서 지도가 멈춘 시점에 1회 발생)
      kakao.maps.event.addListener(mapPageKakaoMapInstance, "idle", () => {
        showMapRefreshBtn();
      });
      kakao.maps.event.addListener(mapPageKakaoMapInstance, "dragstart", () => {
        mapPageMoved = true;
      });
      kakao.maps.event.addListener(mapPageKakaoMapInstance, "zoom_changed", () => {
        mapPageMoved = true;
      });

      mapPageInitialized = true;
    } else {
      // 재진입 시 지도 크기 재계산 (display:none 상태에서 초기화됐을 수 있음)
      mapPageKakaoMapInstance.relayout();
    }

  } catch (err) {
    console.error(
      "지도 페이지 카카오맵 로드 오류:", err,
      "\n→ 가장 흔한 원인: 카카오 디벨로퍼스 콘솔의 [플랫폼 키 > JavaScript 키 > JavaScript SDK 도메인]에\n" +
      "  이 배포 도메인(https://krasia-eventhub-eventhub2.vercel.app)이 등록 안 된 경우입니다."
    );
    mapEl.innerHTML = `<div class="map-page-map-status">지도를 불러오지 못했어요. 아래 목록으로 확인해주세요.</div>`;
  }
}

/* ---------- 카테고리 필터 ---------- */
function renderMapPageFilters() {
  const row = document.getElementById("mapPageFilterRow");
  const cats = [
    { id: "all", label: "전체" },
    { id: "popup", label: "팝업·컬처" },
    { id: "fashion", label: "패션" },
    { id: "beauty", label: "뷰티" },
    { id: "food", label: "카페·디저트" },
    { id: "living", label: "라이프스타일" },
  ];
  row.innerHTML = cats.map(c => `
    <button type="button" class="map-page-filter-chip ${mapPageCurrentCategory === c.id ? "active" : ""}" data-cat="${c.id}">${c.label}</button>
  `).join("");
  row.querySelectorAll(".map-page-filter-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      mapPageCurrentCategory = btn.dataset.cat;
      renderMapPageFilters();
      runMapPageSearch(); // 카테고리 변경은 마커+리스트에 즉시 반영
    });
  });
}

/* ---------- 검색창 ----------
   지역명이면 지도 이동 → 그 지역 검색, 아니면 텍스트 매칭 검색 */
function handleMapPageSearch() {
  const input = document.getElementById("mapPageSearchInput");
  const raw = input.value.trim();
  document.getElementById("mapPageSearchClear").hidden = raw === "";

  // "성수 팝업"처럼 지역+키워드 조합: 첫 단어가 지역 사전에 있으면 지도 이동 + 나머지는 검색어
  const words = raw.split(/\s+/).filter(Boolean);
  let regionMatch = null;
  let restWords = words;

  if (words.length > 0 && MAP_REGION_COORDS[words[0]]) {
    regionMatch = MAP_REGION_COORDS[words[0]];
    restWords = words.slice(1);
  }

  mapPageSearchTerm = restWords.join(" ");

  if (regionMatch && mapPageKakaoMapInstance) {
    mapPageKakaoMapInstance.setLevel(regionMatch.level);
    mapPageKakaoMapInstance.setCenter(new kakao.maps.LatLng(regionMatch.lat, regionMatch.lng));
    // 지도 이동 직후 그 지역 기준으로 바로 검색 실행 (버튼 누를 필요 없이)
    setTimeout(() => runMapPageSearch(), 150);
  } else {
    runMapPageSearch();
  }
}

/* ---------- 이벤트 리스너 ---------- */
document.getElementById("mapPageOpenBtn").addEventListener("click", openMapPage);
document.getElementById("mapHeaderBtn").addEventListener("click", openMapPage);
document.getElementById("mapPageClose").addEventListener("click", () => {
  closeMapPage();
  popModalHistory();
});
document.getElementById("mapRefreshBtn").addEventListener("click", runMapPageSearch);
document.getElementById("mapPageMoreBtn").addEventListener("click", () => {
  mapPageVisibleCount += MAP_PAGE_PAGE_SIZE;
  renderMapPageResults();
});
document.getElementById("mapPageSearchInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleMapPageSearch();
});
document.getElementById("mapPageSearchClear").addEventListener("click", () => {
  const input = document.getElementById("mapPageSearchInput");
  input.value = "";
  mapPageSearchTerm = "";
  document.getElementById("mapPageSearchClear").hidden = true;
  runMapPageSearch();
});