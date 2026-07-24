/* ---------- 키워드 매칭 설정 ----------
   키워드칩(예: "#비건뷰티")은 마케팅용으로 따로 지은 표현이라, 이벤트에 실제로 붙는
   tags/카테고리 값과 글자가 다를 수 있다. 그래서 단순 문자열 비교 대신, 키워드마다
   "어떤 카테고리와 관련 있는지" + "본문에서 어떤 단어가 나오면 강하게 매칭할지"를
   미리 정의해두고 점수를 매긴다.
   새 키워드칩을 추가하면 여기에도 한 줄 추가해주면 된다. */
const KEYWORD_MATCH_CONFIG = {
  // 지역 — 카테고리와 무관하게, 참여방법(channel)에 지역명이 실제로 나오는지만 본다
  "#성수동": { textHints: ["성수"] },
  "#홍대·연남": { textHints: ["홍대", "연남"] },
  "#더현대서울": { textHints: ["더현대"] },
  "#압구정로데오": { textHints: ["압구정", "로데오"] },
  "#한남동": { textHints: ["한남"] },
  "#강남역": { textHints: ["강남"] },
  // 스타일
  "#포토존맛집": { category: "food", textHints: ["포토존"] },
  "#비건뷰티": { category: "beauty", textHints: ["비건", "크루얼티프리", "vegan"] },
  "#리미티드에디션": { textHints: ["한정판", "리미티드", "단독"] },
  "#신상디저트": { category: "food", textHints: ["신메뉴", "신상", "출시"] },
  "#코덕필수템": { category: "beauty", textHints: ["코덕"] },
  "#스트릿패션": { category: "fashion", textHints: ["스트릿", "스트리트"] },
  "#미니멀룩": { category: "fashion", textHints: ["미니멀"] },
  // 혜택
  "#1+1": { textHints: ["1+1"] },
  "#반값할인": { textHints: ["50%", "반값"] },
  "#무료체험·증정": { textHints: ["무료", "증정", "체험"] },
  "#선착순한정": { textHints: ["선착순", "한정"] },
  "#타임세일": { textHints: ["타임세일", "핫딜"] },
  "#즉시쿠폰": { textHints: ["즉시할인", "즉시쿠폰", "쿠폰"] },
};

function eventCombinedText(ev) {
  return [ev.title, ev.desc, ev.subtitle, ev.discount, ev.channel, ...(ev.tags || [])]
    .filter(Boolean).join(" ").toLowerCase();
}

// 이벤트 하나가 선택된 키워드들과 얼마나 관련 있는지 점수를 매긴다.
// 본문에 실제로 관련 단어가 나오면 +2(강한 매칭), 카테고리만 일치하면 +1(약한 매칭).
function scoreEventForKeywords(ev, keywords) {
  const text = eventCombinedText(ev);
  let score = 0;
  for (const kw of keywords) {
    const cfg = KEYWORD_MATCH_CONFIG[kw];
    if (!cfg) continue;
    const textHit = (cfg.textHints || []).some(hint => text.includes(hint.toLowerCase()));
    if (textHit) score += 2;
    else if (cfg.category && ev.category === cfg.category) score += 1;
  }
  return score;
}

// AI 호출 없이, 키워드와 실제로 관련 있는 이벤트를 즉시(네트워크 호출 0회) 골라준다.
// 관련도 점수가 같으면 인기 점수(조회수·저장수)로 다시 정렬해서, 그냥 무작위처럼 안 보이게 한다.
function matchEventsToKeywords(keywords, count = 6) {
  return EVENTS
    .filter(isEventLive)
    .map(ev => ({ ev, score: scoreEventForKeywords(ev, keywords) }))
    .sort((a, b) => b.score - a.score || getEventScore(b.ev.id) - getEventScore(a.ev.id))
    .slice(0, count)
    .map(x => x.ev);
}

/* ---------- AI 추천 피드 (검색 없이 로그인 키워드 기반으로 상시 노출) ---------- */
let aiFeedExpanded = false; // "더보기" 눌러서 로컬 매칭으로 카드를 더 보여준 상태인지

function loadAiFeed(keywords) {
  const grid = document.getElementById("aiFeedGrid");
  aiFeedExpanded = false;

  if (!keywords || keywords.length === 0) {
    renderAiFeedSetupPrompt();
    return;
  }
  if (EVENTS.length === 0) { grid.innerHTML = renderFeedSkeleton(6); return; }

  // AI 호출이 없어서 네트워크 왕복 없이 바로 계산·렌더링된다 (체감 지연 없음)
  const matched = matchEventsToKeywords(keywords, 6);
  if (matched.length === 0) { renderAiFeedSetupPrompt(); return; }
  renderAiFeedCards(matched);
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
  pushModalHistory(closeAiRecommendPage);
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
      events = matchEventsToKeywords(aiPageKeywords, 9);
    }
    if (events.length === 0) {
      // 키워드가 없으면 인기순 이벤트로 대체 (실제 데이터, 가짜 아님)
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

function closeAiRecommendPage() {
  document.getElementById("aiRecommendPageOverlay").classList.remove("open");
}
document.getElementById("aiRecommendPageClose").addEventListener("click", () => {
  closeAiRecommendPage();
  popModalHistory();
});
document.getElementById("aiPageSetupBtn").addEventListener("click", () => {
  if (!currentUser) { showToast("로그인 후 키워드를 설정할 수 있어요."); openAuthModal(); return; }
  openOnboarding(true, aiPageKeywords);
});

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}