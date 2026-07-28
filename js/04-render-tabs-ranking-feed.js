/* ---------- Render: Category Tabs ---------- */
/* ---------- 팝업 탭 전용: 관심 지역 배너 (Luma의 "지역 구독" 벤치마킹) ----------
   새 DB 테이블을 따로 만들지 않고, 온보딩에서 이미 고른 지역 키워드
   (userInterestKeywords, 10-auth.js에서 로그인 시 채워짐)를 재사용한다.
   관심 지역을 등록해둔 사용자에게는 "그 지역 팝업이 몇 개 있는지" 바로 보여주고,
   등록 안 한 사용자에게는 지역 칩을 보여줘서 온보딩 편집 화면으로 유도한다. */
let currentRegionFilter = null; // 배너에서 지역을 눌러 필터링 중이면 그 지역 키워드(예: "#성수동")

function renderPopupRegionBanner() {
  const el = document.getElementById("popupRegionBanner");
  if (!el) return;
  if (currentCategory !== "popup") { el.hidden = true; el.innerHTML = ""; currentRegionFilter = null; return; }

  const allRegions = (typeof KEYWORD_POOL !== "undefined") ? KEYWORD_POOL.region : [];
  const myRegions = allRegions.filter(kw => userInterestKeywords.includes(kw));

  el.hidden = false;

  if (myRegions.length === 0) {
    el.innerHTML = `
      <p class="popup-region-banner-title">🗺️ 관심 지역을 등록해두면 새 팝업이 뜰 때 먼저 보여드려요</p>
      <div class="popup-region-chip-row">
        ${allRegions.map(r => `<span class="popup-region-chip">${escapeHtml(r.replace("#", ""))}</span>`).join("")}
      </div>
    `;
    const row = el.querySelector(".popup-region-chip-row");
    if (row) {
      row.addEventListener("click", () => {
        if (!currentUser) { showToast("로그인하시면 관심 지역을 등록할 수 있어요."); openAuthModal(); return; }
        openOnboarding(true, [...selectedKeywords]);
      });
    }
    return;
  }

  el.innerHTML = `
    <p class="popup-region-banner-title">🗺️ 내 관심 지역</p>
    <div class="popup-region-chip-row">
      ${myRegions.map(kw => {
        const hints = (typeof KEYWORD_MATCH_CONFIG !== "undefined" && KEYWORD_MATCH_CONFIG[kw]) ? KEYWORD_MATCH_CONFIG[kw].textHints : [];
        const count = EVENTS.filter(ev => ev.category === "popup" && isEventLive(ev) && hints.some(h => (ev.channel || "").includes(h))).length;
        const label = kw.replace("#", "");
        return `<button type="button" class="popup-region-chip ${currentRegionFilter === kw ? "active" : ""}" data-region="${kw}">${escapeHtml(label)} ${count}개</button>`;
      }).join("")}
    </div>
  `;
  el.querySelectorAll(".popup-region-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const kw = chip.dataset.region;
      currentRegionFilter = currentRegionFilter === kw ? null : kw; // 같은 걸 다시 누르면 해제
      renderPopupRegionBanner();
      renderFeed();
    });
  });
}

function renderCategoryTabs() {
  const nav = document.getElementById("categoryTabs");
  nav.innerHTML = CATEGORIES.map(cat => `
    <button class="tab-pill ${cat.id === currentCategory ? "active" : ""}" data-cat="${cat.id}">
      <span class="tab-icon">${cat.icon}</span><span class="tab-label">${cat.label}</span>
    </button>
  `).join("");

  nav.querySelectorAll(".tab-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      currentCategory = btn.dataset.cat;
      trackFilterUse(`category:${currentCategory}`);
      selectedBrands.clear(); // 카테고리 바뀌면 이전 카테고리의 브랜드 선택은 초기화
      currentSubTag = null;   // 서브카테고리도 초기화
      rankingShowCount = 5;   // 카테고리 바뀌면 더보기 상태도 초기화
      renderCategoryTabs();
      renderFilterBar();
      renderSubcatRow();
      renderPopupRegionBanner();
      renderFeed();
      renderRanking();
      updateDiscoverySectionsVisibility();
    });
  });

  renderFilterBar();
  renderSubcatRow();
}

/* ---------- 서브카테고리(태그) 칩 — 시안 6번: 카테고리 안에서 태그로 세분화 ---------- */
let currentSubTag = null;
let currentFeedSort = "hot";

function renderSubcatRow() {
  const row = document.getElementById("subcatRow");
  if (currentCategory === "all") { row.hidden = true; row.innerHTML = ""; return; }
  // 현재 카테고리 이벤트들의 태그를 빈도순으로 뽑아 서브카테고리로 사용 (데이터 기반이라 빈 칩이 없음)
  const tagCount = {};
  EVENTS.filter(ev => ev.category === currentCategory && isEventLive(ev))
    .forEach(ev => (ev.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  if (tags.length === 0) { row.hidden = true; row.innerHTML = ""; return; }

  row.hidden = false;
  row.innerHTML = `<button class="subcat-chip ${!currentSubTag ? "active" : ""}" data-subtag="">전체</button>`
    + tags.map(t => `<button class="subcat-chip ${currentSubTag === t ? "active" : ""}" data-subtag="${t}">${t}</button>`).join("");
  row.querySelectorAll(".subcat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      currentSubTag = chip.dataset.subtag || null;
      if (currentSubTag) trackFilterUse(`subtag:${currentSubTag}`);
      renderSubcatRow();
      renderFeed();
      updateDiscoverySectionsVisibility();
    });
  });
}

document.getElementById("feedSortRow").addEventListener("click", (e) => {
  const chip = e.target.closest(".feed-sort-chip");
  if (!chip) return;
  currentFeedSort = chip.dataset.feedSort;
  document.querySelectorAll(".feed-sort-chip").forEach(c => c.classList.toggle("active", c === chip));
  renderFeed();
});

/* ---------- Render: 브랜드 로고 필터 (전체 탭에서는 숨김, 카테고리 탭에서만 노출) ----------
   가로로 계속 밀어야 하는 무한 스크롤 대신, 한 줄에 들어가는 만큼만 우선 보여주고
   나머지는 "더보기"를 눌러야 아래로 펼쳐지는 방식 — 한눈에 훑을 수 있는 양만 먼저 노출해
   피로감을 줄인다. 몇 개가 한 줄에 들어가는지는 화면 폭마다 달라서, 실제로 렌더링한 뒤
   줄바꿈된 지점을 오프셋으로 측정해서 판단한다(고정 개수로 자르지 않음 — 기기별로 정확함). */
/* =========================================================
   필터바: 브랜드 / 혜택 / 지역 / 더보기
   =========================================================
   - 브랜드: 다중선택 (selectedBrands, 기존 그대로)
   - 혜택: 단일선택 (currentDiscountFilter, 기존 그대로)
   - 지역: 단일선택, "내 위치"는 gpsFilterActive, "인기 지역"은 currentRegionFilter
     (둘 다 기존에 있던 변수 — 팝업 지역배너가 쓰던 currentRegionFilter를 그대로 재사용)
   - 더보기: 온라인/오프라인만 (getChannelMode()로 실제 channel 텍스트에서 판정 가능한
     조건이라 넣음. "참여방식"/"대상"은 구조화된 데이터가 없어서 넣지 않음 — 보고서 참고)
   ========================================================= */

const REGION_SHEET_OPTIONS = [
  { kw: "#성수동", label: "성수동" },
  { kw: "#홍대·연남", label: "홍대·연남" },
  { kw: "#더현대서울", label: "더현대서울" },
  { kw: "#압구정로데오", label: "압구정로데오" },
  { kw: "#한남동", label: "한남동" },
  { kw: "#강남역", label: "강남역" },
];
const BENEFIT_SHEET_OPTIONS = [
  { id: "all", label: "전체" },
  { id: "1+1", label: "1+1" },
  { id: "50plus", label: "50% 이상 할인" },
  { id: "free", label: "무료·증정" },
  { id: "coupon", label: "쿠폰" },
  { id: "point", label: "적립·캐시백" },
  { id: "limited", label: "선착순·한정" },
];
// "사은품·증정"/"체험 무료"/"한정 혜택"은 참고 이미지에 있었지만 넣지 않았다 —
// 이미 free(무료·증정)가 "무료|증정|체험단|사은품|샘플"을, limited가 "선착순|한정"을
// 매칭하고 있어서 별도 옵션으로 나눠도 실제로 구분되는 이벤트가 거의 없다.
// (정확성 원칙: 카드에서 구분이 안 되는 걸 필터만 세분화하면 오히려 혼란만 커짐)

let filterSheetOpen = null; // "brand" | "benefit" | "more" | null

function openFilterSheet(name) {
  filterSheetOpen = name;
  const overlay = document.getElementById(`filterSheet${name[0].toUpperCase()}${name.slice(1)}`);
  if (name === "brand") renderBrandSheetContent();
  if (name === "benefit") renderBenefitSheetContent();
  if (name === "more") renderMoreSheetContent();
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";
  pushModalHistory(() => closeFilterSheet(name));
}
function closeFilterSheet(name) {
  const overlay = document.getElementById(`filterSheet${name[0].toUpperCase()}${name.slice(1)}`);
  overlay.classList.remove("open");
  document.body.style.overflow = "";
  filterSheetOpen = null;
}

document.querySelectorAll(".filter-bar-btn").forEach(btn => {
  btn.addEventListener("click", () => openFilterSheet(btn.dataset.sheet));
});
["Brand", "Benefit", "More"].forEach(name => {
  const key = name.toLowerCase();
  document.getElementById(`filterSheet${name}Close`).addEventListener("click", () => {
    closeFilterSheet(key);
    popModalHistory();
  });
});

/* ---------- 브랜드 시트: 검색 + 인기브랜드(조회수 상위) + 전체목록, 다중선택 ---------- */
function renderBrandSheetContent() {
  const pool = EVENTS.filter(ev => isEventLive(ev) && (currentCategory === "all" || ev.category === currentCategory));
  const seen = new Set();
  const brands = [];
  pool.forEach(ev => { if (!seen.has(ev.brand)) { seen.add(ev.brand); brands.push(ev); } });

  const popular = [...brands].sort((a, b) => getEventScore(b.id) - getEventScore(a.id)).slice(0, 6);

  const renderChip = (ev) => `
    <button type="button" class="brand-sheet-chip ${selectedBrands.has(ev.brand) ? "checked" : ""}" data-brand="${escapeHtml(ev.brand)}">
      <img class="brand-filter-logo" src="${getLogoUrl(ev.domain)}" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}" alt="">
      <span>${escapeHtml(ev.brand)}</span>
      <span class="brand-sheet-check">✓</span>
    </button>`;

  document.getElementById("brandSheetPopular").innerHTML = popular.length
    ? `<p class="filter-sheet-sublabel">🔥 인기 브랜드</p><div class="filter-sheet-list brand-chip-grid">${popular.map(renderChip).join("")}</div>`
    : "";

  const renderList = (query) => {
    const filtered = query
      ? brands.filter(ev => ev.brand.toLowerCase().includes(query.toLowerCase()))
      : brands;
    const listEl = document.getElementById("brandSheetList");
    listEl.innerHTML = filtered.length
      ? filtered.map(ev => `
          <label class="brand-sheet-row">
            <input type="checkbox" data-brand="${escapeHtml(ev.brand)}" ${selectedBrands.has(ev.brand) ? "checked" : ""}>
            <img class="brand-filter-logo" src="${getLogoUrl(ev.domain)}" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}" alt="">
            <span>${escapeHtml(ev.brand)}</span>
          </label>`).join("")
      : `<p class="filter-sheet-empty">일치하는 브랜드가 없어요.</p>`;

    listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.addEventListener("change", () => {
        if (cb.checked) selectedBrands.add(cb.dataset.brand);
        else selectedBrands.delete(cb.dataset.brand);
      });
    });
    listEl.querySelectorAll(".brand-filter-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
  };
  renderList("");

  document.getElementById("brandSheetPopular").querySelectorAll(".brand-sheet-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const brand = chip.dataset.brand;
      if (selectedBrands.has(brand)) selectedBrands.delete(brand); else selectedBrands.add(brand);
      renderBrandSheetContent(); // 인기칩+목록 체크상태 동기화 위해 다시 그림
    });
  });
  document.getElementById("brandSheetPopular").querySelectorAll(".brand-filter-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));

  const searchInput = document.getElementById("brandSheetSearch");
  searchInput.value = "";
  searchInput.oninput = () => renderList(searchInput.value.trim());
}
document.getElementById("brandSheetApply").addEventListener("click", () => {
  closeFilterSheet("brand");
  popModalHistory();
  trackFilterUse(`brand:${[...selectedBrands].join(",")}`);
  renderFilterBar();
  renderFeed();
  renderRanking();
  updateDiscoverySectionsVisibility();
});

/* ---------- 혜택 시트: 단일선택 (기존 currentDiscountFilter 그대로) ---------- */
function renderBenefitSheetContent() {
  const listEl = document.getElementById("benefitSheetList");
  listEl.innerHTML = BENEFIT_SHEET_OPTIONS.map(b => `
    <button type="button" class="filter-sheet-radio ${currentDiscountFilter === b.id ? "checked" : ""}" data-benefit="${b.id}">
      <span>${b.label}</span><span class="radio-dot"></span>
    </button>`).join("");
  listEl.querySelectorAll(".filter-sheet-radio").forEach(btn => {
    btn.addEventListener("click", () => {
      currentDiscountFilter = btn.dataset.benefit;
      renderBenefitSheetContent();
    });
  });
}
document.getElementById("benefitSheetApply").addEventListener("click", () => {
  // #filterSheetBenefit은 홈의 "혜택" 시트와 지도의 "필터" 시트가 같은 DOM을 공유한다
  // (기능이 겹쳐서 새로 안 만들고 재사용 — mapFilterSheetActive로 지금 어느 쪽인지 구분)
  if (typeof mapFilterSheetActive !== "undefined" && mapFilterSheetActive) {
    closeMapFilterSheet();
    popModalHistory();
    renderMapPageFilters();
    runMapPageSearch();
    return;
  }
  closeFilterSheet("benefit");
  popModalHistory();
  trackFilterUse(`discount:${currentDiscountFilter}`);
  renderFilterBar();
  renderFeed();
  renderRanking();
  updateDiscoverySectionsVisibility();
});

/* ---------- 더보기 시트: 온라인/오프라인 (실제 channel 텍스트 기반, getChannelMode 재사용) ---------- */
const MORE_SHEET_OPTIONS = [
  { id: "entry", label: "응모 이벤트" },
  { id: "appOnly", label: "앱 전용 이벤트" },
];
// 참고 이미지엔 "체험 이벤트"/"브랜드 공식 이벤트"/"기간 한정 이벤트"도 있었지만 안 넣었다.
// - 체험 이벤트: 이미 혜택>무료·증정이 "체험단" 키워드를 매칭하고 있어 완전히 중복됨.
// - 기간 한정 이벤트: 이미 혜택>선착순·한정이 "한정" 키워드를 매칭하고 있어 완전히 중복됨.
// - 브랜드 공식 이벤트: EventHub는 admin 승인을 거친 이벤트만 게시하므로 전부 "공식"이라,
//   이 필터로 걸러지는/안 걸러지는 이벤트가 실제로 없다(항상 전부 매칭 = 의미 없는 필터).
//   → "가짜 데이터는 만들지 않는다" 원칙에 따라 뺐다.

function renderMoreSheetContent() {
  const options = [
    { id: "all", label: "전체" },
    { id: "online", label: "온라인" },
    { id: "offline", label: "오프라인" },
  ];
  const listEl = document.getElementById("moreSheetOnlineOffline");
  listEl.innerHTML = options.map(o => `
    <button type="button" class="filter-sheet-radio ${onlineOfflineFilter === o.id ? "checked" : ""}" data-oo="${o.id}">
      <span>${o.label}</span><span class="radio-dot"></span>
    </button>`).join("");
  listEl.querySelectorAll(".filter-sheet-radio").forEach(btn => {
    btn.addEventListener("click", () => {
      onlineOfflineFilter = btn.dataset.oo;
      renderMoreSheetContent();
    });
  });

  // 응모/앱전용은 온오프라인과 달리 상호배타적이지 않아 체크박스(다중선택)로 둔다
  const extraEl = document.getElementById("moreSheetExtra");
  extraEl.innerHTML = MORE_SHEET_OPTIONS.map(o => `
    <label class="filter-sheet-checkbox-row">
      <input type="checkbox" data-more="${o.id}" ${moreSelections.has(o.id) ? "checked" : ""}>
      <span>${o.label}</span>
    </label>`).join("");
  extraEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener("change", () => {
      if (cb.checked) moreSelections.add(cb.dataset.more);
      else moreSelections.delete(cb.dataset.more);
    });
  });
}
document.getElementById("moreSheetApply").addEventListener("click", () => {
  closeFilterSheet("more");
  popModalHistory();
  trackFilterUse(`onlineoffline:${onlineOfflineFilter}`);
  renderFilterBar();
  renderFeed();
  renderRanking();
  updateDiscoverySectionsVisibility();
});

/* ---------- 필터바 버튼 라벨 + 선택된 필터 칩 표시 (전부 청록색) ---------- */
const FILTER_BAR_ICONS = {
  brand: `<svg class="filter-bar-icon" viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M11.5 3h5.5a2 2 0 0 1 2 2v5.5a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6-6a2 2 0 0 1 0-2.8l8-8a2 2 0 0 1 1.4-.6Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="16" cy="8" r="1.3" fill="currentColor"/></svg>`,
  benefit: `<svg class="filter-bar-icon" viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M4 9h16v3H4V9Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M5 12h14v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 9v11M12 9c-1.4 0-3-1-3-2.5S10 4 11.2 4.8C12 5.3 12 7 12 9Zm0 0c1.4 0 3-1 3-2.5S14 4 12.8 4.8C12 5.3 12 7 12 9Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>`,
  more: `<svg class="filter-bar-icon" viewBox="0 0 24 24" fill="none" width="13" height="13"><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="6" r="1.8" fill="currentColor" stroke="var(--card-bg)" stroke-width="1.5"/><circle cx="16" cy="12" r="1.8" fill="currentColor" stroke="var(--card-bg)" stroke-width="1.5"/><circle cx="10" cy="18" r="1.8" fill="currentColor" stroke="var(--card-bg)" stroke-width="1.5"/></svg>`,
};

function renderFilterBar() {
  const brandBtn = document.getElementById("filterBtnBrand");
  const benefitBtn = document.getElementById("filterBtnBenefit");
  const moreBtn = document.getElementById("filterBtnMore");

  brandBtn.classList.toggle("selected", selectedBrands.size > 0);
  brandBtn.innerHTML = FILTER_BAR_ICONS.brand + (selectedBrands.size > 0 ? `브랜드 <b>${selectedBrands.size}</b> <span class="filter-chev">⌄</span>` : `브랜드 <span class="filter-chev">⌄</span>`);

  benefitBtn.classList.toggle("selected", currentDiscountFilter !== "all");
  const benefitLabel = BENEFIT_SHEET_OPTIONS.find(b => b.id === currentDiscountFilter)?.label;
  benefitBtn.innerHTML = FILTER_BAR_ICONS.benefit + (currentDiscountFilter !== "all" ? `${benefitLabel} <span class="filter-chev">⌄</span>` : `혜택 <span class="filter-chev">⌄</span>`);

  const moreCount = (onlineOfflineFilter !== "all" ? 1 : 0) + moreSelections.size;
  moreBtn.classList.toggle("selected", moreCount > 0);
  moreBtn.innerHTML = FILTER_BAR_ICONS.more + (moreCount > 0 ? `더보기 <b>${moreCount}</b> <span class="filter-chev">⌄</span>` : `더보기 <span class="filter-chev">⌄</span>`);

  renderSelectedFilterChips();
}

/* 선택된 조건을 [뷰티 ×][미샤 ×][1+1 ×] 형태로 표시. 각 X는 해당 필터만 개별 해제. */
function renderSelectedFilterChips() {
  const row = document.getElementById("selectedFilterRow");
  const chips = [];

  // ⚠️ 예전엔 분야(카테고리)도 선택칩에 같이 보여줬는데 뺐다 — 상단 카테고리탭이 이미
  // 주황색으로 선택 상태를 표시하고 있어서 중복이었고, 게다가 이 칩 색(neutral=mint)이
  // 혜택 칩 색(청록)과 비슷해서 "이게 혜택인가?" 헷갈리게 만드는 문제가 있었다.
  selectedBrands.forEach(b => chips.push({ type: "brand", role: "brand", value: b, label: b }));
  if (currentDiscountFilter !== "all") {
    chips.push({ type: "benefit", role: "benefit", value: currentDiscountFilter, label: BENEFIT_SHEET_OPTIONS.find(x => x.id === currentDiscountFilter)?.label });
  }
  if (gpsFilterActive) chips.push({ type: "region", role: "neutral", value: "gps", label: "내 위치" });
  if (currentRegionFilter) chips.push({ type: "region", role: "neutral", value: currentRegionFilter, label: REGION_SHEET_OPTIONS.find(r => r.kw === currentRegionFilter)?.label });
  if (onlineOfflineFilter !== "all") chips.push({ type: "oo", role: "more", value: onlineOfflineFilter, label: onlineOfflineFilter === "online" ? "온라인" : "오프라인" });
  moreSelections.forEach(m => chips.push({ type: "moreExtra", role: "more", value: m, label: MORE_SHEET_OPTIONS.find(o => o.id === m)?.label }));

  if (chips.length === 0) { row.hidden = true; row.innerHTML = ""; return; }
  row.hidden = false;
  row.innerHTML = chips.map(c => `
    <span class="selected-filter-chip role-${c.role}" data-type="${c.type}" data-value="${escapeHtml(c.value)}">${escapeHtml(c.label)} <button type="button" class="selected-filter-remove" aria-label="필터 해제">✕</button></span>
  `).join("");

  row.querySelectorAll(".selected-filter-chip").forEach(chipEl => {
    chipEl.querySelector(".selected-filter-remove").addEventListener("click", () => {
      const { type, value } = chipEl.dataset;
      if (type === "brand") selectedBrands.delete(value);
      else if (type === "benefit") currentDiscountFilter = "all";
      else if (type === "region" && value === "gps") { if (gpsFilterActive) toggleGpsFilter(); }
      else if (type === "region") currentRegionFilter = null;
      else if (type === "oo") onlineOfflineFilter = "all";
      else if (type === "moreExtra") moreSelections.delete(value);
      renderFilterBar();
      renderPopupRegionBanner();
      renderFeed();
      renderRanking();
      updateDiscoverySectionsVisibility();
    });
  });
}
document.getElementById("gpsFilterChip").addEventListener("click", toggleGpsFilter);

/* ---------- Render: Ranking (조회수·좋아요 기반 실제 랭킹, 카테고리별) ---------- */
let rankingShowCount = 5;

function renderRanking() {
  const list = document.getElementById("rankingList");
  const titleEl = document.getElementById("rankingTitle");
  const moreBtn = document.getElementById("rankingMoreBtn");

  const pool = getFilteredEvents();

  const fireIconSvg = `<img class="flame-icon-img" src="assets/flame-icon.png?v20260718d" alt="" aria-hidden="true">`;
  titleEl.innerHTML = currentCategory === "all"
    ? `${fireIconSvg} 실시간 인기 이벤트`
    : `${fireIconSvg} ${getCategoryLabel(currentCategory)} 인기 이벤트`;

  if (pool.length === 0) {
    list.innerHTML = `<li class="empty-state">아직 랭킹에 표시할 이벤트가 없어요.</li>`;
    moreBtn.hidden = true;
    return;
  }

  // 좋아요*3 + 조회수 점수로 정렬. 아직 통계가 없으면(전부 0점) 데모 노출을 위해 무작위 섞기.
  const hasAnyStats = Object.keys(eventStatsCache).length > 0;
  const sorted = hasAnyStats
    ? [...pool].sort((a, b) => getEventScore(b.id) - getEventScore(a.id))
    : shuffleArray(pool);

  const rankedEvents = sorted.slice(0, rankingShowCount);
  const isExpanded = rankingShowCount > 5;
  moreBtn.hidden = sorted.length <= 5;
  moreBtn.textContent = isExpanded ? "접기 ⌃" : "더보기 ⌄";

  list.innerHTML = rankedEvents.map((ev, idx) => `
    <li class="rank-row" data-id="${ev.id}">
      <span class="rank-num ${idx < 3 ? "rank-num-hot" : "rank-num-alt"}">${idx + 1}</span>
      <img class="rank-thumb" src="${ev.image}" alt="" loading="lazy" onerror="handleImageError(this)">
      <div class="rank-row-info">
        <p class="rank-row-brand"><img class="rank-row-brand-logo" src="${getLogoUrl(ev.domain)}" alt="" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}"> ${escapeHtml(ev.brand)}</p>
        <p class="rank-row-title">${escapeHtml(ev.title)}</p>
        <p class="rank-row-sub">${escapeHtml(ev.discount)}</p>
        <span class="rank-interest"><img class="rank-interest-flame" src="assets/flame-icon.png?v20260718d" alt=""> ${formatCount((eventStatsCache[ev.id] || {}).views || 0)}명 관심중</span>
      </div>
      <button class="card-like-btn rank-like ${likedEvents.has(ev.id) ? "liked" : ""}" data-id="${ev.id}" aria-label="관심 이벤트로 등록">
        <span class="card-like-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.7-9.3-9C1.3 8 3.6 4.9 6.9 4.9c2 0 3.6 1.1 4.4 2.6h1.4c.8-1.5 2.4-2.6 4.4-2.6 3.3 0 5.6 3.1 4.2 6.6-1.8 4.3-9.3 9-9.3 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>
      </button>
    </li>
  `).join("");

  list.querySelectorAll(".rank-row-brand-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));

  list.querySelectorAll(".rank-row").forEach(item => {
    item.addEventListener("click", () => openSheet(item.dataset.id));
  });
  list.querySelectorAll(".rank-like").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(btn.dataset.id); });
  });
}

document.getElementById("rankingMoreBtn").addEventListener("click", () => {
  rankingShowCount = rankingShowCount > 5 ? 5 : Math.min(10, getFilteredEvents().length);
  renderRanking();
});

/* ---------- Render: Feed Grid ---------- */
/* 이벤트의 channel 텍스트(또는 좌표 유무)로부터 온라인/오프라인/온오프라인 여부를 판단.
   별도 DB 컬럼이 없어서, 이미 있는 channel 문구를 최대한 활용하고 애매하면 좌표 유무로 최종 판단한다. */
function getChannelMode(ev) {
  const text = ev.channel || "";
  const hasOnline = /온라인/.test(text);
  const hasOffline = /오프라인|매장|현장|방문/.test(text);
  if (hasOnline && hasOffline) return "온오프라인";
  if (hasOnline) return "온라인";
  if (hasOffline) return "오프라인";
  return (ev.lat != null && ev.lng != null) ? "오프라인" : "온라인";
}

/* 오프라인 이벤트일 때 카드에 "오프라인 · 성수" 처럼 지역명을 같이 보여주기 위한 추출 함수.
   지역 목록/키워드는 KEYWORD_MATCH_CONFIG에 이미 있는 것(성수/홍대 등)을 그대로 재사용한다
   (탭에서 지역 필터를 뺐다고 지역 정보 자체를 안 보여주는 게 아니라, 카드에 자연스럽게 노출한다). */
function getChannelRegionLabel(ev) {
  const text = ev.channel || "";
  for (const [kw, cfg] of Object.entries(KEYWORD_MATCH_CONFIG)) {
    if (!cfg.textHints || !kw.startsWith("#")) continue;
    if (!["#성수동", "#홍대·연남", "#더현대서울", "#압구정로데오", "#한남동", "#강남역"].includes(kw)) continue;
    if (cfg.textHints.some(hint => text.includes(hint))) {
      return kw.replace("#", "").split("·")[0]; // "#홍대·연남" → "홍대"처럼 짧게
    }
  }
  return null;
}

function renderEventCardHtml(ev) {
  // 거리 표시는 "내 주변 인기 이벤트" 섹션에서만 — 전체 피드에서는 20km 필터를 켜도 표시하지 않음
  const distanceLabel = "";
  // 온라인/오프라인 배지: 오프라인이면 "오프라인 · 성수"처럼 지역명을 같이 보여준다.
  // (상단 필터에서 지역을 뺀 대신, 지역 정보 자체는 이렇게 카드에서 자연스럽게 노출한다)
  const channelMode = getChannelMode(ev);
  const channelRegion = channelMode !== "온라인" ? getChannelRegionLabel(ev) : null;
  const channelModeLabel = channelRegion ? `${channelMode} · ${channelRegion}` : channelMode;
  const merchantBadge = ev.merchantType === "소상공인"
    ? `<span class="card-merchant-badge">소상공인</span>`
    : "";
  const subtitleHtml = ev.subtitle
    ? `<p class="card-sub">${escapeHtml(ev.subtitle)}</p>`
    : "";
  const conditionsHtml = ev.conditions
    ? `<p class="card-conditions-row">${escapeHtml(ev.conditions)}</p>`
    : "";
  // 브랜드 로고: 없으면(도메인 정보 없음) 그냥 생략 — 빈 자리를 억지로 채우지 않는다.
  const logoHtml = ev.domain
    ? `<img class="card-brand-logo-sm" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}" src="${getLogoUrl(ev.domain)}" alt="">`
    : "";
  // 카드의 할인 배지는 한 줄짜리 요약 공간이라, "A + B + C"처럼 여러 혜택이 이어진
  // 대형 프로모션이면 대표 혜택(첫 항목)만 보여준다. 전체 목록은 상세페이지 혜택칩에서
  // 그대로 다 보여주므로(ev.discount 원본은 안 건드림) 정보 손실은 없다.
  const rawDiscount = (ev.discount || "").split(/\s+\+\s+/)[0].trim();
  // 혜택(할인/증정 등)이 아예 없는 순수 홍보성 이벤트는 "홍보 이벤트"로 구분 표시
  const cardDiscountText = rawDiscount ? escapeHtml(rawDiscount) : `<span class="card-promo-label">홍보 이벤트</span>`;
  return `
    <div class="event-card" data-id="${ev.id}">
      <div class="card-media">
        <img class="card-photo" src="${ev.image}" alt="${escapeHtml(ev.title)}" loading="lazy" onerror="handleImageError(this)">
        <button class="card-like-btn ${likedEvents.has(ev.id) ? "liked" : ""}" data-id="${ev.id}" aria-label="관심 이벤트로 등록">
          <span class="card-like-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.7-9.3-9C1.3 8 3.6 4.9 6.9 4.9c2 0 3.6 1.1 4.4 2.6h1.4c.8-1.5 2.4-2.6 4.4-2.6 3.3 0 5.6 3.1 4.2 6.6-1.8 4.3-9.3 9-9.3 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>
        </button>
      </div>
      <div class="card-body">
        <div class="card-brand-row">
          <span class="card-brand-left">
            ${logoHtml}
            <span class="card-brand-name">${escapeHtml(ev.brand)}</span>
            ${merchantBadge}
          </span>
          <span class="card-dday-inline">${ev.dday}</span>
        </div>
        <p class="card-title">${escapeHtml(ev.title)}</p>
        ${subtitleHtml}
        ${conditionsHtml}
        <p class="card-discount-row">${cardDiscountText}</p>
        <span class="card-mode-row">${channelModeLabel}</span>
        ${distanceLabel}
        <div class="card-stats">
          <span><svg class="meta-ic" viewBox="0 0 24 24" width="12" height="12" fill="none"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="2"/></svg> ${formatCount((eventStatsCache[ev.id] || {}).views || 0)}</span>
          <span class="stat-heart"><svg class="meta-ic" viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 20.5s-7.5-4.7-9.3-9C1.3 8 3.6 4.9 6.9 4.9c2 0 3.6 1.1 4.4 2.6h1.4c.8-1.5 2.4-2.6 4.4-2.6 3.3 0 5.6 3.1 4.2 6.6-1.8 4.3-9.3 9-9.3 9Z"/></svg> ${formatCount((eventStatsCache[ev.id] || {}).likes || 0)}</span>
        </div>
      </div>
    </div>
  `;
}

function renderFeed() {
  const grid = document.getElementById("feedGrid");
  const title = document.getElementById("feedTitle");
  const count = document.getElementById("feedCount");

  const filtered = getFilteredEvents();

  const currentCat = CATEGORIES.find(c => c.id === currentCategory);
  const baseLabel = currentCategory === "all" ? "전체 이벤트" : `${getCategoryLabel(currentCategory)} 이벤트`;
  const conditionParts = [];
  if (selectedBrands.size === 1) conditionParts.push([...selectedBrands][0]);
  else if (selectedBrands.size > 1) conditionParts.push(`${[...selectedBrands][0]} 외 ${selectedBrands.size - 1}곳`);
  if (currentDiscountFilter === "1+1") conditionParts.push("1+1");
  else if (currentDiscountFilter === "50plus") conditionParts.push("50%+ 할인");
  else if (currentDiscountFilter === "newopen") conditionParts.push("신규오픈");
  if (currentSubTag) conditionParts.push(currentSubTag);
  const titleIcon = conditionParts.length > 0 ? "🎯" : currentCat.icon;
  const titleText = conditionParts.length > 0 ? `${conditionParts.join(" · ")} 이벤트` : baseLabel;
  title.innerHTML = conditionParts.length > 0
    ? `<span class="feed-title-ic feed-title-ic-target">${titleIcon}</span>${titleText}`
    : `<span class="feed-title-ic">${titleIcon}</span>${titleText}`;
  count.textContent = `${filtered.length}개`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">아직 등록된 이벤트가 없어요.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(ev => renderEventCardHtml(ev)).join("");

  grid.querySelectorAll(".event-card").forEach(card => {
    card.addEventListener("click", () => {
      if (card.dataset.id.startsWith("mock-")) {
        showToast("예시 데이터예요 — 실제 이벤트가 승인되면 상세페이지로 연결돼요.");
        return;
      }
      openSheet(card.dataset.id);
    });
  });

  grid.querySelectorAll(".card-like-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation(); // 카드 클릭(상세 열기)으로 전파되지 않도록 방지
      toggleLike(btn.dataset.id);
    });
  });

  grid.querySelectorAll(".card-brand-logo-sm").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}