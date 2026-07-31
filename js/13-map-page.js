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
let mapPageHasMoreContent = false; // 콘텐츠상 "더보기"가 필요한지 (시트 위치 조건과 별개로 관리)
const MAP_PAGE_PAGE_SIZE = 20;
let mapPageMoved = false;       // 지도를 움직였는지 (버튼 표시용)
let mapPageInitialized = false;
let mapPageSelectedId = null;   // 현재 선택(강조)된 이벤트 — 마커·리스트가 함께 참조

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

  // 혜택 필터 (홈의 matchesDiscountFilter 로직 그대로 재사용 — 1+1/50%↑/무료·증정/선착순·한정)
  if (mapPageCurrentBenefit !== "all") {
    filtered = filtered.filter(ev => matchesDiscountFilter(ev, mapPageCurrentBenefit));
  }

  // 브랜드 필터 (다중선택, 홈과 동일한 데이터 체계)
  if (mapPageSelectedBrands.size > 0) {
    filtered = filtered.filter(ev => mapPageSelectedBrands.has(ev.brand));
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

  // 인기순(조회수·좋아요 기반) 정렬 — 지도 마커의 순위 배지가 이 순서를 따른다.
  // 가상(mock) 이벤트는 통계가 없어 자연스럽게 뒤로 밀린다.
  mapPageResults.sort((a, b) => {
    const scoreOf = (ev) => (typeof getEventScore === "function" && !ev.id.startsWith("mock-")) ? getEventScore(ev.id) : 0;
    return scoreOf(b) - scoreOf(a);
  });

  mapPageVisibleCount = MAP_PAGE_PAGE_SIZE;
  mapPageSelectedId = null;
  renderMapPageResults();
  hideMapRefreshBtn();
}

/* ---------- 렌더링: 리스트 + 마커를 같은 데이터로 동시 갱신 ---------- */
function renderMapPageResults() {
  const visible = mapPageResults.slice(0, mapPageVisibleCount);
  renderMapPageList(visible, mapPageResults.length);
  renderMapPageMarkers(visible);

  mapPageHasMoreContent = mapPageResults.length > mapPageVisibleCount;
  updateMapMoreBtnVisibility();
}

/* "더 많은 이벤트 보기" 버튼: 콘텐츠가 더 있어도(mapPageHasMoreContent), 시트가 하단(collapsed)
   근처로 접혀서 리스트가 거의 안 보이는 상태면 굳이 안 보여준다 — 중단·상단일 때만 노출. */
function updateMapMoreBtnVisibility() {
  const moreBtn = document.getElementById("mapPageMoreBtn");
  const sheetNearCollapsed = mapSheetHeight <= MAP_SHEET_SNAP.collapsed + 20;
  moreBtn.hidden = !mapPageHasMoreContent || sheetNearCollapsed;
}

function renderMapPageList(events, totalCount) {
  const listEl = document.getElementById("mapPageList");
  const countEl = document.getElementById("mapPageListCount");
  countEl.textContent = totalCount > 0 ? `${totalCount}개` : "";

  if (events.length === 0) {
    listEl.innerHTML = `<p class="map-page-empty">이 지역에는 표시할 이벤트가 없어요.<br>지도를 이동한 뒤 '현재 지역에서 찾기'를 눌러보세요.</p>`;
    return;
  }
  // 네이버지도의 "인기 장소" 2열 그리드를 참고 — 왼쪽부터 1,2등 순서로 채워짐
  listEl.innerHTML = `<div class="map-page-grid">` + events.map((ev, idx) => `
    <div class="map-card ${mapPageSelectedId === ev.id ? "active-pin" : ""}" data-id="${ev.id}">
      <div class="map-card-media">
        <img class="map-card-thumb" src="${getEventThumbnail(ev)}" alt="" loading="lazy" onerror="handleImageError(this)">
        <span class="map-card-rank ${idx < 3 ? "top" : ""}">${idx + 1}</span>
        ${ev.id.startsWith("mock-") ? '<span class="map-page-mock-badge map-card-mock-badge">예시</span>' : ""}
      </div>
      <div class="map-card-body">
        <p class="map-card-brand">${escapeHtml(ev.brand)}</p>
        <p class="map-card-title">${escapeHtml(ev.title)}</p>
        <p class="map-card-meta">${escapeHtml(ev.discount || "")}</p>
      </div>
      <button type="button" class="map-card-detail-btn" data-id="${ev.id}" aria-label="상세보기">상세 ›</button>
    </div>
  `).join("") + `</div>`;

  // 카드 본문 클릭 → 상세로 가지 않고, 지도에서 해당 위치를 강조 (네이버지도 패턴)
  listEl.querySelectorAll(".map-card").forEach(item => {
    item.addEventListener("click", () => {
      selectMapPageEvent(item.dataset.id, { scrollList: false });
    });
  });

  // "상세" 버튼만 상세페이지로 — 지도는 닫지 않아서, 상세를 닫으면 지도로 돌아온다
  listEl.querySelectorAll(".map-card-detail-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const ev = mapPageResults.find(x => x.id === btn.dataset.id);
      if (!ev) return;
      if (ev.id.startsWith("mock-")) {
        showToast("예시 데이터예요 — 실제 이벤트가 승인되면 상세페이지로 연결돼요.");
        return;
      }
      openSheet(ev.id);
    });
  });
}

/* ---------- 이벤트 선택 (마커↔리스트 양방향 동기화) ----------
   네이버지도 벤치마킹: 선택된 마커는 커지면서 통통 튀고(bounce),
   리스트의 해당 카드는 하이라이트 + 화면 안으로 스크롤, 지도는 그 위치로 부드럽게 이동 */
function selectMapPageEvent(id, { scrollList = true } = {}) {
  mapPageSelectedId = id;
  const ev = mapPageResults.find(e => e.id === id);

  // 리스트 하이라이트
  document.querySelectorAll(".map-card").forEach(el => {
    el.classList.toggle("active-pin", el.dataset.id === id);
  });
  if (scrollList) {
    const listItem = document.querySelector(`.map-card[data-id="${id}"]`);
    if (listItem) listItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // 마커 강조 (선택된 것만 selected 클래스)
  document.querySelectorAll(".map-marker-badge").forEach(el => {
    el.classList.toggle("selected", el.dataset.id === id);
  });

  // 지도 중심 이동
  if (ev && mapPageKakaoMapInstance) {
    mapPageKakaoMapInstance.panTo(new kakao.maps.LatLng(ev.lat, ev.lng));
  }
}

function renderMapPageMarkers(events) {
  if (!mapPageKakaoMapInstance) return;

  mapPageMarkers.forEach(m => m.setMap(null));
  mapPageMarkers = [];

  events.forEach((ev, idx) => {
    const pos = new kakao.maps.LatLng(ev.lat, ev.lng);

    // 기본 파란 핀 대신, 인기 순위가 한눈에 보이는 숫자 배지 마커 (1~3위는 오렌지로 강조)
    const el = document.createElement("div");
    el.className = `map-marker-badge ${idx < 3 ? "top" : ""} ${mapPageSelectedId === ev.id ? "selected" : ""}`;
    el.dataset.id = ev.id;
    el.textContent = idx + 1;
    el.addEventListener("click", () => selectMapPageEvent(ev.id));

    const overlay = new kakao.maps.CustomOverlay({
      position: pos,
      content: el,
      yAnchor: 1.1,
      clickable: true,
    });
    overlay.setMap(mapPageKakaoMapInstance);
    mapPageMarkers.push(overlay);
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
async function openMapPage(focusEvent) {
  document.getElementById("mapPageOverlay").classList.add("open");
  pushModalHistory(closeMapPage);
  renderMapPageFilters();
  await initMapPageMap(focusEvent);
  // ⚠️ 예전엔 runMapPageSearch()를 먼저 불러서, 그 안의 "더 많은 이벤트 보기" 버튼 계산이
  // mapSheetHeight가 아직 0(초기값)인 상태에서 실행됐다. 그러면 "하단(collapsed)"으로
  // 잘못 판정돼서 버튼이 처음부터 숨겨진 채로 시작됐다(특히 지도 로딩이 빠른 웹에서 잘 드러남).
  // 시트 높이를 먼저 확정한 뒤에 검색/렌더링해야 정확하다.
  await new Promise(requestAnimationFrame); // 레이아웃이 실제로 확정된 뒤에 측정하도록 한 프레임 대기
  initMapSheetSnapPoints();
  setMapSheetHeight(MAP_SHEET_SNAP.mid, { animate: false }); // 처음엔 중단 상태로 시작
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
let mapMyLocationOverlay = null; // 현재 위치 파란 점

async function initMapPageMap(focusEvent) {
  const mapEl = document.getElementById("mapPageKakaoMap");

  try {
    await loadKakaoMapSdk();

    if (!mapPageInitialized) {
      // 상세페이지의 "지도 크게 보기"로 들어온 경우엔 해당 이벤트 위치를 바로 중심으로
      // 잡는다 — 현재 위치(GPS) 조회를 기다릴 필요가 없어서 더 빠르고, 권한 팝업도
      // 불필요하게 뜨지 않는다. 일반 지도 탭 진입은 기존처럼 현재 위치 기준.
      const loc = focusEvent
        ? { lat: Number(focusEvent.lat), lng: Number(focusEvent.lng) }
        : await getMapUserLocation();

      // ⚠️ 좌표가 숫자가 아니거나(NaN) 지구 범위를 벗어나면, 카카오맵은 에러를 던지지
      // 않고 그냥 타일 요청 자체를 안 한 채로 회색 화면만 보여준다 — 증상만 봐서는
      // 원인을 알기 어려워서, 미리 걸러내고 명확한 로그를 남긴다.
      const isValidCoord = Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
        && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180;
      if (!isValidCoord) {
        console.error("[지도 디버그] 유효하지 않은 좌표라 서울시청으로 대체합니다:", loc);
        loc.lat = 37.5665;
        loc.lng = 126.9780;
      }

      mapPageKakaoMapInstance = new kakao.maps.Map(mapEl, {
        center: new kakao.maps.LatLng(loc.lat, loc.lng),
        level: focusEvent ? 4 : 7,
      });
      // 오버레이가 열리는 트랜지션(transform) 도중이라 레이아웃 계산 타이밍이 애매할
      // 가능성에 대비해 생성 직후에도 한 번 재계산해준다(재진입 시엔 이미 하고 있었음).
      mapPageKakaoMapInstance.relayout();
      console.log("[지도 디버그] 카카오맵 생성 완료 — center:", loc, "level:", focusEvent ? 4 : 7);

      if (!focusEvent) renderMyLocationDot(loc);

      // 지도 이동/확대축소 감지 → "현재 지역에서 찾기" 버튼 표시 + 바텀시트 자동 접힘
      kakao.maps.event.addListener(mapPageKakaoMapInstance, "idle", () => {
        showMapRefreshBtn();
      });
      kakao.maps.event.addListener(mapPageKakaoMapInstance, "dragstart", () => {
        mapPageMoved = true;
        collapseMapSheet(); // 지도를 만지기 시작하면 리스트를 접어서 지도를 넓게 (당근 패턴)
      });
      kakao.maps.event.addListener(mapPageKakaoMapInstance, "zoom_changed", () => {
        mapPageMoved = true;
      });

      mapPageInitialized = true;
    } else {
      // 재진입 시 지도 크기 재계산 (display:none 상태에서 초기화됐을 수 있음)
      mapPageKakaoMapInstance.relayout();
      if (focusEvent) {
        const lat = Number(focusEvent.lat), lng = Number(focusEvent.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
          mapPageKakaoMapInstance.setCenter(new kakao.maps.LatLng(lat, lng));
          mapPageKakaoMapInstance.setLevel(4);
        } else {
          console.error("[지도 디버그] 재진입 시 유효하지 않은 좌표라 중심 이동을 건너뜁니다:", focusEvent);
        }
      }
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

/* 위치 요청: 지도용은 정확도를 높이고 타임아웃을 넉넉히 (기존 getQuietLocation은
   5초 저정확도라 실내에서 자주 실패 → "위치 추적 안 됨"으로 보였음) */
function getMapUserLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve({ lat: 37.5665, lng: 126.9780, fallback: true }); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 37.5665, lng: 126.9780, fallback: true }),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  });
}

/* 현재 위치 파란 점 (당근/네이버지도의 내 위치 표시) */
function renderMyLocationDot(loc) {
  if (!mapPageKakaoMapInstance || loc.fallback) return;
  if (mapMyLocationOverlay) mapMyLocationOverlay.setMap(null);
  const el = document.createElement("div");
  el.className = "map-my-location-dot";
  mapMyLocationOverlay = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(loc.lat, loc.lng),
    content: el,
    yAnchor: 0.5,
  });
  mapMyLocationOverlay.setMap(mapPageKakaoMapInstance);
}

/* ---------- 현재 위치로 이동 버튼 ---------- */
document.getElementById("mapLocateBtn").addEventListener("click", async () => {
  const loc = await getMapUserLocation();
  if (loc.fallback) {
    showToast("위치 권한을 확인해주세요. 브라우저 설정에서 위치 접근을 허용해야 해요.");
    return;
  }
  renderMyLocationDot(loc);
  if (mapPageKakaoMapInstance) {
    mapPageKakaoMapInstance.setLevel(6);
    mapPageKakaoMapInstance.panTo(new kakao.maps.LatLng(loc.lat, loc.lng));
  }
});

/* 길찾기: 카카오맵 공식 길찾기 URL(/link/to/이름,위도,경도)을 새 탭으로 연다.
   앱이 설치돼 있으면 카카오맵 앱으로, 없으면 모바일웹/PC웹 카카오맵으로 자동 연결된다
   (카카오 공식 문서에 명시된 동작 — 별도 앱설치 감지 로직 불필요). */
document.getElementById("mapDirectionsBtn").addEventListener("click", () => {
  const ev = mapPageResults.find(e => e.id === mapPageSelectedId);
  if (!ev) {
    showToast("먼저 지도나 목록에서 이벤트를 선택해주세요 📍");
    return;
  }
  const name = encodeURIComponent(`${ev.brand} ${ev.title}`.slice(0, 40));
  const url = `https://map.kakao.com/link/to/${name},${ev.lat},${ev.lng}`;
  window.open(url, "_blank", "noopener,noreferrer");
});

/* ---------- 바텀시트: 자유 드래그 (네이버지도 패턴) ----------
   버튼으로 2단계 토글하던 방식 대신, 핸들을 손가락으로 잡고 있는 동안
   실시간으로 시트 높이가 따라오고, 손을 떼면 가장 가까운 스냅 지점(하단/중단/상단)
   으로 스르륵 붙는다. "현재 지역에서 찾기"/현재위치 버튼도 시트 높이를 따라 실시간으로
   그 바로 위에 유동적으로 붙는다. 시트가 상단(리스트 꽉 참)까지 올라가면 지도가 거의
   안 보이니 두 버튼은 자동으로 숨긴다. */
const MAP_SHEET_SNAP = { collapsed: 90, mid: null, expanded: null }; // mid/expanded는 화면 높이 기준으로 초기화 시 계산
let mapSheetHeight = 0;
let mapSheetDragging = false;

function initMapSheetSnapPoints() {
  const viewH = document.querySelector(".map-page-view")?.clientHeight || window.innerHeight;
  // 검색창(.map-search-bar)만의 실제 높이를 재서, 시트를 끝까지 올리면 검색창 바로 밑에 딱
  // 붙도록 한다. 카테고리탭·필터바(.map-page-filter-row)는 여기 포함 안 시켜서, 시트가 최대로
  // 올라오면 그 밑의 카테고리탭까지 자연스럽게 덮이게 한다.
  const searchBarH = document.querySelector(".map-search-bar")?.offsetHeight || 0;
  const searchBarTop = document.querySelector(".map-top-overlay")?.offsetTop || 0;
  const searchBarPaddingTop = 10; // .map-top-overlay의 상단 padding(safe-area 제외 고정분)
  MAP_SHEET_SNAP.collapsed = 130;                        // 하단: 살짝만 보임
  MAP_SHEET_SNAP.mid = Math.round(viewH * 0.48);          // 중단
  MAP_SHEET_SNAP.expanded = viewH - (searchBarTop + searchBarPaddingTop + searchBarH); // 상단: 검색창 바로 밑까지만
}

function setMapSheetHeight(px, { animate = false } = {}) {
  const sheet = document.getElementById("mapBottomSheet");
  sheet.style.transition = animate ? "height 0.28s cubic-bezier(0.22,1,0.36,1)" : "none";
  sheet.style.height = `${px}px`;
  mapSheetHeight = px;

  // 시트 위 플로팅 버튼들을 시트 바로 위, 유동적으로 따라가게 함
  const gap = 14;
  const refreshBtn = document.getElementById("mapRefreshBtn");
  const locateBtn = document.getElementById("mapLocateBtn");
  const directionsBtn = document.getElementById("mapDirectionsBtn");
  const nearFullyExpanded = px >= MAP_SHEET_SNAP.expanded - 40; // 리스트가 거의 꽉 찬 상태 → 지도 버튼 불필요
  [refreshBtn, locateBtn].forEach(btn => {
    btn.style.transition = animate ? "bottom 0.28s cubic-bezier(0.22,1,0.36,1)" : "none";
    btn.style.bottom = `${px + gap}px`;
    btn.style.display = nearFullyExpanded ? "none" : "";
  });
  // 길찾기 버튼은 "현재 위치" 버튼 바로 위(버튼높이 42px + 간격 8px = 50px 더 높은 위치)에 놓는다.
  // (예전엔 -50을 해서 오히려 시트 쪽으로 내려가 시트 뒤에 가려지는 버그가 있었음 — +50이 맞음)
  directionsBtn.style.transition = animate ? "bottom 0.28s cubic-bezier(0.22,1,0.36,1)" : "none";
  directionsBtn.style.bottom = `${px + gap + 50}px`;
  directionsBtn.style.display = nearFullyExpanded ? "none" : "";

  updateMapMoreBtnVisibility();
}

function collapseMapSheet() { setMapSheetHeight(MAP_SHEET_SNAP.collapsed, { animate: true }); }
function expandMapSheet() { setMapSheetHeight(MAP_SHEET_SNAP.mid, { animate: true }); }

function snapMapSheetToNearest(currentPx, velocity) {
  const points = [MAP_SHEET_SNAP.collapsed, MAP_SHEET_SNAP.mid, MAP_SHEET_SNAP.expanded];
  // 빠르게 튕기듯 놓으면(velocity) 그 방향의 다음 지점으로, 아니면 가장 가까운 지점으로
  let target;
  if (Math.abs(velocity) > 0.5) {
    target = velocity < 0
      ? points.find(p => p > currentPx) || points[points.length - 1]  // 위로 튕김 → 다음 큰 지점
      : [...points].reverse().find(p => p < currentPx) || points[0];  // 아래로 튕김 → 다음 작은 지점
  } else {
    target = points.reduce((a, b) => Math.abs(b - currentPx) < Math.abs(a - currentPx) ? b : a);
  }
  setMapSheetHeight(target, { animate: true });
}

(function initMapSheetHandle() {
  const handle = document.getElementById("mapSheetHandle");
  let startY = null, startHeight = 0, lastY = 0, lastT = 0, velocity = 0;
  let wasDragged = false; // 실제로 손가락이 움직였는지 — 터치 후 발생하는 합성 click과 구분하기 위함

  function onDragStart(y) {
    mapSheetDragging = true;
    startY = y; lastY = y; lastT = Date.now(); velocity = 0;
    startHeight = mapSheetHeight;
    wasDragged = false;
  }
  function onDragMove(y) {
    if (startY == null) return;
    const now = Date.now();
    const dt = now - lastT || 1;
    velocity = (y - lastY) / dt; // px/ms, 양수=아래로 이동 중
    lastY = y; lastT = now;

    const delta = startY - y; // 위로 끌수록 양수
    if (Math.abs(delta) > 5) wasDragged = true; // 5px 이상 움직였으면 "진짜 드래그"로 판정
    const next = Math.min(MAP_SHEET_SNAP.expanded, Math.max(MAP_SHEET_SNAP.collapsed, startHeight + delta));
    setMapSheetHeight(next, { animate: false });
  }
  function onDragEnd() {
    if (startY == null) return;
    snapMapSheetToNearest(mapSheetHeight, velocity);
    startY = null;
    mapSheetDragging = false;
  }

  handle.addEventListener("touchstart", (e) => onDragStart(e.touches[0].clientY), { passive: true });
  handle.addEventListener("touchmove", (e) => onDragMove(e.touches[0].clientY), { passive: true });
  handle.addEventListener("touchend", onDragEnd, { passive: true });

  // 데스크톱 브라우저 테스트를 위한 마우스 드래그 지원
  handle.addEventListener("mousedown", (e) => {
    onDragStart(e.clientY);
    const onMove = (ev) => onDragMove(ev.clientY);
    const onUp = () => {
      onDragEnd();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  // 핸들을 그냥 탭(드래그 없이 클릭)하면 collapsed↔mid 토글 (기존 습관 유지)
  handle.addEventListener("click", () => {
    // 드래그 직후 브라우저가 추가로 발생시키는 합성 click은 무시한다 —
    // 안 그러면 방금 정확히 스냅된 위치를 이 토글이 덮어써서 "가끔 엉뚱한 자리로 튀는" 버그가 생긴다.
    if (wasDragged) { wasDragged = false; return; }
    if (mapSheetHeight <= MAP_SHEET_SNAP.collapsed + 10) expandMapSheet();
    else collapseMapSheet();
  });
})();

/* ---------- 카테고리 + 혜택 필터 ---------- */
let mapPageCurrentBenefit = "all";
let mapPageSelectedBrands = new Set();

function renderMapPageFilters() {
  const row = document.getElementById("mapPageFilterRow");
  // 홈의 CATEGORIES와 동일한 분야 체계(순서 포함)를 그대로 사용 — 홈에서 "뷰티"의 이벤트는
  // 지도에서도 같은 "뷰티" 이벤트여야 한다는 원칙(스펙 8번)에 따라 별도 목록을 두지 않는다.
  const cats = CATEGORIES.map(c => ({ id: c.id, label: c.label }));

  row.innerHTML =
    cats.map(c => `
      <button type="button" class="map-page-filter-chip ${mapPageCurrentCategory === c.id ? "active" : ""}" data-cat="${c.id}">${c.label}</button>
    `).join("") +
    `<span class="map-page-filter-divider"></span>` +
    `<button type="button" class="map-page-filter-chip benefit ${(mapPageCurrentBenefit !== "all" || mapPageSelectedBrands.size > 0) ? "active" : ""}" id="mapFilterMoreBtn">필터${mapPageSelectedBrands.size > 0 ? ` ${mapPageSelectedBrands.size}` : ""}</button>`;

  row.querySelectorAll(".map-page-filter-chip[data-cat]").forEach(btn => {
    btn.addEventListener("click", () => {
      mapPageCurrentCategory = btn.dataset.cat;
      renderMapPageFilters();
      runMapPageSearch();
    });
  });
  document.getElementById("mapFilterMoreBtn").addEventListener("click", openMapFilterSheet);
}

/* 지도의 "필터" 버튼 — 지도 특성상 UI를 단순화해 브랜드(다중)+혜택(단일)만 한 시트에서 고른다.
   (지역/더보기는 지도 자체가 이미 위치기반 발견 도구라 홈처럼 따로 두지 않는다) */
function openMapFilterSheet() {
  mapFilterSheetActive = true;
  renderMapFilterSheetContent();
  document.getElementById("filterSheetBenefit").classList.add("open");
  document.body.style.overflow = "hidden";
  pushModalHistory(closeMapFilterSheet);
}
function closeMapFilterSheet() {
  document.getElementById("filterSheetBenefit").classList.remove("open");
  document.body.style.overflow = "";
  mapFilterSheetActive = false;
}
function renderMapFilterSheetContent() {
  const titleEl = document.querySelector("#filterSheetBenefit .filter-sheet-title");
  titleEl.textContent = "필터";
  const listEl = document.getElementById("benefitSheetList");

  const pool = getMapPageAllEvents().filter(ev => mapPageCurrentCategory === "all" || ev.category === mapPageCurrentCategory);
  const seen = new Set();
  const brands = [];
  pool.forEach(ev => { if (!seen.has(ev.brand) && !ev.id.startsWith("mock-")) { seen.add(ev.brand); brands.push(ev); } });

  const brandHtml = brands.length ? `
    <p class="filter-sheet-sublabel" style="padding-left:0;">브랜드</p>
    <div class="filter-sheet-list brand-chip-grid" style="padding:0 0 12px;">
      ${brands.map(ev => `
        <button type="button" class="brand-sheet-chip ${mapPageSelectedBrands.has(ev.brand) ? "checked" : ""}" data-brand="${escapeHtml(ev.brand)}">
          <span>${escapeHtml(ev.brand)}</span><span class="brand-sheet-check">✓</span>
        </button>`).join("")}
    </div>` : "";

  const benefitHtml = `
    <p class="filter-sheet-sublabel" style="padding-left:0;">혜택</p>
    ${BENEFIT_SHEET_OPTIONS.map(b => `
      <button type="button" class="filter-sheet-radio map-benefit-radio ${mapPageCurrentBenefit === b.id ? "checked" : ""}" data-benefit="${b.id}">
        <span>${b.label}</span><span class="radio-dot"></span>
      </button>`).join("")}`;

  listEl.innerHTML = brandHtml + benefitHtml;

  listEl.querySelectorAll(".brand-sheet-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const brand = chip.dataset.brand;
      if (mapPageSelectedBrands.has(brand)) mapPageSelectedBrands.delete(brand); else mapPageSelectedBrands.add(brand);
      renderMapFilterSheetContent();
    });
  });
  listEl.querySelectorAll(".map-benefit-radio").forEach(btn => {
    btn.addEventListener("click", () => {
      mapPageCurrentBenefit = btn.dataset.benefit;
      renderMapFilterSheetContent();
    });
  });
}
let mapFilterSheetActive = false; // #filterSheetBenefit을 지도가 잠깐 빌려 쓰는 중인지 표시

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