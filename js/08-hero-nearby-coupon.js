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
      .filter(ev => ev.category === cat.id)
      .sort((a, b) => getEventScore(b.id) - getEventScore(a.id))[0];
    if (top) slides.push({ event: top, category: cat, gradient: HERO_GRADIENTS[i % HERO_GRADIENTS.length] });
  });

  if (slides.length === 0) {
    track.innerHTML = `<div class="hero-slide" style="background:${HERO_GRADIENTS[0]}"><p class="hero-eyebrow">EVENTHUB</p><h2 class="hero-title">흩어진 모든 할인,<br>하나의 앱</h2></div>`;
    counterEl.textContent = "1/1";
    return;
  }

  track.innerHTML = slides.map(s => `
    <div class="hero-slide" data-cat="${s.category.id}" data-event-id="${s.event.id}" style="background:${s.gradient}">
      <p class="hero-eyebrow">${s.category.label.toUpperCase()}</p>
      <h2 class="hero-title">${s.event.brand}<br>${s.event.title}</h2>
      <p class="hero-sub">${s.event.discount}</p>
      <button class="hero-btn" data-event-id="${s.event.id}">지금 확인하기 →</button>
      <img class="hero-slide-img" src="${s.event.image}" alt="${s.event.title}" onerror="handleImageError(this)">
    </div>
  `).join("");

  counterEl.textContent = `1/${slides.length}`;

  track.querySelectorAll(".hero-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openSheet(btn.dataset.eventId);
    });
  });

  // 스크롤 위치로 현재 슬라이드 번호 계산해서 카운터 갱신
  track.addEventListener("scroll", () => {
    const idx = Math.round(track.scrollLeft / track.clientWidth);
    counterEl.textContent = `${Math.min(idx + 1, slides.length)}/${slides.length}`;
  });
}

/* ---------- 내 주변 인기 이벤트 (GPS 조용히 시도 → 실패 시 서울 기준으로 대체) ---------- */
async function renderNearbySection() {
  const section = document.getElementById("nearbySection");
  const scroll = document.getElementById("nearbyScroll");

  if (EVENTS.length === 0) { section.hidden = true; nearbyHasData = false; updateDiscoverySectionsVisibility(); return; }

  const loc = await getQuietLocation();
  const NEARBY_RADIUS_KM = 15;

  const nearby = EVENTS
    .map(ev => ({ ev, dist: haversineDistanceKm(loc.lat, loc.lng, ev.lat, ev.lng) }))
    .filter(x => x.dist <= NEARBY_RADIUS_KM)
    .sort((a, b) => getEventScore(b.ev.id) - getEventScore(a.ev.id))
    .slice(0, 8);

  if (nearby.length === 0) { section.hidden = true; nearbyHasData = false; updateDiscoverySectionsVisibility(); return; }

  nearbyHasData = true;
  section.hidden = false;

  scroll.innerHTML = nearby.map(({ ev, dist }) => {
    const distLabel = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
    const stats = eventStatsCache[ev.id] || { views: 0, likes: 0 };
    return `
      <div class="nearby-card" data-id="${ev.id}">
        <div class="nearby-card-media">
          <img src="${ev.image}" alt="${ev.title}" loading="lazy" onerror="handleImageError(this)">
          <span class="nearby-card-distance">📍 ${distLabel}</span>
        </div>
        <p class="nearby-card-brand">${ev.brand}</p>
        <p class="nearby-card-title">${ev.title}</p>
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

  updateDiscoverySectionsVisibility();
}

/* ---------- Bottom Nav (visual only, Home is functional) ---------- */
document.querySelectorAll(".nav-item").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    // 탭 배치(Home 중앙 등)가 실제로 맞는 선택인지 나중에 데이터로 검증하기 위한 집계.
    // 실패해도 조용히 무시 — 부가 기능이 메인 기능을 막으면 안 됨.
    fetch("/api/stats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "navClick", tab: btn.dataset.nav }),
    }).catch(() => {});

    if (btn.dataset.nav === "saved") {
      openCouponWallet();
    } else if (btn.dataset.nav === "search") {
      openTravelPlanner();
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
  renderCouponWallet();
  couponWalletOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeCouponWallet() {
  couponWalletOverlay.classList.remove("open");
  document.body.style.overflow = "";
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.querySelector('.nav-item[data-nav="home"]').classList.add("active");
}

let currentWalletTab = "all";

function renderCouponWallet() {
  const listEl = document.getElementById("couponWalletList");
  const likedList = EVENTS.filter(ev => likedEvents.has(ev.id));

  // 탭별 분류: 방문 예정 = 아직 안 끝난 것, 종료 = dday가 "종료"
  const upcoming = likedList.filter(ev => ev.dday !== "종료");
  const ended = likedList.filter(ev => ev.dday === "종료");
  const shown = currentWalletTab === "upcoming" ? upcoming
    : currentWalletTab === "ended" ? ended : likedList;

  // 탭 라벨에 개수 반영
  const tabRow = document.getElementById("walletTabRow");
  tabRow.querySelector('[data-wallet-tab="all"]').textContent = `전체 ${likedList.length}`;
  tabRow.querySelector('[data-wallet-tab="upcoming"]').textContent = `방문 예정 ${upcoming.length}`;
  tabRow.querySelector('[data-wallet-tab="ended"]').textContent = `종료 ${ended.length}`;

  if (likedList.length === 0) {
    listEl.innerHTML = `<li class="empty-state">아직 관심 등록한 이벤트가 없어요. 이벤트 상세에서 ♡를 눌러보세요!</li>`;
    return;
  }
  if (shown.length === 0) {
    listEl.innerHTML = `<li class="empty-state">${currentWalletTab === "ended" ? "종료된 이벤트가 없어요." : "방문 예정인 이벤트가 없어요."}</li>`;
    return;
  }

  listEl.innerHTML = shown.map(ev => `
    <li class="coupon-wallet-item ${ev.dday === "종료" ? "wallet-item-ended" : ""}" data-id="${ev.id}">
      <img class="coupon-wallet-logo" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고" data-domain="${ev.domain}" data-brand="${ev.brand}">
      <div class="coupon-wallet-info">
        <p class="coupon-wallet-brand">${ev.brand}</p>
        <p class="coupon-wallet-item-title">${ev.title}</p>
        <p class="coupon-wallet-period">${ev.period}</p>
      </div>
      <div class="coupon-wallet-right">
        ${ev.dday ? `<span class="wallet-dday ${ev.dday === "종료" ? "wallet-dday-ended" : ""}">${ev.dday}</span>` : ""}
        <span class="coupon-wallet-discount">${ev.discount}</span>
      </div>
      <button class="wallet-item-remove" data-id="${ev.id}" aria-label="목록에서 삭제">✕</button>
    </li>
  `).join("");

  listEl.querySelectorAll(".coupon-wallet-item").forEach(item => {
    item.addEventListener("click", () => {
      closeCouponWallet();
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

document.getElementById("couponWalletClose").addEventListener("click", closeCouponWallet);

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
      <img class="coupon-wallet-logo" src="${getLogoUrl(ev.domain)}" alt="${ev.brand} 로고" data-domain="${ev.domain}" data-brand="${ev.brand}">
      <div class="coupon-wallet-info">
        <p class="coupon-wallet-brand">${ev.brand}</p>
        <p class="coupon-wallet-item-title">${ev.title}</p>
        <p class="coupon-wallet-period">${ev.period}</p>
      </div>
      <div class="coupon-wallet-right">
        ${ev.dday ? `<span class="wallet-dday ${ev.dday === "종료" ? "wallet-dday-ended" : ""}">${ev.dday}</span>` : ""}
        <span class="coupon-wallet-discount">${ev.discount}</span>
      </div>
      <button class="wallet-item-remove" data-id="${ev.id}" aria-label="기록에서 삭제">✕</button>
    </li>
  `).join("");

  listEl.querySelectorAll(".coupon-wallet-item").forEach(item => {
    item.addEventListener("click", () => {
      closeRecentView();
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

document.getElementById("recentViewClose").addEventListener("click", closeRecentView);
recentViewOverlay.addEventListener("click", (e) => {
  if (e.target === recentViewOverlay) closeRecentView();
});
document.getElementById("walletTabRow").addEventListener("click", (e) => {
  const tab = e.target.closest(".wallet-tab");
  if (!tab) return;
  currentWalletTab = tab.dataset.walletTab;
  document.querySelectorAll(".wallet-tab").forEach(t => t.classList.toggle("active", t === tab));
  renderCouponWallet();
});
couponWalletOverlay.addEventListener("click", (e) => {
  if (e.target === couponWalletOverlay) closeCouponWallet();
});