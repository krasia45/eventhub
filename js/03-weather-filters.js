/* ---------- 날씨 위젯 ---------- */
const DEFAULT_WEATHER_LOCATION = { lat: 37.5665, lng: 126.9780 }; // 서울시청 기준

// 지역 선택 드롭다운용 주요 도시 좌표 (시청/중심가 기준 대표 좌표)
const WEATHER_REGIONS = {
  seoul: { lat: 37.5665, lng: 126.9780 },
  busan: { lat: 35.1796, lng: 129.0756 },
  incheon: { lat: 37.4563, lng: 126.7052 },
  daegu: { lat: 35.8714, lng: 128.6014 },
  gwangju: { lat: 35.1595, lng: 126.8526 },
  daejeon: { lat: 36.3504, lng: 127.3845 },
  ulsan: { lat: 35.5384, lng: 129.3114 },
  jeju: { lat: 33.4996, lng: 126.5312 },
};

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
  const amPmRow = document.getElementById("weatherAmPmRow");

  const target = loc || await getQuietLocation();

  try {
    const res = await fetch(`/api/weather?lat=${target.lat}&lng=${target.lng}`);
    const data = await res.json();

    if (!res.ok || data.error) throw new Error(data.error || "날씨 조회 실패");

    iconEl.textContent = data.icon || "🌤";
    summaryEl.textContent = `${data.location} 현재 ${data.tempC}°C, ${data.description}`;
    subEl.textContent = data.advice || "";
    headerIconEl.textContent = data.icon || "🌤";
    headerTempEl.textContent = `${data.tempC}°`;

    // 오늘 오전/오후 날씨 (있을 때만 표시)
    if (data.todayAmPm && (data.todayAmPm.am || data.todayAmPm.pm)) {
      amPmRow.hidden = false;
      const am = data.todayAmPm.am;
      const pm = data.todayAmPm.pm;
      document.getElementById("weatherAmIcon").textContent = am ? am.icon : "-";
      document.getElementById("weatherAmTemp").textContent = am ? `${am.tempAvg}°C` : "정보 없음";
      document.getElementById("weatherPmIcon").textContent = pm ? pm.icon : "-";
      document.getElementById("weatherPmTemp").textContent = pm ? `${pm.tempAvg}°C` : "정보 없음";
    } else {
      amPmRow.hidden = true;
    }

    // 향후 예보(네이버 날씨처럼 오늘/화/수/목/금 형태로) — API가 못 주면 조용히 생략
    if (Array.isArray(data.forecast) && data.forecast.length > 0) {
      forecastRow.innerHTML = data.forecast.map(d => `
        <div class="weather-forecast-day">
          <p class="weather-forecast-day-label">${d.label}</p>
          <span class="weather-forecast-day-icon">${d.icon}</span>
          <p class="weather-forecast-day-temp"><strong>${d.tempMax}°</strong> / ${d.tempMin}°</p>
        </div>
      `).join("");
    } else {
      forecastRow.innerHTML = `<p class="empty-state">예보 정보를 불러오지 못했어요.</p>`;
    }

  } catch (err) {
    // ── 예외처리: 날씨 API 실패 시 Fallback UI ──────────
    console.error("날씨 조회 오류:", err);
    iconEl.textContent = "⚠️";
    summaryEl.textContent = "날씨 정보를 불러오지 못했어요.";
    subEl.textContent = "잠시 후 다시 시도해주세요.";
    headerIconEl.textContent = "⚠️";
    headerTempEl.textContent = "";
    forecastRow.innerHTML = "";
    amPmRow.hidden = true;
  }
}

document.getElementById("weatherRegionSelect").addEventListener("change", async (e) => {
  const value = e.target.value;
  const summaryEl = document.getElementById("weatherSummary");
  summaryEl.textContent = "날씨 정보를 불러오는 중이에요...";

  if (value === "gps") {
    loadWeather(await getQuietLocation());
  } else if (WEATHER_REGIONS[value]) {
    loadWeather(WEATHER_REGIONS[value]);
  }
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
function getFilteredEvents() {
  let list = currentCategory === "all"
    ? EVENTS
    : EVENTS.filter(ev => ev.category === currentCategory);

  if (selectedBrands.size > 0) {
    list = list.filter(ev => selectedBrands.has(ev.brand));
  }

  list = list.filter(ev => matchesDiscountFilter(ev, currentDiscountFilter));

  if (gpsFilterActive && userLocation) {
    list = list.filter(ev => haversineDistanceKm(userLocation.lat, userLocation.lng, ev.lat, ev.lng) <= 20);
  }

  if (endingSoonFilterActive) {
    list = [...list].sort((a, b) => new Date(a.periodEnd) - new Date(b.periodEnd));
  }

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
      const initial = brandName.trim().charAt(0).toUpperCase();
      imgEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&background=FF6F00&color=fff&bold=true&size=128`;
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