/* ---------- AI 추천 피드 (검색 없이 로그인 키워드 기반으로 상시 노출) ---------- */
let aiFeedExpanded = false; // "더보기" 눌러서 로컬 매칭으로 카드를 더 보여준 상태인지

async function loadAiFeed(keywords) {
  const grid = document.getElementById("aiFeedGrid");
  aiFeedExpanded = false;

  if (!keywords || keywords.length === 0) {
    renderAiFeedSetupPrompt();
    return;
  }

  if (EVENTS.length === 0) { grid.innerHTML = renderFeedSkeleton(6); return; }

  grid.innerHTML = renderFeedSkeleton(6);

  try {
    const eventsSummary = EVENTS.filter(isEventLive).map(ev => ({
      id: ev.id, brand: ev.brand, category: ev.category,
      title: ev.title, tags: ev.tags, discount: ev.discount
    }));

    const res = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interest: keywords.join(", "), events: eventsSummary }),
    });
    const data = await res.json();

    if (!res.ok || data.error || !Array.isArray(data.ids) || data.ids.length === 0) {
      renderAiFeedFallback(keywords);
      return;
    }

    const matched = data.ids.map(id => EVENTS.find(ev => ev.id === id)).filter(ev => ev && isEventLive(ev));
    if (matched.length === 0) { renderAiFeedFallback(keywords); return; }
    renderAiFeedCards(matched);

  } catch (err) {
    console.error("AI 추천 피드 로드 오류:", err);
    renderAiFeedFallback(keywords);
  }
}

// AI 호출이 실패하거나 결과가 없을 때: 키워드가 태그/제목에 실제로 매칭되는 진짜 이벤트로 대체
// (AI가 안 되더라도 화면이 비지 않게 하면서, 없는 데이터를 지어내지는 않음)
function renderAiFeedFallback(keywords) {
  const kwLower = (keywords || []).map(k => k.toLowerCase());
  let candidates = EVENTS.filter(ev => isEventLive(ev) &&
    kwLower.some(kw => ev.tags.some(t => t.toLowerCase().includes(kw)) || ev.title.toLowerCase().includes(kw))
  );
  if (candidates.length === 0) {
    candidates = EVENTS.filter(isEventLive).sort((a, b) => getEventScore(b.id) - getEventScore(a.id));
  }
  renderAiFeedCards(candidates.slice(0, 6));
}

function renderAiFeedSetupPrompt() {
  const grid = document.getElementById("aiFeedGrid");
  grid.innerHTML = `
    <div class="ai-feed-setup-card">
      <span class="ai-feed-setup-emoji">🤖</span>
      <p class="ai-feed-setup-title">AI 맞춤 추천을 받아보세요</p>
      <p class="ai-feed-setup-sub">관심 키워드를 설정하면 취향에 맞는 이벤트를 바로 보여드려요.</p>
      <button type="button" class="ai-btn" id="aiFeedSetupBtn">설정하기</button>
    </div>
  `;
  const setupBtn = document.getElementById("aiFeedSetupBtn");
  setupBtn.addEventListener("click", () => {
    if (!currentUser) { showToast("로그인 후 키워드를 설정할 수 있어요."); openAuthModal(); return; }
    openOnboarding(true, []);
  });
}

function renderAiFeedCards(events) {
  const grid = document.getElementById("aiFeedGrid");
  // AI추천만의 별도 카드 디자인 대신 Standard 카드를 그대로 재사용한다.
  // 차별점은 카드 내부가 아니라 섹션 컨테이너("✨ 나만을 위한 이벤트")로만 표현한다.
  grid.innerHTML = events.map(ev => renderEventCardHtml(ev)).join("");

  grid.querySelectorAll(".event-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });
  grid.querySelectorAll(".card-like-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleLike(btn.dataset.id);
    });
  });
  grid.querySelectorAll(".card-brand-logo-sm").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}

document.getElementById("aiFeedMoreBtn").addEventListener("click", openAiRecommendPage);

/* ---------- AI 추천 전용 화면 (추천 이벤트 / 유사 이벤트 / 관심 브랜드) ---------- */
let aiPageCurrentTab = "recommend";
let aiPageKeywords = [];

async function openAiRecommendPage() {
  const greetingEl = document.getElementById("aiPageGreeting");
  const subEl = document.getElementById("aiPageGreetingSub");

  if (currentUser) {
    const name = (currentUser.email || currentUser.user_metadata?.name || "회원").split("@")[0];
    greetingEl.textContent = `✨ ${name}님을 위한 맞춤 추천이에요`;
  } else {
    greetingEl.textContent = "✨ 맞춤 추천이에요";
  }

  // 키워드 목록은 실제 저장된 값만 사용 (행동 패턴을 지어내서 보여주지 않음)
  if (currentUser && supabaseClient) {
    try {
      const { data } = await supabaseClient.from("user_preferences").select("keywords").eq("user_id", currentUser.id).maybeSingle();
      aiPageKeywords = (data && data.keywords) || [];
    } catch { aiPageKeywords = []; }
  } else {
    aiPageKeywords = [];
  }
  subEl.textContent = aiPageKeywords.length > 0 ? `관심 키워드: ${aiPageKeywords.join(", ")}` : "관심 키워드를 설정하면 더 정확한 추천을 받을 수 있어요.";

  aiPageCurrentTab = "recommend";
  document.querySelectorAll(".ai-page-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "recommend"));
  loadAiPageTab("recommend");

  document.getElementById("aiRecommendPageOverlay").classList.add("open");
}

document.querySelectorAll(".ai-page-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    aiPageCurrentTab = tab.dataset.tab;
    document.querySelectorAll(".ai-page-tab").forEach(t => t.classList.toggle("active", t === tab));
    loadAiPageTab(aiPageCurrentTab);
  });
});

async function loadAiPageTab(tab) {
  const grid = document.getElementById("aiPageGrid");
  grid.innerHTML = renderFeedSkeleton(6);

  let events = [];

  if (tab === "recommend") {
    if (aiPageKeywords.length > 0) {
      try {
        const eventsSummary = EVENTS.filter(isEventLive).map(ev => ({ id: ev.id, brand: ev.brand, category: ev.category, title: ev.title, tags: ev.tags, discount: ev.discount }));
        const res = await fetch("/api/recommend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interest: aiPageKeywords.join(", "), events: eventsSummary }),
        });
        const data = await res.json();
        if (res.ok && Array.isArray(data.ids)) {
          events = data.ids.map(id => EVENTS.find(ev => ev.id === id)).filter(ev => ev && isEventLive(ev));
        }
      } catch (err) { console.error("AI 추천 페이지 로드 오류:", err); }
    }
    if (events.length === 0) {
      // 키워드가 없거나 AI 호출이 실패하면 인기순 이벤트로 대체 (실제 데이터, 가짜 아님)
      events = EVENTS.filter(isEventLive).sort((a, b) => getEventScore(b.id) - getEventScore(a.id)).slice(0, 9);
    }

  } else if (tab === "similar") {
    // "찜한 이벤트"의 카테고리·태그와 겹치는 다른 이벤트를 추천 (실제 행동 데이터 기반)
    const liked = EVENTS.filter(ev => likedEvents.has(ev.id));
    if (liked.length === 0) {
      grid.innerHTML = `<p class="empty-state">아직 찜한 이벤트가 없어요. 관심 있는 이벤트를 찜하면 비슷한 이벤트를 추천해드려요!</p>`;
      return;
    }
    const likedTags = new Set(liked.flatMap(ev => ev.tags));
    const likedCategories = new Set(liked.map(ev => ev.category));
    events = EVENTS
      .filter(ev => isEventLive(ev) && !likedEvents.has(ev.id) && (likedCategories.has(ev.category) || ev.tags.some(t => likedTags.has(t))))
      .sort((a, b) => getEventScore(b.id) - getEventScore(a.id))
      .slice(0, 9);

  } else if (tab === "brands") {
    // 실제로 팔로우한 브랜드의 이벤트만
    if (!currentUser || !supabaseClient) {
      grid.innerHTML = `<p class="empty-state">로그인하시면 팔로우한 브랜드의 이벤트를 볼 수 있어요.</p>`;
      return;
    }
    try {
      const { data } = await supabaseClient.from("user_follows").select("brand").eq("user_id", currentUser.id);
      const brands = (data || []).map(f => f.brand);
      if (brands.length === 0) {
        grid.innerHTML = `<p class="empty-state">아직 팔로우한 브랜드가 없어요. 이벤트 상세에서 브랜드를 팔로우해보세요!</p>`;
        return;
      }
      events = EVENTS.filter(ev => isEventLive(ev) && brands.includes(ev.brand)).sort((a, b) => getEventScore(b.id) - getEventScore(a.id));
    } catch (err) {
      console.error("관심 브랜드 조회 오류:", err);
      grid.innerHTML = `<p class="empty-state">불러오는 중 오류가 발생했어요.</p>`;
      return;
    }
  }

  if (events.length === 0) {
    grid.innerHTML = `<p class="empty-state">표시할 이벤트가 없어요.</p>`;
    return;
  }

  grid.innerHTML = events.map(ev => renderEventCardHtml(ev)).join("");
  grid.querySelectorAll(".event-card").forEach(card => {
    card.addEventListener("click", () => openSheet(card.dataset.id));
  });
  grid.querySelectorAll(".card-like-btn").forEach(btn => {
    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleLike(btn.dataset.id); });
  });
  grid.querySelectorAll(".card-brand-logo-sm").forEach(img => attachLogoFallback(img, img.dataset.brand, img.dataset.domain));
}

document.getElementById("aiRecommendPageClose").addEventListener("click", () => {
  document.getElementById("aiRecommendPageOverlay").classList.remove("open");
});
document.getElementById("aiPageSetupBtn").addEventListener("click", () => {
  if (!currentUser) { showToast("로그인 후 키워드를 설정할 수 있어요."); openAuthModal(); return; }
  openOnboarding(true, aiPageKeywords);
});

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}