/* =========================================================
   로그인 / 회원가입 / 온보딩
   ========================================================= */
const authOverlay = document.getElementById("authOverlay");
const onboardingOverlay = document.getElementById("onboardingOverlay");
let authMode = "login"; // "login" | "signup"

const KEYWORD_POOL = {
  region: ["#성수동", "#홍대·연남", "#더현대서울", "#압구정로데오", "#한남동", "#강남역"],
  style: ["#포토존맛집", "#비건뷰티", "#리미티드에디션", "#신상디저트", "#코덕필수템", "#스트릿패션", "#미니멀룩"],
  benefit: ["#1+1", "#반값할인", "#무료체험·증정", "#선착순한정", "#타임세일", "#즉시쿠폰"],
};
let selectedKeywords = new Set();

/* ---------- 모달 열기/닫기 ---------- */
function updateProfileButton() {
  const btn = document.getElementById("profileBtn");
  const label = document.getElementById("profileBtnLabel");
  if (currentUser) {
    btn.classList.add("logged-in");
    btn.setAttribute("aria-label", "내 계정");
    const shortName = (currentUser.email || currentUser.user_metadata?.name || "내 계정").split("@")[0];
    label.textContent = shortName;
  } else {
    btn.classList.remove("logged-in");
    btn.setAttribute("aria-label", "로그인");
    label.textContent = "로그인";
  }
}

function openAuthModal() {
  if (currentUser) {
    document.getElementById("authFormBody").hidden = true;
    document.getElementById("authAccountBody").hidden = false;
    document.getElementById("authUserEmail").textContent =
      currentUser.email || "카카오 계정으로 로그인됨";
  } else {
    document.getElementById("authFormBody").hidden = false;
    document.getElementById("authAccountBody").hidden = true;
  }
  authOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeAuthModal() {
  authOverlay.classList.remove("open");
  document.body.style.overflow = "";
}
document.getElementById("profileBtn").addEventListener("click", openAuthModal);
document.getElementById("authClose").addEventListener("click", closeAuthModal);
authOverlay.addEventListener("click", (e) => { if (e.target === authOverlay) closeAuthModal(); });

/* ---------- 소셜 로그인 ---------- */
document.getElementById("googleLoginBtn").addEventListener("click", async () => {
  if (!supabaseClient) { showToast("로그인 기능을 일시적으로 사용할 수 없어요."); return; }
  await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
});
document.getElementById("kakaoLoginBtn").addEventListener("click", async () => {
  if (!supabaseClient) { showToast("로그인 기능을 일시적으로 사용할 수 없어요."); return; }
  // Supabase 기본 요청 스코프(account_email 포함)는 일반(개인) 카카오 앱에 없는 동의항목이라
  // KOE205 에러가 남 → 실제로 설정된 동의항목(닉네임)만 명시적으로 요청하도록 제한
  await supabaseClient.auth.signInWithOAuth({
    provider: "kakao",
    options: {
      redirectTo: window.location.origin,
      scopes: "profile_nickname",
    },
  });
});

/* ---------- 이메일/비밀번호 로그인 (보조 수단) ---------- */
function setAuthMode(mode) {
  authMode = mode;
  document.getElementById("authFormTitle").textContent = mode === "login" ? "로그인" : "회원가입";
  document.getElementById("authSubmitBtn").textContent = mode === "login" ? "로그인" : "회원가입";
  document.getElementById("authToggleMode").innerHTML = mode === "login"
    ? `계정이 없으신가요? <button type="button" id="authToggleBtn">회원가입</button>`
    : `이미 계정이 있으신가요? <button type="button" id="authToggleBtn">로그인</button>`;
}
// 이벤트 위임: authToggleBtn이 매번 새로 그려져도(innerHTML 교체) 계속 동작하도록
// 부모 요소(authFormBody)에 클릭 리스너를 한 번만 등록합니다.
document.getElementById("authFormBody").addEventListener("click", (e) => {
  if (e.target && e.target.id === "authToggleBtn") {
    setAuthMode(authMode === "login" ? "signup" : "login");
  }
});

document.getElementById("authForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const errorEl = document.getElementById("authError");
  errorEl.hidden = true;

  if (!supabaseClient) {
    errorEl.hidden = false;
    errorEl.textContent = "로그인 기능을 일시적으로 사용할 수 없어요.";
    return;
  }

  const { error } = authMode === "login"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });

  if (error) {
    errorEl.hidden = false;
    errorEl.textContent = error.message.includes("Invalid login")
      ? "이메일 또는 비밀번호가 올바르지 않아요."
      : error.message;
    return;
  }

  if (authMode === "signup") {
    errorEl.hidden = false;
    errorEl.style.color = "#1E8A4C";
    errorEl.textContent = "가입 완료! 바로 로그인됩니다.";
  }
});

document.getElementById("authLogoutBtn").addEventListener("click", async () => {
  if (!supabaseClient) { closeAuthModal(); return; }
  await supabaseClient.auth.signOut();
  closeAuthModal();
  showToast("로그아웃되었습니다");
});

/* ---------- 온보딩 (최초 로그인 시 키워드 3개 이상 + 알림 이메일) ---------- */
let onboardingEditMode = false; // true면 "키워드 편집"(AI 섹션 + 버튼)으로 열린 것 — 이메일/최소개수 요구 안 함

function renderKeywordChips() {
  Object.entries(KEYWORD_POOL).forEach(([group, keywords]) => {
    const wrap = document.querySelector(`.keyword-chips[data-group="${group}"]`);
    wrap.innerHTML = keywords.map(k => `<button type="button" class="keyword-chip" data-kw="${k}">${k}</button>`).join("");
    wrap.querySelectorAll(".keyword-chip").forEach(chip => {
      if (selectedKeywords.has(chip.dataset.kw)) chip.classList.add("selected");
      chip.addEventListener("click", () => {
        const kw = chip.dataset.kw;
        if (selectedKeywords.has(kw)) {
          selectedKeywords.delete(kw);
          chip.classList.remove("selected");
        } else {
          selectedKeywords.add(kw);
          chip.classList.add("selected");
        }
        updateOnboardingState();
      });
    });
  });
}

function updateOnboardingState() {
  const count = selectedKeywords.size;
  const emailStep = document.getElementById("onboardingEmailStep");
  const submitBtn = document.getElementById("onboardingSubmitBtn");

  if (onboardingEditMode) {
    document.getElementById("onboardingCount").textContent = `${count}개 선택됨`;
    emailStep.hidden = true;
    submitBtn.disabled = count === 0;
    submitBtn.textContent = "키워드 저장";
    return;
  }

  document.getElementById("onboardingCount").textContent = `${count}개 선택됨 (최소 3개)`;
  emailStep.hidden = count < 3;
  const emailVal = document.getElementById("onboardingEmail").value.trim();
  submitBtn.disabled = !(count >= 3 && emailVal.length > 3);
  submitBtn.textContent = "이벤트허브 시작하기";
}
document.getElementById("onboardingEmail").addEventListener("input", updateOnboardingState);

async function openOnboarding(editMode = false, existingKeywords = []) {
  onboardingEditMode = editMode;
  selectedKeywords = new Set(existingKeywords);
  document.querySelector(".onboarding-title").textContent = editMode
    ? "관심 키워드를 편집해보세요 ✏️"
    : "환영해요! 좋아하는 관심사를\n3개 이상 골라주세요 ✨";
  renderKeywordChips();
  updateOnboardingState();
  // 구글 로그인이면 이메일이 이미 있으니 미리 채워줌 (수정 가능)
  document.getElementById("onboardingEmail").value = currentUser?.email || "";
  onboardingOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

document.getElementById("onboardingSubmitBtn").addEventListener("click", async () => {
  if (!supabaseClient || !currentUser) { showToast("로그인 상태를 확인해주세요."); return; }

  const updatePayload = { user_id: currentUser.id, keywords: [...selectedKeywords] };
  if (!onboardingEditMode) {
    updatePayload.contact_email = document.getElementById("onboardingEmail").value.trim();
  }

  const { error } = await supabaseClient.from("user_preferences").upsert(updatePayload);

  if (error) {
    showToast("저장 중 오류가 발생했어요. 다시 시도해주세요.");
    console.error("온보딩 저장 오류:", error);
    return;
  }

  onboardingOverlay.classList.remove("open");
  document.body.style.overflow = "";
  showToast(onboardingEditMode ? "키워드가 저장됐어요 ✅" : "환영해요! 맞춤 추천이 준비됐어요 🎉");

  if (onboardingEditMode) {
    renderAiKeywordChips([...selectedKeywords]);
    loadAiFeed([...selectedKeywords]);
  } else {
    await loadUserPreferencesAndSync();
  }
});

/* ---------- AI 섹션 키워드 태그 (X 삭제 + "+" 추가) ---------- */
function renderAiKeywordChips(keywords) {
  const row = document.getElementById("aiKeywordRow");

  if (!currentUser) {
    row.innerHTML = `<button type="button" class="ai-keyword-login-btn" id="aiKeywordLoginBtn">로그인하고 맞춤 키워드 설정하기 →</button>`;
    document.getElementById("aiKeywordLoginBtn").addEventListener("click", openAuthModal);
    renderAiFeedSetupPrompt();
    return;
  }

  const chips = (keywords || []).map(k => `
    <span class="ai-keyword-chip">
      ${k}
      <button type="button" class="ai-keyword-remove" data-kw="${k}" aria-label="${k} 삭제">✕</button>
    </span>
  `).join("");

  row.innerHTML = `${chips}<button type="button" class="ai-keyword-add-btn" id="aiKeywordAddBtn">+ 추가</button>`;

  row.querySelectorAll(".ai-keyword-remove").forEach(btn => {
    btn.addEventListener("click", async () => {
      const updated = (keywords || []).filter(k => k !== btn.dataset.kw);
      const { error } = await supabaseClient.from("user_preferences").update({ keywords: updated }).eq("user_id", currentUser.id);
      if (error) { showToast("키워드 삭제 중 오류가 발생했어요."); return; }
      renderAiKeywordChips(updated);
      loadAiFeed(updated);
    });
  });

  document.getElementById("aiKeywordAddBtn").addEventListener("click", () => openOnboarding(true, keywords || []));
}

/* ---------- 로그인 상태 변화 감지 + 좋아요 동기화 ---------- */
async function loadUserPreferencesAndSync() {
  if (!currentUser) return;

  // 1) 온보딩 완료 여부 확인
  const { data: pref } = await supabaseClient
    .from("user_preferences")
    .select("*")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (!pref) {
    openOnboarding(); // 최초 로그인 → 온보딩 강제 노출
    return;
  }

  renderAiKeywordChips(pref.keywords || []);
  loadAiFeed(pref.keywords || []);

  // 2) 로그인 전 localStorage에 쌓인 좋아요를 DB로 마이그레이션 (한 번만)
  if (likedEvents.size > 0) {
    const rows = [...likedEvents].map(eventId => ({ user_id: currentUser.id, event_id: eventId }));
    await supabaseClient.from("user_saves").upsert(rows, { onConflict: "user_id,event_id" });
  }

  // 3) DB에 저장된 좋아요를 진짜 소스로 다시 불러옴
  const { data: saves } = await supabaseClient
    .from("user_saves")
    .select("event_id")
    .eq("user_id", currentUser.id);

  if (saves) {
    likedEvents = new Set(saves.map(s => s.event_id));
    localStorage.setItem("eventhub-liked", JSON.stringify([...likedEvents]));
    renderFeed();
    renderRanking();
  }

  await ensureReferralCode();
  checkNewFollowedEvents();
}

/* ---------- 친구 초대 (그로스 루프) ---------- */
function generateReferralCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

async function ensureReferralCode() {
  if (!supabaseClient || !currentUser) return;

  const { data: existing } = await supabaseClient
    .from("user_referrals")
    .select("referral_code")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (existing) {
    document.getElementById("inviteCode").textContent = existing.referral_code;
    return;
  }

  // 최초 로그인 시에만 생성. 가입 전 초대 링크(?ref=CODE)로 들어왔다면 invited_by에 연결
  const pendingRef = localStorage.getItem("eventhub-pending-ref");
  const newCode = generateReferralCode();

  const { error } = await supabaseClient.from("user_referrals").insert({
    user_id: currentUser.id,
    referral_code: newCode,
    invited_by: pendingRef || null,
  });

  if (!error) {
    localStorage.removeItem("eventhub-pending-ref");
    document.getElementById("inviteCode").textContent = newCode;
  }
}

document.getElementById("inviteShareBtn").addEventListener("click", async () => {
  const code = document.getElementById("inviteCode").textContent;
  if (!code || code === "코드 생성 중...") { showToast("잠시 후 다시 시도해주세요."); return; }

  const inviteLink = `${window.location.origin}/?ref=${code}`;

  try {
    await loadKakaoShareSdk();
    window.Kakao.Share.sendDefault({
      objectType: "feed",
      content: {
        title: "EventHub — 놓치면 아까운 할인/팝업 정보 모음",
        description: "친구가 EventHub로 초대했어요! 가입하고 같이 써봐요 🎉",
        imageUrl: `${window.location.origin}/img/eventhub-share.png`,
        link: { mobileWebUrl: inviteLink, webUrl: inviteLink },
      },
      buttons: [{ title: "EventHub 시작하기", link: { mobileWebUrl: inviteLink, webUrl: inviteLink } }],
    });
  } catch (err) {
    // 카카오 공유 실패 시 링크 복사로 대체
    try {
      await navigator.clipboard.writeText(inviteLink);
      showToast("초대 링크가 복사됐어요! 친구에게 붙여넣기 해주세요.");
    } catch {
      showToast(`초대 링크: ${inviteLink}`);
    }
  }
});

// ⚠️ 이 등록이 최상위(top-level) 코드에서 바로 실행되기 때문에, supabaseClient가 null이면
//    (설정값이 비어있거나 SDK 로드 실패) 여기서 에러가 나서 이 아래에 있는 모든 코드
//    (카테고리 탭, 이벤트 로딩 등 Init 블록 전체)가 실행이 안 되는 심각한 문제가 있었습니다.
//    반드시 null 체크로 감싸서, 로그인 설정이 잘못돼도 사이트 나머지 기능은 정상 작동하게 합니다.
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateProfileButton();

    // "SIGNED_IN"은 방금 로그인했을 때, "INITIAL_SESSION"은 이미 로그인된 상태로
    // 페이지를 새로고침했을 때 발생함 — 두 경우 모두 동기화가 필요함
    if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && currentUser) {
      if (event === "SIGNED_IN") closeAuthModal();
      loadUserPreferencesAndSync();
    }
    if (event === "SIGNED_OUT") {
      // 로그아웃 시 좋아요는 localStorage 기준으로 되돌아감 (다음 로그인 시 다시 동기화)
    }
  });
}

/* ---------- AI 섹션 모드 전환 (맞춤 이벤트 추천 ↔ 여행 플래너) ---------- */
/* ---------- AI 여행 플래너 오버레이 (하단 "검색" 탭에서 진입) ---------- */
function openTravelPlanner() {
  const dateInput = document.getElementById("travelDate");
  const endDateInput = document.getElementById("travelEndDate");
  const today = new Date().toISOString().slice(0, 10);
  if (!dateInput.value) dateInput.value = today;
  if (!endDateInput.value) endDateInput.value = today;

  document.getElementById("travelPlannerOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}

document.getElementById("travelPlannerClose").addEventListener("click", () => {
  document.getElementById("travelPlannerOverlay").classList.remove("open");
  document.body.style.overflow = "";
});
document.getElementById("travelPlannerOverlay").addEventListener("click", (e) => {
  if (e.target.id === "travelPlannerOverlay") {
    document.getElementById("travelPlannerOverlay").classList.remove("open");
    document.body.style.overflow = "";
  }
});

document.getElementById("travelPlannerForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const startDate = document.getElementById("travelDate").value;
  const endDate = document.getElementById("travelEndDate").value;
  const region = document.getElementById("travelRegion").value.trim();
  const spinnerWrap = document.getElementById("travelSpinnerWrap");
  const errorEl = document.getElementById("travelError");
  const resultEl = document.getElementById("travelResult");
  const submitBtn = document.getElementById("travelPlannerSubmitBtn");

  errorEl.hidden = true;
  resultEl.hidden = true;

  if (!startDate || !endDate || !region) {
    showTravelError("날짜와 지역을 모두 입력해 주세요.", null);
    return;
  }
  if (endDate < startDate) {
    showTravelError("종료일은 시작일보다 빠를 수 없어요.", null);
    return;
  }

  spinnerWrap.hidden = false;
  submitBtn.disabled = true;
  submitBtn.textContent = "계획 짜는 중...";

  try {
    const res = await fetch("/api/itinerary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region, start_date: startDate, end_date: endDate }),
    });
    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || `서버 오류 (${res.status})`);
    }

    renderTravelResult(data);

  } catch (err) {
    // ── 예외처리: AI/네이버 API 실패 시 안내 문구 + 폴백 데이터 표시 ──
    console.error("여행 플래너 오류:", err);
    showTravelError(
      "AI 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주시거나, 하단의 백업(폴백) 데이터를 확인해 주세요.",
      { destination: region, start_date: startDate, end_date: endDate }
    );

  } finally {
    spinnerWrap.hidden = true;
    submitBtn.disabled = false;
    submitBtn.textContent = "여행 계획 짜기";
  }
});

function showTravelError(message, fallbackContext) {
  const errorEl = document.getElementById("travelError");
  errorEl.hidden = false;
  errorEl.innerHTML = `<p>${message}</p>`;

  // 완전 실패 시에도 화면이 텅 비지 않도록 최소한의 안전 폴백 카드를 보여줌
  if (fallbackContext) {
    renderTravelResult({
      destination: fallbackContext.destination,
      start_date: fallbackContext.start_date,
      end_date: fallbackContext.end_date,
      num_days: 1,
      days: [],
      lodgings: [],
      errors: [{ step: "Client", type: "Fetch Error", message: "네트워크 또는 서버 응답 오류" }],
    });
  }
}

function renderTravelResult(data) {
  const resultEl = document.getElementById("travelResult");
  resultEl.hidden = false;

  const lodgingsHtml = (data.lodgings || []).length
    ? data.lodgings.map(l => `
        <div class="travel-place-card">
          <p class="travel-place-name">${l.name}</p>
          <p class="travel-place-meta">${l.category || ""} ${l.address ? "· " + l.address : ""}</p>
          ${l.url ? `<a href="${l.url}" target="_blank" rel="noopener noreferrer" class="travel-place-link">자세히 보기 ↗</a>` : ""}
        </div>`).join("")
    : `<p class="travel-empty">추천 숙박 정보를 불러오지 못했어요.</p>`;

  const activityBlock = (label, slot) => {
    if (!slot || !slot.name) return "";
    const badge = slot.activity_type ? `<span class="travel-activity-badge">${slot.activity_type}</span>` : "";
    return `
      <div class="travel-slot">
        <p class="travel-slot-label">${label} ${badge}</p>
        <p class="travel-slot-name">${slot.name}</p>
        <p class="travel-slot-desc">${slot.description || ""}</p>
      </div>`;
  };

  const mealBlock = (label, place) => {
    if (!place || !place.name) return `<div class="travel-slot"><p class="travel-slot-label">${label}</p><p class="travel-empty">추천 정보를 불러오지 못했어요.</p></div>`;
    return `
      <div class="travel-slot">
        <p class="travel-slot-label">${label}</p>
        <p class="travel-slot-name">${place.name}</p>
        <p class="travel-slot-desc">${place.category || ""} ${place.address ? "· " + place.address : ""}</p>
        ${place.url ? `<a href="${place.url}" target="_blank" rel="noopener noreferrer" class="travel-place-link">자세히 보기 ↗</a>` : ""}
      </div>`;
  };

  const daysHtml = (data.days || []).map(day => `
    <div class="travel-day-card">
      <p class="travel-day-title">Day ${day.day_number} · ${day.date}</p>
      ${activityBlock("🌅 오전", day.morning)}
      ${mealBlock("🍚 점심", day.lunch)}
      ${activityBlock("☀️ 오후", day.afternoon)}
      ${mealBlock("🍽 저녁", day.dinner)}
      ${activityBlock("🌙 저녁 활동", day.evening)}
      ${day.route_tip ? `<p class="travel-slot-desc travel-day-route">🗺 ${day.route_tip}</p>` : ""}
    </div>
  `).join("");

  const kakaoSearchLink = `https://map.kakao.com/link/search/${encodeURIComponent(data.destination)}`;
  const dateRangeLabel = data.start_date === data.end_date
    ? data.start_date
    : `${data.start_date} ~ ${data.end_date}`;

  resultEl.innerHTML = `
    <h3 class="travel-section-title">📍 ${data.destination} · ${dateRangeLabel} (${data.num_days || (data.days || []).length}일)</h3>

    <p class="travel-disclaimer">⚠️ 명소·행사 정보는 AI가 생성한 참고용 추천입니다. 실제 운영 여부·정확한 일정은 방문 전 꼭 확인해주세요. 맛집·숙박 정보는 네이버 실시간 검색 결과입니다.</p>

    ${daysHtml || `<p class="travel-empty">일정을 불러오지 못했어요.</p>`}

    <div class="travel-block">
      <p class="travel-block-label">🏨 추천 숙박</p>
      <div class="travel-place-grid">${lodgingsHtml}</div>
    </div>

    <a class="kakao-route-btn" href="${kakaoSearchLink}" target="_blank" rel="noopener noreferrer">🗺 카카오맵에서 ${data.destination} 검색하기</a>

    ${data.errors && data.errors.length ? `
    <details class="travel-error-log">
      <summary>⚠️ 일부 데이터는 백업 정보로 대체되었어요 (${data.errors.length}건)</summary>
      <ul>
        ${data.errors.map(e => `<li>[${e.step}] ${e.message}</li>`).join("")}
      </ul>
    </details>` : ""}
  `;
}

