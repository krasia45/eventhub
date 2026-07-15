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
    ev.brand.toLowerCase().includes(q.toLowerCase()) || ev.title.toLowerCase().includes(q.toLowerCase())
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
    ev.brand.toLowerCase().includes(q.toLowerCase()) ||
    ev.title.toLowerCase().includes(q.toLowerCase()) ||
    ev.tags.some(t => t.toLowerCase().includes(q.toLowerCase()))
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

