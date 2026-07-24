/* =========================================================
   지도 페이지 (전체 탐색용 다중 마커 지도)
   =========================================================
   "내 주변 인기 이벤트" 옆 🗺️ 아이콘으로 진입.
   실제 위치 정보(lat/lng)가 있는 살아있는 이벤트를 지도에 전부 뿌려주고,
   화면 아래에는 리스트로도 같이 보여준다(Luma의 "지도+리스트" 구조 참고).

   ⚠️ 가상 데이터 안내
   실제 이벤트가 아직 몇 개 없어서(특히 좌표가 있는 이벤트), 지도가 휑하게
   비어 보이지 않도록 MOCK_MAP_EVENTS를 같이 섞어서 보여준다. 가짜 데이터는:
   - id가 전부 "mock-"으로 시작 (실제 이벤트와 절대 안 겹침)
   - EVENTS 배열의 실제 이벤트와 정확히 동일한 필드 구조(schema)를 그대로 사용
   → 나중에 그 지역에 진짜 이벤트가 승인되면, MOCK_MAP_EVENTS에서 해당 지역
     항목을 지우기만 하면 자동으로 진짜 데이터로 대체된다. 코드 구조는 안 바뀜.
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

let mapPageKakaoMapInstance = null;
let mapPageMarkers = [];
let mapPageCurrentCategory = "all";

function getMapPageEvents() {
  // 실제 이벤트 중 좌표가 있고 살아있는 것 + 가상 이벤트를 합친다.
  // 나중에 실제 이벤트가 늘어나면 이 함수 로직은 그대로 두고 MOCK_MAP_EVENTS만 줄이면 된다.
  const realOnes = (typeof EVENTS !== "undefined" ? EVENTS : [])
    .filter(ev => isEventLive(ev) && ev.lat != null && ev.lng != null);
  return [...realOnes, ...MOCK_MAP_EVENTS];
}

function openMapPage() {
  document.getElementById("mapPageOverlay").classList.add("open");
  pushModalHistory(closeMapPage);
  renderMapPageFilters();
  renderMapPageContent();
}

function closeMapPage() {
  document.getElementById("mapPageOverlay").classList.remove("open");
}

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
      renderMapPageContent();
    });
  });
}

async function renderMapPageContent() {
  const all = getMapPageEvents();
  const filtered = mapPageCurrentCategory === "all"
    ? all
    : all.filter(ev => ev.category === mapPageCurrentCategory);

  renderMapPageList(filtered);
  await renderMapPageMap(filtered);
}

function renderMapPageList(events) {
  const listEl = document.getElementById("mapPageList");
  if (events.length === 0) {
    listEl.innerHTML = `<p class="map-page-empty">이 카테고리에는 아직 표시할 이벤트가 없어요.</p>`;
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
      const ev = events.find(e => e.id === item.dataset.id);
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

async function renderMapPageMap(events) {
  const mapEl = document.getElementById("mapPageKakaoMap");

  try {
    await loadKakaoMapSdk();

    if (!mapPageKakaoMapInstance) {
      mapPageKakaoMapInstance = new kakao.maps.Map(mapEl, {
        center: new kakao.maps.LatLng(37.5445, 127.0559), // 성수동 기준 시작
        level: 8,
      });
    }

    // 기존 마커 정리
    mapPageMarkers.forEach(m => m.setMap(null));
    mapPageMarkers = [];

    if (events.length === 0) return;

    const bounds = new kakao.maps.LatLngBounds();
    events.forEach(ev => {
      const pos = new kakao.maps.LatLng(ev.lat, ev.lng);
      const marker = new kakao.maps.Marker({ position: pos, map: mapPageKakaoMapInstance });

      kakao.maps.event.addListener(marker, "click", () => {
        document.querySelectorAll(".map-page-list-item").forEach(el => el.classList.remove("active-pin"));
        const listItem = document.querySelector(`.map-page-list-item[data-id="${ev.id}"]`);
        if (listItem) {
          listItem.classList.add("active-pin");
          listItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });

      mapPageMarkers.push(marker);
      bounds.extend(pos);
    });

    mapPageKakaoMapInstance.setBounds(bounds);

  } catch (err) {
    console.error("지도 페이지 카카오맵 로드 오류:", err);
    mapEl.innerHTML = `<div class="map-page-map-status">지도를 불러오지 못했어요. 아래 목록으로 확인해주세요.</div>`;
  }
}

document.getElementById("mapPageOpenBtn").addEventListener("click", openMapPage);
document.getElementById("mapPageClose").addEventListener("click", () => {
  closeMapPage();
  popModalHistory();
});