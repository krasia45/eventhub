/* ---------- 한글 브랜드명 검색 지원 (예: "자라" 검색 시 "ZARA" 매칭) ----------
   국내에서 통용되는 한글 표기가 실제 브랜드명(영문 등)과 달라서 단순 includes()로는
   못 찾는 경우가 많아, 자주 검색될 만한 브랜드들의 한글-영문 별칭을 매핑해둔다. */
const BRAND_ALIASES = {
  "자라": "zara", "나이키": "nike", "아디다스": "adidas", "스타벅스": "starbucks",
  "유니클로": "uniqlo", "구찌": "gucci", "샤넬": "chanel", "디올": "dior",
  "이케아": "ikea", "던킨": "dunkin", "맥도날드": "mcdonald", "코치": "coach",
  "룰루레몬": "lululemon", "반스": "vans", "컨버스": "converse",
  "빈폴": "beanpole", "젠틀몬스터": "gentle monster", "나스": "nars",
  "노스페이스": "north face", "파타고니아": "patagonia", "지오다노": "giordano",
  "아고다": "agoda", "부킹닷컴": "booking.com", "익스피디아": "expedia", "힐튼": "hilton",
  "메리어트": "marriott", "에어비앤비": "airbnb", "호텔스닷컴": "hotels.com", "여기어때": "goodchoice",
};

function textMatchesQuery(text, query) {
  const t = (text || "").toLowerCase();
  const q = query.toLowerCase().trim();
  if (t.includes(q)) return true;
  const alias = BRAND_ALIASES[q];
  return !!alias && t.includes(alias);
}

/* ---------- Global Search (simple filter feedback) ---------- */
document.getElementById("globalSearch").addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const q = e.target.value.trim();
  if (!q) return;
  openSearchResults(q);
  hideSearchSuggestions();
  searchInput.blur();
});

/* ---------- 검색 자동완성 / 인기 검색어 ---------- */
const searchInput = document.getElementById("globalSearch");
const suggestionsEl = document.getElementById("searchSuggestions");

function getTrendingBrands(limit = 6) {
  const seen = new Set();
  const uniqueBrandEvents = [];
  [...EVENTS].sort((a, b) => getEventScore(b.id) - getEventScore(a.id)).forEach(ev => {
    if (!seen.has(ev.brand)) { seen.add(ev.brand); uniqueBrandEvents.push(ev); }
  });
  return uniqueBrandEvents.slice(0, limit);
}

function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return `${text.slice(0, idx)}<span class="hl">${text.slice(idx, idx + query.length)}</span>${text.slice(idx + query.length)}`;
}

function showSearchSuggestions() {
  const q = searchInput.value.trim();

  if (!q) {
    // 인기 검색어 칩 — 클릭하면 그 브랜드가 들어간 이벤트 모음 화면으로 이동 (단일 이벤트 아님)
    const trending = getTrendingBrands();
    if (trending.length === 0) { hideSearchSuggestions(); return; }
    suggestionsEl.innerHTML = `
      <p class="search-suggestions-label">🔥 인기 검색어</p>
      ${trending.map(ev => `<button type="button" class="search-suggestion-item" data-query="${ev.brand}">${ev.brand}</button>`).join("")}
    `;
    suggestionsEl.hidden = false;
    suggestionsEl.querySelectorAll(".search-suggestion-item[data-query]").forEach(btn => {
      btn.addEventListener("click", () => {
        openSearchResults(btn.dataset.query);
        hideSearchSuggestions();
        searchInput.blur();
      });
    });
    return;
  }

  // 타이핑 중인 자동완성 — 특정 이벤트를 정확히 짚어 고르는 목록이라 클릭 시 바로 그 이벤트로 이동
  const matches = EVENTS.filter(ev =>
    textMatchesQuery(ev.brand, q) || textMatchesQuery(ev.title, q)
  ).slice(0, 6);

  if (matches.length === 0) {
    suggestionsEl.innerHTML = `<p class="search-suggestions-label">"${q}"에 대한 검색 결과가 없어요</p>`;
  } else {
    suggestionsEl.innerHTML = `
      ${matches.map(ev => `
        <button type="button" class="search-suggestion-item" data-id="${ev.id}">
          ${highlightMatch(ev.brand, q)} · ${highlightMatch(ev.title, q)}
        </button>
      `).join("")}
      <button type="button" class="search-suggestion-viewall" data-query="${q}">"${q}" 전체 결과 보기 →</button>
    `;
  }

  suggestionsEl.hidden = false;
  suggestionsEl.querySelectorAll(".search-suggestion-item[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      openSheet(btn.dataset.id);
      hideSearchSuggestions();
      searchInput.blur();
    });
  });
  const viewAllBtn = suggestionsEl.querySelector(".search-suggestion-viewall");
  if (viewAllBtn) {
    viewAllBtn.addEventListener("click", () => {
      openSearchResults(viewAllBtn.dataset.query);
      hideSearchSuggestions();
      searchInput.blur();
    });
  }
}

function hideSearchSuggestions() {
  suggestionsEl.hidden = true;
}

searchInput.addEventListener("focus", showSearchSuggestions);
searchInput.addEventListener("input", showSearchSuggestions);
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-bar-wrap")) hideSearchSuggestions();
});

/* ---------- 검색 결과 모음 화면 ---------- */
function openSearchResults(query) {
  const q = query.trim();
  if (!q) return;

  const matches = EVENTS.filter(ev =>
    textMatchesQuery(ev.brand, q) ||
    textMatchesQuery(ev.title, q) ||
    ev.tags.some(t => textMatchesQuery(t, q))
  ).sort((a, b) => getEventScore(b.id) - getEventScore(a.id));

  document.getElementById("searchResultsQuery").textContent = `"${q}"`;
  document.getElementById("searchResultsCount").textContent = `${matches.length}개의 이벤트`;

  const grid = document.getElementById("searchResultsGrid");
  if (matches.length === 0) {
    grid.innerHTML = `<p class="empty-state">"${q}"에 대한 검색 결과가 없어요.</p>`;
  } else {
    grid.innerHTML = matches.map(ev => renderEventCardHtml(ev)).join("");
    grid.querySelectorAll(".event-card").forEach(card => {
      card.addEventListener("click", () => openSheet(card.dataset.id));
    });
    grid.querySelectorAll(".card-like-btn").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(btn.dataset.id); });
    });
    grid.querySelectorAll(".card-logo-badge img").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
  }

  document.getElementById("searchResultsOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

document.getElementById("searchResultsClose").addEventListener("click", () => {
  document.getElementById("searchResultsOverlay").classList.remove("open");
  document.body.style.overflow = "";
});
document.getElementById("searchResultsOverlay").addEventListener("click", (e) => {
  if (e.target.id === "searchResultsOverlay") {
    document.getElementById("searchResultsOverlay").classList.remove("open");
    document.body.style.overflow = "";
  }
});