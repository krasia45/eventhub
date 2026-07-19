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
      currentSubTag = null;   // 서브카테고리도 초기화
      renderCategoryTabs();
      renderBrandFilter();
      renderSubcatRow();
      renderFeed();
      renderRanking();
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
  EVENTS.filter(ev => ev.category === currentCategory)
    .forEach(ev => (ev.tags || []).forEach(t => { tagCount[t] = (tagCount[t] || 0) + 1; }));
  const tags = Object.entries(tagCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  if (tags.length === 0) { row.hidden = true; row.innerHTML = ""; return; }

  row.hidden = false;
  row.innerHTML = `<button class="subcat-chip ${!currentSubTag ? "active" : ""}" data-subtag="">전체</button>`
    + tags.map(t => `<button class="subcat-chip ${currentSubTag === t ? "active" : ""}" data-subtag="${t}">${t}</button>`).join("");
  row.querySelectorAll(".subcat-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      currentSubTag = chip.dataset.subtag || null;
      renderSubcatRow();
      renderFeed();
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
  EVENTS.filter(ev => ev.category === currentCategory).forEach(ev => {
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
    <button class="brand-filter-chip ${selectedBrands.has(ev.brand) ? "selected" : ""}" data-brand="${ev.brand}">
      <img class="brand-filter-logo" src="${getLogoUrl(ev.domain)}" data-domain="${ev.domain}" data-brand="${ev.brand}" alt="${ev.brand}">
      <span>${ev.brand}</span>
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
  wrap.querySelectorAll(".discount-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const isActive = btn.classList.contains("active");
      wrap.querySelectorAll(".discount-pill").forEach(b => b.classList.remove("active"));
      if (isActive) {
        currentDiscountFilter = "all";
      } else {
        currentDiscountFilter = btn.dataset.discount;
        btn.classList.add("active");
      }
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

  const fireIconSvg = `<img class="flame-icon-img" src="assets/flame-icon.png?v20260718d" alt="" aria-hidden="true">`;
  titleEl.innerHTML = currentCategory === "all"
    ? `${fireIconSvg} 실시간 인기 이벤트`
    : `${fireIconSvg} ${getCategoryLabel(currentCategory)} 인기 이벤트`;

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
    <li class="rank-row" data-id="${ev.id}">
      <span class="rank-num ${idx < 3 ? "rank-num-hot" : "rank-num-alt"}">${idx + 1}</span>
      <img class="rank-thumb" src="${ev.image}" alt="" loading="lazy" onerror="handleImageError(this)">
      <div class="rank-row-info">
        <p class="rank-row-title">${ev.title}</p>
        <p class="rank-row-sub">${ev.discount}</p>
        <span class="rank-interest"><img class="rank-interest-flame" src="assets/flame-icon.png?v20260718d" alt=""> ${formatCount((eventStatsCache[ev.id] || {}).views || 0)}명 관심중</span>
      </div>
      <button class="card-like-btn rank-like ${likedEvents.has(ev.id) ? "liked" : ""}" data-id="${ev.id}" aria-label="관심 이벤트로 등록">
        <span class="card-like-icon">${likedEvents.has(ev.id) ? "❤️" : "🤍"}</span>
      </button>
    </li>
  `).join("");

  list.querySelectorAll(".rank-row").forEach(item => {
    item.addEventListener("click", () => openSheet(item.dataset.id));
  });
  list.querySelectorAll(".rank-like").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(btn.dataset.id); });
  });
}

/* ---------- Render: Feed Grid ---------- */
function renderEventCardHtml(ev) {
  const distanceLabel = (gpsFilterActive && userLocation)
    ? `<span class="card-distance">${haversineDistanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng).toFixed(1)}km</span>`
    : "";
  const merchantBadge = ev.merchantType === "소상공인"
    ? `<span class="card-merchant-badge">소상공인</span>`
    : "";
  const verifiedBadge = ev.isVerifiedReal
    ? `<span class="card-verified-badge">✓ 실제 진행중</span>`
    : "";
  const subtitleHtml = ev.subtitle
    ? `<p class="card-sub">${ev.subtitle}</p>`
    : "";
  const channelHtml = ev.channel
    ? `<p class="card-meta"><svg class="meta-ic" viewBox="0 0 24 24" width="11" height="11" fill="none"><path d="M12 21s7-6.3 7-11.5A7 7 0 0 0 5 9.5C5 14.7 12 21 12 21Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="9.5" r="2.2" stroke="currentColor" stroke-width="2"/></svg> ${ev.channel}</p>`
    : "";
  // 카드의 할인 배지는 한 줄짜리 요약 공간이라, "A + B + C"처럼 여러 혜택이 이어진
  // 대형 프로모션이면 대표 혜택(첫 항목)만 보여준다. 전체 목록은 상세페이지 혜택칩에서
  // 그대로 다 보여주므로(ev.discount 원본은 안 건드림) 정보 손실은 없다.
  const cardDiscountText = (ev.discount || "").split(/\s+\+\s+/)[0].trim();
  return `
    <div class="event-card" data-id="${ev.id}">
      <div class="card-media">
        <img class="card-photo" src="${ev.image}" alt="${ev.title}" loading="lazy" onerror="handleImageError(this)">
        <button class="card-like-btn ${likedEvents.has(ev.id) ? "liked" : ""}" data-id="${ev.id}" aria-label="관심 이벤트로 등록">
          <span class="card-like-icon">${likedEvents.has(ev.id) ? "❤️" : "🤍"}</span>
        </button>
        <span class="card-logo-badge">
          <img data-domain="${ev.domain}" data-brand="${ev.brand}" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고">
        </span>
        <span class="card-discount">${cardDiscountText}</span>
        <span class="card-dday">${ev.dday}</span>
        ${distanceLabel}
      </div>
      <div class="card-body">
        <p class="card-brand-name">${ev.brand} ${merchantBadge}</p>
        ${verifiedBadge}
        <p class="card-title">${ev.title}</p>
        ${subtitleHtml}
        ${channelHtml}
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

  title.textContent = currentCategory === "all" ? "전체 이벤트" : `${getCategoryLabel(currentCategory)} 이벤트`;
  count.textContent = `${filtered.length}개`;

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">아직 등록된 이벤트가 없어요.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(ev => renderEventCardHtml(ev)).join("");

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