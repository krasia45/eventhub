/* ---------- 날씨 위젯 ---------- */
const DEFAULT_WEATHER_LOCATION = { lat: 37.5665, lng: 126.9780 }; // 서울시청 기준

function getQuietLocation() {
  // GPS 필터처럼 명시적 버튼 클릭 없이, 이미 허용된 위치 권한이 있으면 사용하고
  // 없거나 거부되면 서울 기준으로 조용히 대체합니다.
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(DEFAULT_WEATHER_LOCATION); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(DEFAULT_WEATHER_LOCATION),
      { timeout: 5000 }
    );
  });
}

async function loadWeather(loc) {
  const iconEl = document.getElementById("weatherIcon");
  const summaryEl = document.getElementById("weatherSummary");
  const subEl = document.getElementById("weatherSub");
  const headerIconEl = document.getElementById("weatherHeaderIcon");
  const headerTempEl = document.getElementById("weatherHeaderTemp");
  const forecastRow = document.getElementById("weatherForecastRow");
  const hourlyRow = document.getElementById("weatherHourlyRow");
  const hourlyLabel = document.getElementById("weatherHourlyLabel");

  const target = loc || await getQuietLocation();

  try {
    // target.region이 있으면 지역명 검색(서버가 지오코딩), 아니면 좌표 기반 조회
    const apiUrl = target.region
      ? `/api/weather?region=${encodeURIComponent(target.region)}`
      : `/api/weather?lat=${target.lat}&lng=${target.lng}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error || "날씨 조회 실패");

    iconEl.textContent = data.icon || "🌤";
    summaryEl.textContent = `${data.location} 현재 ${data.tempC}°C, ${data.description}`;
    subEl.textContent = data.advice || "";
    headerIconEl.textContent = data.icon || "🌤";
    headerTempEl.textContent = `${data.tempC}°`;

    // 시간대별 날씨 (네이버 날씨처럼 지금부터 1시간 간격으로 24시간 쭉 이어짐, 날짜 바뀌면 라벨 표시)
    if (Array.isArray(data.hourly) && data.hourly.length > 0) {
      hourlyLabel.hidden = false;
      hourlyRow.innerHTML = data.hourly.map(h => `
        <div class="weather-hourly-item">
          ${h.dateLabel ? `<span class="weather-hourly-date">${h.dateLabel}</span>` : `<span class="weather-hourly-date weather-hourly-date-spacer"></span>`}
          <p class="weather-hourly-time">${h.label}</p>
          <span class="weather-hourly-icon">${h.icon}</span>
          <p class="weather-hourly-temp">${h.tempC}°</p>
        </div>
      `).join("");
    } else {
      hourlyLabel.hidden = true;
      hourlyRow.innerHTML = "";
    }

    // 향후 예보(네이버 주간예보처럼 요일별로 오전/오후 나란히, 강수확률까지) — API가 못 주면 조용히 생략
    if (Array.isArray(data.forecast) && data.forecast.length > 0) {
      forecastRow.innerHTML = data.forecast.map(d => `
        <div class="weather-forecast-day-row">
          <p class="weather-forecast-day-label">${d.label}</p>
          <div class="weather-forecast-half">
            <span class="weather-forecast-half-tag">오전</span>
            <span class="weather-forecast-day-icon">${d.amIcon || "-"}</span>
            <span class="weather-forecast-half-temp">${d.amTemp !== null ? d.amTemp + "°" : "-"}</span>
          </div>
          <div class="weather-forecast-half">
            <span class="weather-forecast-half-tag">오후</span>
            <span class="weather-forecast-day-icon">${d.pmIcon || "-"}</span>
            <span class="weather-forecast-half-temp">${d.pmTemp !== null ? d.pmTemp + "°" : "-"}</span>
          </div>
        </div>
      `).join("");
    } else {
      forecastRow.innerHTML = `<p class="empty-state">예보 정보를 불러오지 못했어요.</p>`;
    }

  } catch (err) {
    // ── 예외처리: 날씨 API 실패 시 Fallback UI ──────────
    console.error("날씨 조회 오류:", err);
    iconEl.textContent = "⚠️";
    summaryEl.textContent = err.message || "날씨 정보를 불러오지 못했어요.";
    subEl.textContent = "잠시 후 다시 시도해주세요.";
    headerIconEl.textContent = "⚠️";
    headerTempEl.textContent = "";
    forecastRow.innerHTML = "";
    hourlyRow.innerHTML = "";
    hourlyLabel.hidden = true;
  }
}

const weatherRegionInput = document.getElementById("weatherRegionInput");

function searchWeatherRegion() {
  const name = weatherRegionInput.value.trim();
  if (!name) return;
  document.getElementById("weatherSummary").textContent = "날씨 정보를 불러오는 중이에요...";
  // 구 단위(강남구, 해운대구 등)까지 서버가 지오코딩으로 직접 찾도록 지역명을 그대로 전달
  loadWeather({ region: name });
}

weatherRegionInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); searchWeatherRegion(); }
});

document.getElementById("weatherRegionGpsBtn").addEventListener("click", async () => {
  weatherRegionInput.value = "";
  document.getElementById("weatherSummary").textContent = "날씨 정보를 불러오는 중이에요...";
  loadWeather(await getQuietLocation());
});

document.getElementById("weatherHeaderChip").addEventListener("click", () => {
  document.getElementById("weatherOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
});
document.getElementById("weatherClose").addEventListener("click", () => {
  document.getElementById("weatherOverlay").classList.remove("open");
  document.body.style.overflow = "";
});
document.getElementById("weatherOverlay").addEventListener("click", (e) => {
  if (e.target.id === "weatherOverlay") {
    document.getElementById("weatherOverlay").classList.remove("open");
    document.body.style.overflow = "";
  }
});

/* ---------- 거리 계산 (Haversine) & GPS 20km 필터 ---------- */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371; // 지구 반지름(km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function matchesDiscountFilter(ev, filter) {
  if (filter === "all") return true;
  if (filter === "1+1") return ev.discount.includes("1+1");
  if (filter === "50plus") {
    const match = ev.discount.match(/(\d+)\s*%/);
    return !!match && parseInt(match[1], 10) >= 50;
  }
  return true;
}

/* 카테고리 + 할인유형 + GPS(선택) 필터를 모두 적용한 이벤트 목록 */
/* 브랜드/할인유형/서브태그 중 하나라도 선택되어 있으면 "결과 모드"로 간주.
   카테고리 선택 자체는 포함하지 않음 — "패션 카테고리만 보는 중"은 여전히 발견 모드에 가까움. */
function isAnyFilterActive() {
  return selectedBrands.size > 0 || currentDiscountFilter !== "all" || !!currentSubTag;
}

/* 필터가 활성화되면 필터를 반영 안 하는 발견형 콘텐츠(AI추천/히어로배너/내주변)와
   실시간 인기 이벤트(전체 이벤트와 결과가 겹치는 중복 문제 방지)를 숨기고,
   해제되면 각자의 원래 표시 조건으로 복원한다. 전체 이벤트만 항상 표시(필터 반영 + 인기순 기본정렬). */
function updateDiscoverySectionsVisibility() {
  const active = isAnyFilterActive();
  document.getElementById("aiSection").hidden = active;
  document.getElementById("heroCarouselWrap").hidden = active;
  document.getElementById("nearbySection").hidden = active ? true : !nearbyHasData;
  document.getElementById("rankingSection").hidden = active;
}

function getFilteredEvents() {
  let list = currentCategory === "all"
    ? EVENTS
    : EVENTS.filter(ev => ev.category === currentCategory);

  if (selectedBrands.size > 0) {
    list = list.filter(ev => selectedBrands.has(ev.brand));
  }

  list = list.filter(ev => matchesDiscountFilter(ev, currentDiscountFilter));

  // 서브카테고리(태그) 필터 — 카테고리 안에서 태그로 한 번 더 좁히기
  if (currentSubTag) {
    list = list.filter(ev => (ev.tags || []).includes(currentSubTag));
  }

  if (gpsFilterActive && userLocation) {
    list = list.filter(ev => haversineDistanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng) <= 20);
  }

  if (endingSoonFilterActive) {
    list = [...list].sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
  }

  // 피드 정렬 칩 적용
  const pct = ev => { const m = (ev.discount || "").match(/(\d+)\s*%/); return m ? parseInt(m[1], 10) : 0; };
  if (currentFeedSort === "new") list = [...list].sort((a, b) => (b.periodStart || "").localeCompare(a.periodStart || ""));
  else if (currentFeedSort === "discount") list = [...list].sort((a, b) => pct(b) - pct(a));
  else if (currentFeedSort === "closing") list = [...list].sort((a, b) => (a.periodEnd || "9999").localeCompare(b.periodEnd || "9999"));
  else list = [...list].sort((a, b) => getEventScore(b.id) - getEventScore(a.id)); // 인기순

  return list;
}

/* ---------- GPS 20km 필터 토글 ---------- */
function toggleGpsFilter() {
  const btn = document.getElementById("gpsFilterChip");

  if (gpsFilterActive) {
    gpsFilterActive = false;
    btn.classList.remove("active");
    btn.textContent = "📍 내 주변 20km";
    renderFeed();
    renderRanking();
    return;
  }

  if (!navigator.geolocation) {
    showToast("이 브라우저는 위치 정보를 지원하지 않아요.");
    return;
  }

  btn.textContent = "📍 위치 확인 중...";

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      gpsFilterActive = true;
      btn.classList.add("active");
      btn.textContent = "📍 내 주변 20km ✓";
      renderFeed();
      renderRanking();
      loadWeather(userLocation);
    },
    (err) => {
      console.error("위치 정보 오류:", err);
      btn.textContent = "📍 내 주변 20km";
      if (err.code === err.PERMISSION_DENIED) {
        showToast("위치 권한이 거부되어 전체 이벤트를 표시할게요.");
      } else {
        showToast("위치 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.");
      }
    },
    { timeout: 8000 }
  );
}

/* ---------- Real Brand Logo Helper ----------
   Fetches each brand's actual logo straight from their real company domain
   using Hunter's free Logo API (https://logos.hunter.io/{domain}) — a
   no-key, no-signup service that returns each company's real logo image.
   (Note: Clearbit's old logo.clearbit.com API, commonly used for this,
   was permanently shut down in Dec 2025 — this is its direct successor.)

   Because logo availability can vary per domain, attachLogoFallback wires
   up a 2-step safety net so the layout never breaks:
     1) Hunter logo API (real logo)
     2) Google's favicon service for that domain (real site icon)
     3) A clean initials badge, generated from the brand name, as a last resort */
function getLogoUrl(domain) {
  return `https://logos.hunter.io/${domain}`;
}

function getFaviconFallbackUrl(domain) {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}

function attachLogoFallback(imgEl, brandName, domain) {
  imgEl.addEventListener("error", () => {
    const stage = imgEl.dataset.fallbackStage || "0";
    if (stage === "0" && domain) {
      imgEl.dataset.fallbackStage = "1";
      imgEl.src = getFaviconFallbackUrl(domain);
    } else {
      // 최종 폴백: 외부 서비스 없이 로컬에서 즉시 생성하는 이니셜 배지.
      // (기존 ui-avatars.com도 외부 의존이라 그것마저 실패하면 빈 원이 남았음)
      const initial = ((brandName || "?").trim().charAt(0) || "?").toUpperCase()
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" rx="64" fill="#FF6A00"/><text x="64" y="64" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,sans-serif" font-size="58" font-weight="700" fill="#fff">${initial}</text></svg>`;
      imgEl.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
  });
}

/* ---------- Utilities ---------- */
function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 2200);
}

function getCategoryLabel(id) {
  const cat = CATEGORIES.find(c => c.id === id);
  return cat ? cat.label : "";
}