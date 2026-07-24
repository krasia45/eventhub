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
      renderBrandFilter();
      renderSubcatRow();
      renderPopupRegionBanner();
      renderFeed();
      renderRanking();
      updateDiscoverySectionsVisibility();
    });
  });

  renderBrandFilter();
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
function renderBrandFilter() {
  const outerWrap = document.getElementById("brandFilterWrap");
  const wrap = document.getElementById("brandFilterRow");
  const toggleBtn = document.getElementById("brandFilterToggle");

  if (currentCategory === "all") {
    outerWrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  // 현재 카테고리에 실제로 존재하는 브랜드만 중복 없이 추출
  const brandsInCategory = [];
  const seen = new Set();
  EVENTS.filter(ev => ev.category === currentCategory && isEventLive(ev)).forEach(ev => {
    if (!seen.has(ev.brand)) {
      seen.add(ev.brand);
      brandsInCategory.push(ev);
    }
  });

  if (brandsInCategory.length === 0) {
    outerWrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  outerWrap.hidden = false;
  wrap.classList.remove("expanded");
  toggleBtn.textContent = "더보기 ⌄";
  toggleBtn.hidden = true;

  wrap.innerHTML = brandsInCategory.map(ev => `
    <button class="brand-filter-chip ${selectedBrands.has(ev.brand) ? "selected" : ""}" data-brand="${escapeHtml(ev.brand)}">
      <img class="brand-filter-logo" src="${getLogoUrl(ev.domain)}" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}" alt="${escapeHtml(ev.brand)}">
      <span>${escapeHtml(ev.brand)}</span>
    </button>
  `).join("");

  wrap.querySelectorAll(".brand-filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const brand = chip.dataset.brand;
      if (selectedBrands.has(brand)) {
        selectedBrands.delete(brand);
        chip.classList.remove("selected");
      } else {
        selectedBrands.add(brand);
        chip.classList.add("selected");
      }
      renderFeed();
      renderRanking();
      updateDiscoverySectionsVisibility();
    });
  });

  wrap.querySelectorAll(".brand-filter-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));

  // 실제로 그려진 뒤, 몇 번째 칩부터 다음 줄로 넘어갔는지 측정해서
  // 두 줄 이상이면(=한 줄에 다 안 들어가면) "더보기" 버튼을 보여준다.
  requestAnimationFrame(() => {
    const chips = [...wrap.querySelectorAll(".brand-filter-chip")];
    if (chips.length === 0) return;
    const firstTop = chips[0].offsetTop;
    const wraps = chips.some(chip => chip.offsetTop > firstTop);
    toggleBtn.hidden = !wraps;
  });
}

document.getElementById("brandFilterToggle").addEventListener("click", () => {
  const wrap = document.getElementById("brandFilterRow");
  const toggleBtn = document.getElementById("brandFilterToggle");
  const nowExpanded = wrap.classList.toggle("expanded");
  toggleBtn.textContent = nowExpanded ? "접기 ⌃" : "더보기 ⌄";
});

/* ---------- Discount Quick Filters (1+1 / 50%+) ----------
   '전체' 칩 없이 토글 방식: 켜진 칩을 다시 누르면 해제되어 전체 노출.
   (무신사·에이블리·지그재그 등 주요 커머스 앱의 보조필터 표준 패턴) */
function bindDiscountTabs() {
  const wrap = document.getElementById("discountTabs");
  const allBtn = wrap.querySelector('[data-discount="all"]');
  wrap.querySelectorAll(".discount-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const isAllBtn = btn.dataset.discount === "all";
      const isActive = btn.classList.contains("active");
      wrap.querySelectorAll(".discount-pill").forEach(b => b.classList.remove("active"));
      if (isAllBtn || isActive) {
        // '전체'를 눌렀거나, 이미 선택된 칩을 다시 눌러 해제한 경우 → 전체로 복귀
        currentDiscountFilter = "all";
        allBtn.classList.add("active");
      } else {
        currentDiscountFilter = btn.dataset.discount;
        btn.classList.add("active");
      }
      trackFilterUse(`discount:${currentDiscountFilter}`);
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

function renderEventCardHtml(ev) {
  const distanceLabel = (gpsFilterActive && userLocation)
    ? `<span class="card-distance">${haversineDistanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng).toFixed(1)}km</span>`
    : "";
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
  const cardDiscountText = escapeHtml((ev.discount || "").split(/\s+\+\s+/)[0].trim());
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
        <p class="card-discount-row">${cardDiscountText}</p>
        ${conditionsHtml}
        <span class="card-mode-row">${getChannelMode(ev)}</span>
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