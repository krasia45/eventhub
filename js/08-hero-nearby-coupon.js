/* ---------- Hero Button ---------- */
/* ---------- 히어로 배너 캐러셀 (카테고리별 실제 인기 이벤트 1위로 자동 구성, 스와이프 가능) ---------- */
const HERO_GRADIENTS = [
  "linear-gradient(135deg, #FF7A45 0%, #FF4D6D 100%)",
  "linear-gradient(135deg, #6C63FF 0%, #A78BFA 100%)",
  "linear-gradient(135deg, #16A085 0%, #38EF7D 100%)",
  "linear-gradient(135deg, #F857A6 0%, #FF5858 100%)",
  "linear-gradient(135deg, #2C3E50 0%, #4CA1AF 100%)",
];

function renderHeroCarousel() {
  const track = document.getElementById("heroCarousel");
  const counterEl = document.getElementById("heroCarouselCounter");

  // 카테고리(전체 제외)별로 실제 등록된 이벤트 중 인기순 1위를 뽑아 슬라이드 구성
  const slides = [];
  CATEGORIES.filter(c => c.id !== "all").forEach((cat, i) => {
    const top = [...EVENTS]
      .filter(ev => ev.category === cat.id && isEventLive(ev))
      .sort((a, b) => getEventScore(b.id) - getEventScore(a.id))[0];
    if (top) slides.push({ event: top, category: cat, gradient: HERO_GRADIENTS[i % HERO_GRADIENTS.length] });
  });

  if (slides.length === 0) {
    track.innerHTML = `<div class="hero-slide" style="background:${HERO_GRADIENTS[0]}"><p class="hero-eyebrow">EVENTHUB</p><h2 class="hero-title">흩어진 모든 할인,<br>하나의 앱</h2></div>`;
    counterEl.textContent = "1/1";
    track.dataset.slideCount = 1;
    return;
  }

  track.innerHTML = slides.map(s => `
    <div class="hero-slide" data-cat="${s.category.id}" data-event-id="${s.event.id}" style="background:${s.gradient}">
      <p class="hero-eyebrow">${s.category.label.toUpperCase()}</p>
      <h2 class="hero-title">${escapeHtml(s.event.brand)}<br>${escapeHtml(s.event.title)}</h2>
      <p class="hero-sub">${escapeHtml(s.event.discount)}</p>
      <button class="hero-btn" data-event-id="${s.event.id}">지금 확인하기 →</button>
      <img class="hero-slide-img" src="${s.event.image}" alt="${escapeHtml(s.event.title)}" onerror="handleImageError(this)">
    </div>
  `).join("");

  counterEl.textContent = `1/${slides.length}`;
  track.dataset.slideCount = slides.length; // 스크롤 리스너(함수 밖에서 1회만 등록됨)가 최신 슬라이드 개수를 읽을 수 있도록

  track.querySelectorAll(".hero-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSheet(btn.dataset.eventId);
    });
  });
}

// 캐러셀 스크롤 카운터 갱신 리스너는 renderHeroCarousel() 안이 아니라 여기(모듈 로드 시 1회)에서만 등록한다.
// renderHeroCarousel()은 향후 필터 변경 등으로 여러 번 재호출될 수 있는데, 그 함수 내부에서
// track.addEventListener("scroll", ...)를 매번 호출하면 리스너가 계속 누적되어
// 스크롤할 때마다 콜백이 중복 실행되는 버그가 생긴다(현재는 1회만 호출되어 우연히 문제가 없었음).
document.getElementById("heroCarousel").addEventListener("scroll", function () {
  const track = this;
  const slideCount = parseInt(track.dataset.slideCount || "1", 10);
  const counterEl = document.getElementById("heroCarouselCounter");
  const idx = Math.round(track.scrollLeft / track.clientWidth);
  counterEl.textContent = `${Math.min(idx + 1, slideCount)}/${slideCount}`;
});

/* ---------- 내 주변 인기 이벤트 (GPS 조용히 시도 → 실패 시 서울 기준으로 대체) ---------- */
/* ---------- 오늘 마감임박 (실시간성 신호) ----------
   오늘(D-Day)에 정확히 마감하는 이벤트만, 인기순으로 최대 8개.
   데이터가 없는 날은 섹션 자체를 숨긴다 — 가짜 데이터로 채우지 않는다. */
function renderEndingTodaySection() {
  const section = document.getElementById("endingTodaySection");
  const scroll = document.getElementById("endingTodayScroll");

  const endingToday = EVENTS
    .filter(ev => isEventLive(ev) && ev.dday === "D-Day")
    .sort((a, b) => getEventScore(b.id) - getEventScore(a.id))
    .slice(0, 8);

  if (endingToday.length === 0) {
    section.hidden = true;
    endingTodayHasData = false;
    updateDiscoverySectionsVisibility();
    return;
  }
  endingTodayHasData = true;
  section.hidden = false;

  scroll.innerHTML = endingToday.map((ev, idx) => {
    const stats = eventStatsCache[ev.id] || { views: 0, likes: 0 };
    const cardDiscountText = escapeHtml((ev.discount || "").split(/\s+\+\s+/)[0].trim());
    const logoHtml = ev.domain
      ? `<img class="card-brand-logo-sm" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}" src="${getLogoUrl(ev.domain)}" alt="">`
      : "";
    return `
      <div class="nearby-card ending-today-card" data-id="${ev.id}">
        <div class="nearby-card-media">
          <img src="${getEventThumbnail(ev)}" alt="${escapeHtml(ev.title)}" loading="lazy" onerror="handleImageError(this)">
          <button class="card-like-btn nearby-like ${likedEvents.has(ev.id) ? "liked" : ""}" data-id="${ev.id}" aria-label="관심 이벤트로 등록">
            <span class="card-like-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.7-9.3-9C1.3 8 3.6 4.9 6.9 4.9c2 0 3.6 1.1 4.4 2.6h1.4c.8-1.5 2.4-2.6 4.4-2.6 3.3 0 5.6 3.1 4.2 6.6-1.8 4.3-9.3 9-9.3 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>
          </button>
        </div>
        <div class="nearby-card-brand-row">
          <span class="card-brand-left">
            <span class="nearby-rank-num ${idx < 3 ? "nearby-rank-hot" : "nearby-rank-alt"}">${idx + 1}</span>
            ${logoHtml}
            <p class="nearby-card-brand">${escapeHtml(ev.brand)}</p>
          </span>
          <span class="card-dday-inline ending-today-badge">오늘마감</span>
        </div>
        <p class="nearby-card-title">${escapeHtml(ev.title)}</p>
        ${cardDiscountText ? `<p class="nearby-card-discount">${cardDiscountText}</p>` : ""}
        <div class="nearby-card-stats">
          <span>👁 ${formatCount(stats.views)}</span>
          <span class="stat-heart">❤️ ${formatCount(stats.likes)}</span>
        </div>
      </div>
    `;
  }).join("");

  scroll.querySelectorAll(".ending-today-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });
  scroll.querySelectorAll(".nearby-like").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(btn.dataset.id); });
  });
  scroll.querySelectorAll(".card-brand-logo-sm").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
  updateDiscoverySectionsVisibility();
}

async function renderNearbySection() {
  const section = document.getElementById("nearbySection");
  const scroll = document.getElementById("nearbyScroll");

  if (EVENTS.length === 0) { section.hidden = true; nearbyHasData = false; updateDiscoverySectionsVisibility(); return; }

  const loc = await getQuietLocation();
  const NEARBY_RADIUS_KM = 15;

  const nearby = EVENTS
    .filter(ev => ev.lat != null && ev.lng != null && isEventLive(ev)) // 좌표 없는 온라인 전용 이벤트, 종료된 이벤트는 '내 주변'에서 애초에 제외
    .map(ev => ({ ev, dist: haversineDistanceKm(loc.lat, loc.lng, ev.lat, ev.lng) }))
    .filter(x => x.dist <= NEARBY_RADIUS_KM)
    .sort((a, b) => getEventScore(b.ev.id) - getEventScore(a.ev.id))
    .slice(0, 8);

  if (nearby.length === 0) { section.hidden = true; nearbyHasData = false; updateDiscoverySectionsVisibility(); return; }

  nearbyHasData = true;
  section.hidden = false;

  scroll.innerHTML = nearby.map(({ ev, dist }, idx) => {
    const distLabel = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
    const stats = eventStatsCache[ev.id] || { views: 0, likes: 0 };
    const cardDiscountText = escapeHtml((ev.discount || "").split(/\s+\+\s+/)[0].trim());
    const conditionsHtml = ev.conditions
      ? `<p class="card-conditions-row">${escapeHtml(ev.conditions)}</p>`
      : "";
    const logoHtml = ev.domain
      ? `<img class="card-brand-logo-sm" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}" src="${getLogoUrl(ev.domain)}" alt="">`
      : "";
    return `
      <div class="nearby-card" data-id="${ev.id}">
        <div class="nearby-card-media">
          <img src="${getEventThumbnail(ev)}" alt="${escapeHtml(ev.title)}" loading="lazy" onerror="handleImageError(this)">
          <button class="card-like-btn nearby-like ${likedEvents.has(ev.id) ? "liked" : ""}" data-id="${ev.id}" aria-label="관심 이벤트로 등록">
            <span class="card-like-icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 20.5s-7.5-4.7-9.3-9C1.3 8 3.6 4.9 6.9 4.9c2 0 3.6 1.1 4.4 2.6h1.4c.8-1.5 2.4-2.6 4.4-2.6 3.3 0 5.6 3.1 4.2 6.6-1.8 4.3-9.3 9-9.3 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></span>
          </button>
        </div>
        <div class="nearby-card-brand-row">
          <span class="card-brand-left">
            <span class="nearby-rank-num ${idx < 3 ? "nearby-rank-hot" : "nearby-rank-alt"}">${idx + 1}</span>
            ${logoHtml}
            <p class="nearby-card-brand">${escapeHtml(ev.brand)}</p>
          </span>
          <span class="card-dday-inline">${ev.dday}</span>
        </div>
        <p class="nearby-card-title">${escapeHtml(ev.title)}</p>
        ${cardDiscountText ? `<p class="nearby-card-discount">${cardDiscountText}</p>` : ""}
        ${conditionsHtml}
        <div class="nearby-card-mode-row">
          <span class="card-mode-row">${getChannelMode(ev)}</span>
          <span class="card-distance">${distLabel}</span>
        </div>
        <div class="nearby-card-stats">
          <span>👁 ${formatCount(stats.views)}</span>
          <span class="stat-heart">❤️ ${formatCount(stats.likes)}</span>
        </div>
      </div>
    `;
  }).join("");

  scroll.querySelectorAll(".nearby-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });
  scroll.querySelectorAll(".nearby-like").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(btn.dataset.id); });
  });
  scroll.querySelectorAll(".card-brand-logo-sm").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));

  updateDiscoverySectionsVisibility();
}

/* ---------- Bottom Nav (visual only, Home is functional) ---------- */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // 탭 배치(Home 중앙 등)가 실제로 맞는 선택인지 나중에 데이터로 검증하기 위한 집계.
    // 실패해도 조용히 무시 — 부가 기능이 메인 기능을 막으면 안 됨.
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "navClick", tab: btn.dataset.nav }),
    }).catch(() => {});

    if (btn.dataset.nav === "saved") {
      openCouponWallet();
    } else if (btn.dataset.nav === "map") {
      openMapPage();
    } else if (btn.dataset.nav === "calendar") {
      openCalendar();
    } else if (btn.dataset.nav === "profile") {
      openAuthModal();
    } else if (btn.dataset.nav !== "home") {
      showToast("준비 중인 기능이에요");
    }
  });
});

/* ---------- 통합 쿠폰함 (관심 등록한 이벤트 모아보기) ---------- */
const couponWalletOverlay = document.getElementById("couponWalletOverlay");

function openCouponWallet() {
  currentWalletTab = "all";
  walletSelectedBrand = null;
  document.getElementById("walletTabRow").querySelectorAll(".wallet-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("walletTabRow").querySelector('[data-wallet-tab="all"]').classList.add("active");
  document.getElementById("walletBrandTabBtn").innerHTML = `브랜드 <span class="filter-chev">⌄</span>`;
  document.getElementById("walletBrandDropdown").hidden = true;
  renderCouponWallet();
  couponWalletOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  pushModalHistory(closeCouponWallet);
}

function closeCouponWallet() {
  couponWalletOverlay.classList.remove("open");
  document.body.style.overflow = "";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelector('.nav-item[data-nav="home"]').classList.add("active");
}

let currentWalletTab = "all"; // "all" | "brand"
let walletSelectedBrand = null;
let walletSortMode = "recent"; // "recent"(최신저장순) | "closing"(만료임박순)
let walletShowEnded = false;   // 기본은 방문예정 위주로 — 종료된 쿠폰은 원하면 토글해서 봄

function renderCouponWallet() {
  const listEl = document.getElementById("couponWalletList");
  // likedEvents는 Set이라 삽입 순서를 그대로 보존한다 — 이 순서를 뒤집으면 "최근에 찜한 게 먼저" 정렬이 된다.
  let likedList = [...likedEvents].map(id => EVENTS.find(ev => ev.id === id)).filter(Boolean).reverse();

  if (!walletShowEnded) likedList = likedList.filter(ev => ev.dday !== "종료");
  if (currentWalletTab === "brand" && walletSelectedBrand) {
    likedList = likedList.filter(ev => ev.brand === walletSelectedBrand);
  }

  if (walletSortMode === "closing") {
    // 종료 안 된 것 먼저(마감 빠른 순), 종료된 건 맨 뒤
    likedList = [...likedList].sort((a, b) => {
      if (a.dday === "종료" && b.dday !== "종료") return 1;
      if (a.dday !== "종료" && b.dday === "종료") return -1;
      return new Date(a.periodEnd) - new Date(b.periodEnd);
    });
  }

  const allLiked = [...likedEvents].map(id => EVENTS.find(ev => ev.id === id)).filter(Boolean);
  document.getElementById("walletTabRow").querySelector('[data-wallet-tab="all"]').textContent = `전체 ${allLiked.length}`;

  if (allLiked.length === 0) {
    listEl.innerHTML = `<li class="empty-state">아직 관심 등록한 이벤트가 없어요. 이벤트 상세에서 ♡를 눌러보세요!</li>`;
    return;
  }
  if (likedList.length === 0) {
    listEl.innerHTML = `<li class="empty-state">${walletSelectedBrand ? `${escapeHtml(walletSelectedBrand)}의 쿠폰이 없어요.` : "표시할 쿠폰이 없어요."}</li>`;
    return;
  }

  listEl.innerHTML = likedList.map(ev => `
    <li class="coupon-wallet-item ${ev.dday === "종료" ? "wallet-item-ended" : ""}" data-id="${ev.id}">
      <img class="coupon-wallet-logo" src="${getLogoUrl(ev.domain)}" alt="${escapeHtml(ev.brand)} 로고" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}">
      <div class="coupon-wallet-info">
        <p class="coupon-wallet-brand">${escapeHtml(ev.brand)}</p>
        <p class="coupon-wallet-item-title">${escapeHtml(ev.title)}</p>
        <p class="coupon-wallet-period">${escapeHtml(ev.period)}</p>
      </div>
      <div class="coupon-wallet-right">
        ${ev.dday ? `<span class="wallet-dday ${ev.dday === "종료" ? "wallet-dday-ended" : ""}">${ev.dday}</span>` : ""}
        <span class="coupon-wallet-discount">${escapeHtml(ev.discount)}</span>
      </div>
      <button class="wallet-item-remove" data-id="${ev.id}" aria-label="목록에서 삭제">✕</button>
    </li>
  `).join("");

  listEl.querySelectorAll(".coupon-wallet-item").forEach(item => {
    item.addEventListener("click", () => {
      closeCouponWallet();
      popModalHistory();
      openSheet(item.dataset.id);
    });
  });
  listEl.querySelectorAll(".coupon-wallet-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
  listEl.querySelectorAll(".wallet-item-remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLike(btn.dataset.id);
      renderCouponWallet();
    });
  });
}

/* ---------- 브랜드별 모아보기 드롭다운 ----------
   원래 의도: 여러 브랜드에 흩어진 내 쿠폰을 브랜드 단위로 묶어서 보는 것.
   찜한 이벤트에 실제로 존재하는 브랜드만 나열한다(안 찜한 브랜드는 안 보여줌). */
function renderWalletBrandDropdown() {
  const dropdown = document.getElementById("walletBrandDropdown");
  const allLiked = [...likedEvents].map(id => EVENTS.find(ev => ev.id === id)).filter(Boolean);
  const brandCount = {};
  allLiked.forEach(ev => { brandCount[ev.brand] = (brandCount[ev.brand] || 0) + 1; });
  const brands = Object.keys(brandCount).sort((a, b) => brandCount[b] - brandCount[a]);

  if (brands.length === 0) {
    dropdown.innerHTML = `<p class="wallet-brand-empty">쿠폰함에 담긴 이벤트가 없어요.</p>`;
    return;
  }
  dropdown.innerHTML = brands.map(b => `
    <button type="button" class="wallet-brand-item ${walletSelectedBrand === b ? "active" : ""}" data-brand="${escapeHtml(b)}">
      <span>${escapeHtml(b)}</span><span class="wallet-brand-count">${brandCount[b]}</span>
    </button>
  `).join("");
  dropdown.querySelectorAll(".wallet-brand-item").forEach(btn => {
    btn.addEventListener("click", () => {
      walletSelectedBrand = btn.dataset.brand;
      currentWalletTab = "brand";
      document.getElementById("walletTabRow").querySelectorAll(".wallet-tab").forEach(t => t.classList.remove("active"));
      document.getElementById("walletBrandTabBtn").classList.add("active");
      document.getElementById("walletBrandTabBtn").innerHTML = `${escapeHtml(walletSelectedBrand)} <span class="filter-chev">⌄</span>`;
      dropdown.hidden = true;
      renderCouponWallet();
    });
  });
}
document.getElementById("walletBrandTabBtn").addEventListener("click", (e) => {
  e.stopPropagation();
  const dropdown = document.getElementById("walletBrandDropdown");
  const nowOpen = dropdown.hidden;
  if (nowOpen) renderWalletBrandDropdown();
  dropdown.hidden = !nowOpen;
});
document.getElementById("walletTabRow").querySelector('[data-wallet-tab="all"]').addEventListener("click", () => {
  currentWalletTab = "all";
  walletSelectedBrand = null;
  document.getElementById("walletBrandDropdown").hidden = true;
  document.getElementById("walletTabRow").querySelectorAll(".wallet-tab").forEach(t => t.classList.remove("active"));
  document.getElementById("walletTabRow").querySelector('[data-wallet-tab="all"]').classList.add("active");
  document.getElementById("walletBrandTabBtn").innerHTML = `브랜드 <span class="filter-chev">⌄</span>`;
  renderCouponWallet();
});
document.addEventListener("click", (e) => {
  const dropdown = document.getElementById("walletBrandDropdown");
  if (!dropdown.hidden && !dropdown.contains(e.target) && e.target.id !== "walletBrandTabBtn" && !document.getElementById("walletBrandTabBtn").contains(e.target)) {
    dropdown.hidden = true;
  }
});

/* ---------- 정렬 + 종료쿠폰 토글 ---------- */
document.getElementById("walletSortRow").querySelectorAll(".wallet-sort-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    walletSortMode = chip.dataset.walletSort;
    document.querySelectorAll(".wallet-sort-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    renderCouponWallet();
  });
});
document.getElementById("walletShowEnded").addEventListener("change", (e) => {
  walletShowEnded = e.target.checked;
  renderCouponWallet();
});

document.getElementById("couponWalletClose").addEventListener("click", () => { closeCouponWallet(); popModalHistory(); });
document.getElementById("couponWalletClearBtn").addEventListener("click", () => {
  const likedList = EVENTS.filter(ev => likedEvents.has(ev.id));
  if (likedList.length === 0) return;
  if (!confirm(`쿠폰함에 담긴 ${likedList.length}개를 전부 삭제할까요?`)) return;
  likedList.forEach(ev => toggleLike(ev.id));
  renderCouponWallet();
});

/* ---------- 최근 본 이벤트 (상세페이지 열 때마다 자동 기록, 최신순 최대 20개) ---------- */
const recentViewOverlay = document.getElementById("recentViewOverlay");

function recordRecentlyViewed(eventId) {
  recentlyViewed = recentlyViewed.filter(id => id !== eventId); // 중복 제거(다시 보면 맨 위로)
  recentlyViewed.unshift(eventId);
  recentlyViewed = recentlyViewed.slice(0, 20);
  localStorage.setItem("eventhub-recent", JSON.stringify(recentlyViewed));
}

function openRecentView() {
  renderRecentView();
  recentViewOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  pushModalHistory(closeRecentView);
}

function closeRecentView() {
  recentViewOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

function renderRecentView() {
  const listEl = document.getElementById("recentViewList");
  // 기록 순서(최신순) 그대로, 실제 이벤트 데이터와 매칭되는 것만
  const recentList = recentlyViewed.map(id => EVENTS.find(ev => ev.id === id)).filter(Boolean);

  if (recentList.length === 0) {
    listEl.innerHTML = `<li class="empty-state">아직 확인한 이벤트가 없어요. 이벤트를 열어보면 여기에 기록돼요!</li>`;
    return;
  }

  listEl.innerHTML = recentList.map(ev => `
    <li class="coupon-wallet-item" data-id="${ev.id}">
      <img class="coupon-wallet-logo" src="${getLogoUrl(ev.domain)}" alt="${escapeHtml(ev.brand)} 로고" data-domain="${ev.domain}" data-brand="${escapeHtml(ev.brand)}">
      <div class="coupon-wallet-info">
        <p class="coupon-wallet-brand">${escapeHtml(ev.brand)}</p>
        <p class="coupon-wallet-item-title">${escapeHtml(ev.title)}</p>
        <p class="coupon-wallet-period">${escapeHtml(ev.period)}</p>
      </div>
      <div class="coupon-wallet-right">
        ${ev.dday ? `<span class="wallet-dday ${ev.dday === "종료" ? "wallet-dday-ended" : ""}">${ev.dday}</span>` : ""}
        <span class="coupon-wallet-discount">${escapeHtml(ev.discount)}</span>
      </div>
      <button class="wallet-item-remove" data-id="${ev.id}" aria-label="기록에서 삭제">✕</button>
    </li>
  `).join("");

  listEl.querySelectorAll(".coupon-wallet-item").forEach(item => {
    item.addEventListener("click", () => {
      closeRecentView();
      popModalHistory();
      openSheet(item.dataset.id);
    });
  });
  listEl.querySelectorAll(".coupon-wallet-logo").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
  listEl.querySelectorAll(".wallet-item-remove").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeRecentlyViewed(btn.dataset.id);
      renderRecentView();
    });
  });
}

function removeRecentlyViewed(eventId) {
  recentlyViewed = recentlyViewed.filter(id => id !== eventId);
  localStorage.setItem("eventhub-recent", JSON.stringify(recentlyViewed));
}

document.getElementById("recentViewClose").addEventListener("click", () => { closeRecentView(); popModalHistory(); });
document.getElementById("recentViewClearBtn").addEventListener("click", () => {
  if (recentlyViewed.length === 0) return;
  if (!confirm(`최근 본 이벤트 기록 ${recentlyViewed.length}개를 전부 삭제할까요?`)) return;
  recentlyViewed = [];
  localStorage.setItem("eventhub-recent", JSON.stringify(recentlyViewed));
  renderRecentView();
});
recentViewOverlay.addEventListener("click", (e) => {
  if (e.target === recentViewOverlay) { closeRecentView(); popModalHistory(); }
});
document.getElementById("walletTabRow").addEventListener("click", (e) => {
  const tab = e.target.closest(".wallet-tab");
  if (!tab) return;
  currentWalletTab = tab.dataset.walletTab;
  document.querySelectorAll(".wallet-tab").forEach(t => t.classList.toggle("active", t === tab));
  renderCouponWallet();
});
couponWalletOverlay.addEventListener("click", (e) => {
  if (e.target === couponWalletOverlay) { closeCouponWallet(); popModalHistory(); }
});