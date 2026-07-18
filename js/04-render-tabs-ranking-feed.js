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
    <li class="rank-card" data-id="${ev.id}">
      <span class="rank-badge">${idx + 1}</span>
      <div class="rank-card-media">
        <img class="rank-card-photo" src="${ev.image}" alt="${ev.title}" loading="lazy">
        <span class="rank-card-discount">${ev.discount}</span>
      </div>
      <div class="rank-card-body">
        <img class="rank-card-logo" data-domain="${ev.domain}" data-brand="${ev.brand}" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고">
        <div class="rank-card-info">
          <p class="rank-card-brand"><span class="rank-card-live-tag">실시간</span> ${ev.brand}</p>
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