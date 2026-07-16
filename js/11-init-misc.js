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

/* ---------- 헤더 알림벨 + 더보기 시트 알림 목록 (팔로우 브랜드의 "새" 이벤트 안내) ----------
   기존 코드는 "마지막 확인 시각"을 저장만 하고 실제로는 비교에 쓰지 않아서,
   팔로우한 브랜드의 이벤트가 예전부터 있었든 방금 새로 등록됐든 항상 점이 떴다.
   여기서는 이벤트의 createdAt과 저장된 마지막 확인 시각을 실제로 비교해서
   "마지막으로 확인한 뒤에 새로 등록된 이벤트"만 알림 대상으로 취급한다. */

function getLastSeenNotifTs() {
  const stored = localStorage.getItem("eventhub-last-seen-notif");
  if (!stored) {
    // 이 로직을 처음 도입하는 시점 — 이전부터 있던 이벤트를 전부 "새 이벤트"로
    // 오인하지 않도록 지금 시각을 기준으로 삼고, 이후 등록되는 것부터 알림 대상으로 취급
    const now = Date.now().toString();
    localStorage.setItem("eventhub-last-seen-notif", now);
    return Number(now);
  }
  return Number(stored);
}

function markNotifSeenNow() {
  localStorage.setItem("eventhub-last-seen-notif", Date.now().toString());
  setNotifDots(false);
}

function setNotifDots(visible) {
  document.getElementById("notifDot").hidden = !visible;
  const navDot = document.getElementById("navNotifDot");
  if (navDot) navDot.hidden = !visible;
}

async function getFollowedBrands() {
  if (!currentUser || !supabaseClient) return null; // null = 로그인 안 됨 (빈 배열과 구분)
  const { data } = await supabaseClient.from("user_follows").select("brand").eq("user_id", currentUser.id);
  return (data || []).map(f => f.brand);
}

function getNewFollowedMatches(followedBrands) {
  const lastSeen = getLastSeenNotifTs();
  return EVENTS
    .filter(ev => followedBrands.includes(ev.brand) && ev.createdAt && new Date(ev.createdAt).getTime() > lastSeen)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// 알림벨을 누르면 더보기 시트의 알림 목록으로 안내 (엔트리 포인트를 하나로 통합)
document.getElementById("notifBellBtn").addEventListener("click", () => {
  openMoreMenu();
});

// 마지막 확인 이후 팔로우한 브랜드의 새 이벤트가 있으면 벨에 점 표시 (앱 로드/로그인 시 호출)
async function checkNewFollowedEvents() {
  if (!currentUser || !supabaseClient || EVENTS.length === 0) return;
  try {
    const followedBrands = await getFollowedBrands();
    if (!followedBrands || followedBrands.length === 0) return;
    const matches = getNewFollowedMatches(followedBrands);
    setNotifDots(matches.length > 0);
  } catch { /* 조용히 무시 — 알림은 부가 기능이라 실패해도 사이트 기능에 영향 없어야 함 */ }
}

// 더보기 시트를 열 때(=사용자가 알림을 실제로 확인하는 시점) 목록을 그려줌
async function renderNotificationList() {
  const listEl = document.getElementById("notifList");
  const emptyEl = document.getElementById("notifEmpty");
  const loginEl = document.getElementById("notifLoginNotice");
  const markAllBtn = document.getElementById("notifMarkAllBtn");

  listEl.innerHTML = "";
  emptyEl.hidden = true;
  loginEl.hidden = true;
  markAllBtn.hidden = true;

  if (!currentUser || !supabaseClient) {
    loginEl.hidden = false;
    return;
  }

  try {
    const followedBrands = await getFollowedBrands();
    if (!followedBrands || followedBrands.length === 0) {
      emptyEl.hidden = false;
      return;
    }

    const matches = getNewFollowedMatches(followedBrands);
    if (matches.length === 0) {
      emptyEl.hidden = false;
    } else {
      listEl.innerHTML = matches.map(ev => `
        <li class="notif-item" data-id="${ev.id}">
          <span class="notif-item-emoji">🔔</span>
          <div class="notif-item-body">
            <p class="notif-item-brand">${escapeHtml(ev.brand)}</p>
            <p class="notif-item-title">${escapeHtml(ev.title)}</p>
          </div>
        </li>
      `).join("");
      listEl.querySelectorAll(".notif-item").forEach(el => {
        el.addEventListener("click", () => {
          closeMoreMenu();
          openSheet(el.dataset.id);
        });
      });
      markAllBtn.hidden = false;
    }

    // 목록을 실제로 봤으니 지금을 "확인함"으로 기록하고 벨의 점을 지움
    markNotifSeenNow();
  } catch (err) {
    console.error("알림 목록 조회 오류:", err);
  }
}

document.getElementById("notifMarkAllBtn").addEventListener("click", () => {
  renderNotificationList();
});


/* ---------- 더보기 메뉴 (하단 내비게이션 "더보기" 탭) ---------- */
function openMoreMenu() {
  document.getElementById("moreMenuOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  renderNotificationList();
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