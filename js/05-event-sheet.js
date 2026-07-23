/* ---------- Bottom Sheet Modal ---------- */
const sheetOverlay = document.getElementById("sheetOverlay");
let activeEventId = null;

function openSheet(eventId) {
  const ev = EVENTS.find(e => e.id === eventId);
  if (!ev) return;
  activeEventId = eventId;

  recordRecentlyViewed(eventId);

  const sheetImageEl = document.getElementById("sheetImage");
  sheetImageEl.onerror = () => handleImageError(sheetImageEl);
  sheetImageEl.src = ev.image;
  sheetImageEl.alt = ev.title;

  const brandRowLogoEl = document.getElementById("sheetBrandRowLogo");
  brandRowLogoEl.src = getLogoUrl(ev.domain);
  brandRowLogoEl.alt = `${ev.brand} 로고`;
  attachLogoFallback(brandRowLogoEl, ev.brand, ev.domain);
  document.getElementById("sheetBrandRowName").textContent = ev.brand;

  document.getElementById("sheetTitle").textContent = ev.title;
  document.getElementById("sheetDdayInline").textContent = ev.dday || "";
  // 혜택 칩: "최대 50% 할인 + 추가 10% 쿠폰"처럼 +로 이어진 혜택은 칩 여러 개로 분리
  const benefitIc = `<span class="benefit-chip-ic"><svg viewBox="0 0 24 24" width="14" height="14" fill="none"><path d="M12.6 2.6 21 11a2 2 0 0 1 0 2.8L13.8 21a2 2 0 0 1-2.8 0L2.6 12.6A2 2 0 0 1 2 11.2V4a2 2 0 0 1 2-2h7.2c.5 0 1 .2 1.4.6Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor"/></svg></span>`;
  document.getElementById("sheetBenefitRow").innerHTML = (ev.discount || "")
    .split(/\s+\+\s+/).map(s => s.trim()).filter(Boolean)
    .map(b => `<span class="benefit-chip">${benefitIc}${escapeHtml(b)}</span>`).join("");
  document.getElementById("sheetPeriod").textContent = ev.period || "";
  document.getElementById("sheetDesc").textContent = ev.desc;

  // 참여방법: 텍스트에 줄바꿈이 있으면 번호 목록으로, 없으면 그냥 한 줄로 표시
  const channelEl = document.getElementById("sheetChannel");
  const channelLines = (ev.channel || "").split("\n").map(s => s.trim()).filter(Boolean);
  if (channelLines.length > 1) {
    channelEl.innerHTML = `<ol class="channel-steps">${channelLines.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ol>`;
  } else {
    channelEl.textContent = ev.channel;
  }

  // 이미지 위 태그 칩 (참고 디자인처럼 이미지 하단에 오버레이)
  document.getElementById("sheetHeroTags").innerHTML = (ev.tags || []).slice(0, 2).map((t, i) =>
    `<span class="hero-tag-chip ${i === 0 ? "hero-tag-primary" : ""}">${escapeHtml(t)}</span>`
  ).join("");

  // 조건(예: "네이버페이 결제 시에만 적용") — 값이 있을 때만 노출
  const conditionsRow = document.getElementById("sheetConditionsRow");
  if (ev.conditions && ev.conditions.trim()) {
    conditionsRow.hidden = false;
    document.getElementById("sheetConditions").textContent = ev.conditions;
  } else {
    conditionsRow.hidden = true;
  }

  // 대상(예: "신규 가입자 한정") — 값이 있을 때만 노출
  const targetRow = document.getElementById("sheetTargetRow");
  if (ev.targetAudience && ev.targetAudience.trim()) {
    targetRow.hidden = false;
    document.getElementById("sheetTarget").textContent = ev.targetAudience;
  } else {
    targetRow.hidden = true;
  }

  const verifiedNote = document.getElementById("sheetVerifiedNote");
  if (verifiedNote) verifiedNote.hidden = true; // "실제 진행중" 표시 전체 제거 방침에 따라 카드와 동일하게 항상 숨김

  const isPopup = ev.category === "popup";

  // 지도/길찾기는 "실제로 찾아가는 장소"인 팝업스토어에서만 의미가 있어 그 카테고리에서만 노출
  const mapSection = document.getElementById("mapSection");

  if (isPopup) {
    mapSection.hidden = false;
    renderEventMap(ev);

    document.getElementById("locationAddress").textContent = ev.title;
    document.getElementById("locationSub").textContent = `${ev.channel.split("\n")[0]}`;
    document.getElementById("locationRouteBtn").href = getKakaoRouteLink(ev);
    document.getElementById("locationNaverBtn").href = getNaverMapLink(ev);
    document.getElementById("locationKakaoBtn").href = getKakaoRouteLink(ev);
  } else {
    mapSection.hidden = true;
  }

  // 하단 고정 CTA: 위쪽 위치안내에 이미 길찾기/지도 버튼이 있으므로,
  // 하단 CTA는 팝업 여부와 상관없이 항상 '공식 사이트로 이동'을 담당 (역할 중복 방지)
  const primaryBtn = document.getElementById("stickyCtaPrimaryBtn");
  document.getElementById("stickyCtaPrimaryIcon").textContent = "🔗";
  document.getElementById("stickyCtaPrimaryLabel").textContent = isPopup ? "공식 사이트 확인하기" : "브랜드 사이트 이동";
  primaryBtn.href = ev.link;
  primaryBtn.target = "_blank";

  updateLikeButton();
  renderBrandFollowButton(ev);
  updateEventNotifyButton();

  // 조회수 집계 (백그라운드로 전송, 화면 동작 차단 안 함)
  eventStatsCache[eventId] = eventStatsCache[eventId] || { views: 0, likes: 0 };
  eventStatsCache[eventId].views += 1;
  sendEventStat("trackView", eventId);

  sheetOverlay.classList.add("open");
  document.body.style.overflow = "hidden";

  // "다녀왔어요" 후기는 실제로 방문하는 장소(팝업스토어)에만 의미가 있음.
  // 단순 할인 정보성 이벤트(패션/뷰티/카페 쿠폰 등)는 "방문"이라는 행위 자체가 없어서 숨김.
  const visitSection = document.getElementById("visitSection");
  if (isPopup) {
    visitSection.hidden = false;
    loadEventVisits(eventId);
  } else {
    visitSection.hidden = true;
  }
}

function closeSheet() {
  sheetOverlay.classList.remove("open");
  document.body.style.overflow = "";
  activeEventId = null;
}

function updateLikeButton() {
  const likeBtn = document.getElementById("likeBtn");
  const isLiked = likedEvents.has(activeEventId);

  likeBtn.classList.toggle("liked", isLiked);
  likeBtn.setAttribute("aria-label", isLiked ? "관심 이벤트에서 삭제" : "관심 이벤트로 등록");

  // 카드 그리드에 노출된 동일 이벤트의 하트 아이콘도 함께 동기화
  document.querySelectorAll(`.card-like-btn[data-id="${activeEventId}"]`).forEach(el => {
    el.classList.toggle("liked", isLiked);
  });
}

function updateEventNotifyButton() {
  const btn = document.getElementById("eventNotifyBtn");
  const label = document.getElementById("eventNotifyLabel");
  const isNotified = notifiedEvents.has(activeEventId);
  btn.classList.toggle("notified", isNotified);
  label.textContent = isNotified ? "알림 신청됨" : "알림신청";
}

function toggleEventNotify(eventId) {
  const nowOn = !notifiedEvents.has(eventId);
  if (nowOn) notifiedEvents.add(eventId); else notifiedEvents.delete(eventId);
  localStorage.setItem("eventhub-notified", JSON.stringify([...notifiedEvents]));
  if (activeEventId === eventId) updateEventNotifyButton();
  showToast(nowOn ? "이 이벤트의 알림을 신청했어요" : "이벤트 알림을 해제했어요");
}

document.getElementById("eventNotifyBtn").addEventListener("click", () => {
  if (activeEventId) toggleEventNotify(activeEventId);
});

/* ---------- 다녀왔어요 / 한줄평 (소셜 증거) ---------- */
async function renderBrandFollowButton(ev) {
  const btn = document.getElementById("brandFollowBtn");

  if (!currentUser || !supabaseClient) {
    updateFollowBtnUI(btn, false);
    btn.onclick = () => showToast("로그인하시면 브랜드 알림을 받을 수 있어요.");
    return;
  }

  let isFollowing = false;
  try {
    const { data } = await supabaseClient
      .from("user_follows")
      .select("brand")
      .eq("user_id", currentUser.id)
      .eq("brand", ev.brand)
      .maybeSingle();
    isFollowing = !!data;
  } catch (err) {
    console.error("팔로우 상태 조회 오류:", err);
  }

  updateFollowBtnUI(btn, isFollowing);

  btn.onclick = async () => {
    if (isFollowing) {
      const { error } = await supabaseClient.from("user_follows").delete().eq("user_id", currentUser.id).eq("brand", ev.brand);
      if (error) { showToast("팔로우 해제 중 오류가 발생했어요."); return; }
      isFollowing = false;
      showToast(`${ev.brand} 팔로우를 해제했어요`);
      supabaseClient.rpc("increment_nav_click", { p_tab: "brand_unfollow" }).then(() => {}, () => {}); // 실사용자 테스트 검증용 최소 계측, 실패해도 무시
    } else {
      const { error } = await supabaseClient.from("user_follows").insert({ user_id: currentUser.id, brand: ev.brand });
      if (error) { showToast("팔로우 중 오류가 발생했어요."); return; }
      isFollowing = true;
      showToast(`${ev.brand}을(를) 팔로우했어요! 🔔`);
      supabaseClient.rpc("increment_nav_click", { p_tab: "brand_follow" }).then(() => {}, () => {});
    }
    updateFollowBtnUI(btn, isFollowing);
  };
}

function updateFollowBtnUI(btn, isFollowing) {
  const label = btn.querySelector("#followBtnLabel");
  if (label) label.textContent = isFollowing ? "팔로우 중" : "브랜드 팔로우";
  btn.classList.toggle("following", isFollowing);
}

async function loadEventVisits(eventId) {
  const listEl = document.getElementById("visitCommentList");
  const countEl = document.getElementById("visitCount");
  const loginNotice = document.getElementById("visitLoginNotice");
  const formEl = document.getElementById("visitForm");

  loginNotice.hidden = !!currentUser;
  formEl.hidden = !currentUser;

  if (!supabaseClient) {
    listEl.innerHTML = "";
    countEl.textContent = "";
    return;
  }

  try {
    const { data } = await supabaseClient
      .from("event_visits")
      .select("comment, visited_at")
      .eq("event_id", eventId)
      .order("visited_at", { ascending: false })
      .limit(10);

    const visits = data || [];
    countEl.textContent = visits.length > 0 ? `(${visits.length}건)` : "";

    const withComments = visits.filter(v => v.comment && v.comment.trim());
    listEl.innerHTML = withComments.length === 0
      ? `<li class="empty-state">아직 한줄평이 없어요. 첫 방문 후기를 남겨보세요!</li>`
      : withComments.map(v => `
          <li class="visit-comment-item">
            ${escapeHtml(v.comment)}
            <div class="visit-comment-time">${new Date(v.visited_at).toLocaleDateString("ko-KR")}</div>
          </li>
        `).join("");

  } catch (err) {
    console.error("방문 기록 로드 오류:", err);
    listEl.innerHTML = "";
  }
}

document.getElementById("visitSubmitBtn").addEventListener("click", async () => {
  if (!supabaseClient || !currentUser || !activeEventId) {
    showToast("로그인 후 이용할 수 있어요.");
    return;
  }

  const comment = document.getElementById("visitComment").value.trim();
  const btn = document.getElementById("visitSubmitBtn");
  btn.disabled = true;

  try {
    const { error } = await supabaseClient.from("event_visits").upsert({
      user_id: currentUser.id,
      event_id: activeEventId,
      comment: comment || null,
    }, { onConflict: "user_id,event_id" });

    if (error) throw error;

    showToast("방문 인증 완료! 감사해요 🙌");
    document.getElementById("visitComment").value = "";
    loadEventVisits(activeEventId);

  } catch (err) {
    console.error("다녀왔어요 등록 오류:", err);
    showToast("등록 중 오류가 발생했어요.");
  } finally {
    btn.disabled = false;
  }
});

document.getElementById("sheetClose").addEventListener("click", closeSheet);
sheetOverlay.addEventListener("click", (e) => {
  if (e.target === sheetOverlay) closeSheet();
});

function toggleLike(eventId) {
  eventStatsCache[eventId] = eventStatsCache[eventId] || { views: 0, likes: 0 };
  const nowLiked = !likedEvents.has(eventId);

  if (!nowLiked) {
    likedEvents.delete(eventId);
    eventStatsCache[eventId].likes = Math.max(0, eventStatsCache[eventId].likes - 1);
    sendEventStat("unlike", eventId);
    showToast("관심 이벤트에서 삭제되었습니다");
  } else {
    likedEvents.add(eventId);
    eventStatsCache[eventId].likes += 1;
    sendEventStat("like", eventId);
    showToast("관심 이벤트로 등록되었습니다 ❤");
  }

  localStorage.setItem("eventhub-liked", JSON.stringify([...likedEvents]));

  // 로그인 상태라면 기기와 무관하게 유지되도록 user_saves 테이블에도 반영
  if (currentUser) {
    const query = nowLiked
      ? supabaseClient.from("user_saves").upsert({ user_id: currentUser.id, event_id: eventId }, { onConflict: "user_id,event_id" })
      : supabaseClient.from("user_saves").delete().eq("user_id", currentUser.id).eq("event_id", eventId);
    query.then(({ error }) => { if (error) console.error("찜 동기화 오류:", error); });
  }

  // 카드 그리드의 하트 아이콘 동기화
  document.querySelectorAll(`.card-like-btn[data-id="${eventId}"]`).forEach(btn => {
    btn.classList.toggle("liked", likedEvents.has(eventId));
  });

  // 상세 시트가 같은 이벤트를 보고 있다면 그쪽 하트도 동기화
  if (activeEventId === eventId) updateLikeButton();

  renderRanking(); // 좋아요 반영된 최신 랭킹으로 갱신
}

document.getElementById("likeBtn").addEventListener("click", () => {
  if (!activeEventId) return;
  toggleLike(activeEventId);
});

document.getElementById("stickyCtaShareBtn").addEventListener("click", () => {
  const ev = EVENTS.find(e => e.id === activeEventId);
  if (!ev) return;
  openShareFlow(ev);
});

// 공식 사이트 이동 클릭 추적 (실사용자 테스트에서 "실제로 사이트까지 넘어가는가"를 보기 위한 최소 계측).
// openSheet()가 열릴 때마다 리스너를 새로 걸면 안 되므로(중복 누적 버그), 여기서 1회만 등록하고
// 클릭 시점의 activeEventId를 그때그때 참조한다.
document.getElementById("stickyCtaPrimaryBtn").addEventListener("click", () => {
  if (activeEventId) sendEventStat("visitOfficial", activeEventId);
});

/* ---------- 캘린더 등록 (EventHub 자체 캘린더 — 09-calendar.js가 찜한 이벤트를 자동으로 표시) ---------- */
document.getElementById("calendarBtn").addEventListener("click", () => {
  const ev = EVENTS.find(e => e.id === activeEventId);
  if (!ev) return;

  if (!ev.periodStart || !ev.periodEnd) {
    showToast("이 이벤트는 기간 정보가 없어 캘린더에 정확히 표시되지 않을 수 있어요.");
  }

  if (!likedEvents.has(activeEventId)) {
    // toggleLike이 자체적으로 "관심 이벤트로 등록되었습니다" 토스트를 띄우지만,
    // 이 버튼에서는 "캘린더에 저장됐다"는 의도가 더 명확하게 전달되도록 아래에서 덮어씀
    toggleLike(activeEventId);
  }
  showToast("이벤트허브 캘린더에 저장됐어요 📅");
});