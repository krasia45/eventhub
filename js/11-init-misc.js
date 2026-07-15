/* ---------- Init ---------- */
// 초대 링크(?ref=CODE)로 들어온 경우, 나중에 회원가입 완료 시 연결할 수 있도록 저장해둠
const urlRefCode = new URLSearchParams(window.location.search).get("ref");
if (urlRefCode) localStorage.setItem("eventhub-pending-ref", urlRefCode);

bindDiscountTabs();
loadEventsFromApi(); // 내부에서 renderCategoryTabs/renderRanking/renderFeed까지 트리거함
loadWeather(); // 위치 권한 없으면 서울 기준으로 기본 표시
renderAiKeywordChips(); // 기본(비로그인) 상태 — 로그인하면 onAuthStateChange에서 다시 그려짐

/* ---------- Day / Night Theme (자동 감지만, 수동 토글 버튼은 제거됨) ----------
   저장된 선호도가 있으면 그대로, 없으면 OS 설정을 따름.
   ⚠️ 다크모드 토글 버튼은 삭제하고 그 자리에 알림벨을 넣기로 했으므로,
   여기서 버튼 관련 엘리먼트를 참조하면 존재하지 않아 에러가 나서 이 아래 코드
   전체가 실행이 안 되는 문제가 생길 뻔했음 — 자동 감지 로직만 남기고 정리함. */
const THEME_KEY = "eventhub-theme";

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

applyTheme(getInitialTheme());

/* ---------- 헤더 알림벨 (관심 브랜드/키워드 관련 새 이벤트 안내) ---------- */
document.getElementById("notifBellBtn").addEventListener("click", () => {
  openNotificationPanel();
});

async function openNotificationPanel() {
  document.getElementById("notifDot").hidden = true;
  localStorage.setItem("eventhub-last-seen-notif", Date.now().toString());

  if (!currentUser || !supabaseClient) {
    showToast("로그인하시면 관심 브랜드의 새 이벤트를 알려드려요.");
    return;
  }

  try {
    const { data: follows } = await supabaseClient
      .from("user_follows")
      .select("brand")
      .eq("user_id", currentUser.id);

    const followedBrands = (follows || []).map(f => f.brand);
    if (followedBrands.length === 0) {
      showToast("아직 팔로우한 브랜드가 없어요. 이벤트 상세에서 브랜드를 팔로우해보세요!");
      return;
    }

    const matches = EVENTS.filter(ev => followedBrands.includes(ev.brand)).slice(0, 5);
    if (matches.length === 0) {
      showToast("팔로우한 브랜드의 진행 중인 이벤트가 아직 없어요.");
      return;
    }
    openSheet(matches[0].id);
    showToast(`팔로우한 ${matches[0].brand}의 이벤트예요!`);
  } catch (err) {
    console.error("알림 조회 오류:", err);
  }
}

// 마지막 방문 이후 팔로우한 브랜드의 새 이벤트가 있으면 벨에 점 표시
async function checkNewFollowedEvents() {
  if (!currentUser || !supabaseClient || EVENTS.length === 0) return;
  try {
    const { data: follows } = await supabaseClient.from("user_follows").select("brand").eq("user_id", currentUser.id);
    const followedBrands = (follows || []).map(f => f.brand);
    if (followedBrands.length > 0 && EVENTS.some(ev => followedBrands.includes(ev.brand))) {
      document.getElementById("notifDot").hidden = false;
    }
  } catch { /* 조용히 무시 — 알림은 부가 기능이라 실패해도 사이트 기능에 영향 없어야 함 */ }
}

/* ---------- 더보기 메뉴 (하단 내비게이션 "더보기" 탭) ---------- */
function openMoreMenu() {
  document.getElementById("moreMenuOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeMoreMenu() {
  document.getElementById("moreMenuOverlay").classList.remove("open");
  document.body.style.overflow = "";
}
document.getElementById("moreMenuClose").addEventListener("click", closeMoreMenu);
document.getElementById("moreMenuOverlay").addEventListener("click", (e) => {
  if (e.target.id === "moreMenuOverlay") closeMoreMenu();
});
// 더보기 메뉴 안의 버튼을 누르면 각 기능 실행 후 메뉴도 자동으로 닫힘
document.querySelector(".more-menu-grid").addEventListener("click", (e) => {
  if (e.target.closest(".quick-menu-btn")) closeMoreMenu();
});

/* ---------- 퀵메뉴 4버튼 (더보기 메뉴 안에 위치) ---------- */
document.getElementById("quickMenuCalendarBtn").addEventListener("click", () => openCalendar());

document.getElementById("quickMenuLocalBtn").addEventListener("click", () => {
  if (!gpsFilterActive) toggleGpsFilter();
  document.querySelector(".feed-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("quickMenuEndingBtn").addEventListener("click", () => {
  endingSoonFilterActive = !endingSoonFilterActive;
  showToast(endingSoonFilterActive ? "종료 임박 순으로 정렬했어요 ⏰" : "종료 임박 정렬을 해제했어요");
  renderFeed();
  document.querySelector(".feed-section").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.getElementById("quickMenuFollowBtn").addEventListener("click", openFollowedBrandsPanel);

async function openFollowedBrandsPanel() {
  if (!currentUser || !supabaseClient) {
    showToast("로그인하시면 관심 브랜드를 팔로우하고 알림을 받을 수 있어요.");
    return;
  }
  try {
    const { data } = await supabaseClient.from("user_follows").select("brand").eq("user_id", currentUser.id);
    const brands = (data || []).map(f => f.brand);
    if (brands.length === 0) {
      showToast("아직 팔로우한 브랜드가 없어요. 이벤트 상세에서 브랜드를 팔로우해보세요!");
      return;
    }
    showToast(`팔로우 중: ${brands.join(", ")}`);
  } catch (err) {
    console.error("팔로우 목록 조회 오류:", err);
  }
}

