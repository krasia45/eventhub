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

  if (currentCategory === "all") {
    wrap.hidden = true;
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
    wrap.hidden = true;
    wrap.innerHTML = "";
    return;
  }

  wrap.hidden = false;
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

  const fireIconSvg = `<svg class="fire-icon" viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><defs><linearGradient id="fireGrad" x1="0.5" y1="1" x2="0.5" y2="0"><stop offset="0%" stop-color="#A8130A"/><stop offset="45%" stop-color="#FF6F00"/><stop offset="80%" stop-color="#FFB020"/><stop offset="100%" stop-color="#FFE477"/></linearGradient></defs><path d="M12.2 1.3c2.1 3.8-1.8 5.6-3.3 9.2-1.4 3.4.4 6.9 3.5 7.8a3.6 3.6 0 0 0 4.6-3.5c0-.8-.2-1.5-.5-2.1 2.6 2.6 5.3 5 5 9-.3 4.4-4.2 7.5-8.6 7-4.1-.4-7.3-4-7.1-8.2.3-6.4 6.2-8 6.1-15.4 0-1.4.3-2.5 1.3-3.8Z" fill="url(#fireGrad)"/><path d="M13 9.5c.6 1.3-.9 2-1.1 3.6a1.9 1.9 0 0 0 3.7.5c.1-.5 0-.9-.2-1.3 1.2 1.4 2.1 2.4 1.8 4.2a3.4 3.4 0 0 1-6.7-.6c.4-2.9 2.9-3.5 2.5-6.4Z" fill="#FFF3C4" opacity="0.85"/></svg>`;
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