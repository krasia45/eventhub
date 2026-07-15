/* =========================================================
   캘린더 (찜한 이벤트 자동 표기 + 개인 일정)
   ========================================================= */
const calendarOverlay = document.getElementById("calendarOverlay");
const scheduleFormOverlay = document.getElementById("scheduleFormOverlay");

let calendarViewDate = new Date(); // 현재 보고 있는 달(일자는 항상 1일로 고정해서 사용)
let calendarSelectedDate = null;   // "YYYY-MM-DD" 형태로 선택된 날짜
let personalSchedules = [];        // Supabase user_schedules에서 로드
let likedEventPeriods = [];        // 찜한 이벤트의 {start, end, title, brand} 목록

function formatDateKey(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dateHasSomething(dateKey) {
  const hasEvent = likedEventPeriods.some(p => p.start && p.end && dateKey >= p.start && dateKey <= p.end);
  const hasPersonal = personalSchedules.some(s => s.schedule_date === dateKey);
  return { hasEvent, hasPersonal };
}

async function openCalendar() {
  calendarOverlay.classList.add("open");
  document.body.style.overflow = "hidden";
  document.getElementById("calendarLoginNotice").hidden = !!currentUser;
  document.getElementById("calendarDayDetail").hidden = true;
  calendarSelectedDate = null;

  // 찜한 이벤트 기간은 로그인 여부와 무관하게 항상 표시 (localStorage 기준으로도 동작)
  likedEventPeriods = EVENTS.filter(ev => likedEvents.has(ev.id)).map(ev => ({
    start: ev.periodStart, end: ev.periodEnd, title: ev.title, brand: ev.brand, id: ev.id,
  }));

  if (currentUser && supabaseClient) {
    try {
      const { data } = await supabaseClient
        .from("user_schedules")
        .select("*")
        .eq("user_id", currentUser.id);
      personalSchedules = data || [];
    } catch (err) {
      console.error("개인 일정 로드 오류:", err);
      personalSchedules = [];
    }
  } else {
    personalSchedules = [];
  }

  renderCalendarGrid();
}

function closeCalendar() {
  calendarOverlay.classList.remove("open");
  document.body.style.overflow = "";
}

function renderCalendarGrid() {
  const y = calendarViewDate.getFullYear();
  const m = calendarViewDate.getMonth();
  document.getElementById("calendarMonthLabel").textContent = `${y}년 ${m + 1}월`;

  const firstDayOfWeek = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayKey = formatDateKey(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  let cells = "";
  for (let i = 0; i < firstDayOfWeek; i++) cells += `<div class="calendar-day-cell empty"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = formatDateKey(y, m, d);
    const { hasEvent, hasPersonal } = dateHasSomething(dateKey);
    const isToday = dateKey === todayKey;
    const isSelected = dateKey === calendarSelectedDate;

    const dots = [];
    if (hasEvent) dots.push(`<span class="calendar-day-dot" style="background:var(--accent)"></span>`);
    if (hasPersonal) dots.push(`<span class="calendar-day-dot" style="background:#4F8EF7"></span>`);

    cells += `
      <button class="calendar-day-cell ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-date="${dateKey}">
        <span>${d}</span>
        <span class="calendar-day-dots">${dots.join("")}</span>
      </button>
    `;
  }

  document.getElementById("calendarGrid").innerHTML = cells;

  document.querySelectorAll(".calendar-day-cell:not(.empty)").forEach(cell => {
    cell.addEventListener("click", () => {
      calendarSelectedDate = cell.dataset.date;
      renderCalendarGrid();
      renderCalendarDayDetail(calendarSelectedDate);
    });
  });
}

function renderCalendarDayDetail(dateKey) {
  const detailEl = document.getElementById("calendarDayDetail");
  const listEl = document.getElementById("calendarDayList");
  detailEl.hidden = false;

  const [y, m, d] = dateKey.split("-").map(Number);
  document.getElementById("calendarDayDetailTitle").textContent = `${m}월 ${d}일`;

  const eventsToday = likedEventPeriods.filter(p => p.start && p.end && dateKey >= p.start && dateKey <= p.end);
  const schedulesToday = personalSchedules.filter(s => s.schedule_date === dateKey);

  if (eventsToday.length === 0 && schedulesToday.length === 0) {
    listEl.innerHTML = `<li class="empty-state">이 날 등록된 일정이 없어요.</li>`;
    return;
  }

  const eventItems = eventsToday.map(ev => `
    <li class="calendar-day-item event-type" data-event-id="${ev.id}">
      <span class="calendar-day-item-time">🎟 이벤트</span>
      <div class="calendar-day-item-body">
        <p class="calendar-day-item-title">${ev.brand} · ${ev.title}</p>
      </div>
    </li>
  `);

  const scheduleItems = schedulesToday.map(s => `
    <li class="calendar-day-item personal-type">
      <span class="calendar-day-item-time">${s.start_time ? s.start_time.slice(0, 5) : ""}${s.end_time ? " ~ " + s.end_time.slice(0, 5) : ""}</span>
      <div class="calendar-day-item-body">
        <p class="calendar-day-item-title">${s.title}</p>
        ${s.memo ? `<p class="calendar-day-item-memo">${s.memo}</p>` : ""}
      </div>
      <button class="calendar-day-item-delete" data-schedule-id="${s.id}">삭제</button>
    </li>
  `);

  listEl.innerHTML = [...eventItems, ...scheduleItems].join("");

  listEl.querySelectorAll(".calendar-day-item.event-type").forEach(item => {
    item.addEventListener("click", () => {
      closeCalendar();
      openSheet(item.dataset.eventId);
    });
  });

  listEl.querySelectorAll(".calendar-day-item-delete").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deletePersonalSchedule(btn.dataset.scheduleId);
    });
  });
}

async function deletePersonalSchedule(scheduleId) {
  if (!supabaseClient || !currentUser) return;
  const { error } = await supabaseClient.from("user_schedules").delete().eq("id", scheduleId);
  if (error) { showToast("삭제 중 오류가 발생했어요."); return; }
  personalSchedules = personalSchedules.filter(s => s.id !== scheduleId);
  renderCalendarGrid();
  renderCalendarDayDetail(calendarSelectedDate);
}

document.getElementById("calendarClose").addEventListener("click", closeCalendar);
calendarOverlay.addEventListener("click", (e) => { if (e.target === calendarOverlay) closeCalendar(); });

document.getElementById("calendarPrevMonth").addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
  renderCalendarGrid();
});
document.getElementById("calendarNextMonth").addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
  renderCalendarGrid();
});

/* ---------- 개인 일정 추가 모달 ---------- */
document.getElementById("calendarAddScheduleBtn").addEventListener("click", () => {
  if (!currentUser) {
    showToast("로그인하시면 개인 일정을 추가할 수 있어요.");
    return;
  }
  const [y, m, d] = calendarSelectedDate.split("-").map(Number);
  document.getElementById("scheduleFormDate").textContent = `📅 ${m}월 ${d}일 일정 추가`;
  document.getElementById("scheduleForm").reset();
  scheduleFormOverlay.classList.add("open");
});

document.getElementById("scheduleFormClose").addEventListener("click", () => {
  scheduleFormOverlay.classList.remove("open");
});
scheduleFormOverlay.addEventListener("click", (e) => {
  if (e.target === scheduleFormOverlay) scheduleFormOverlay.classList.remove("open");
});

document.getElementById("scheduleForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!supabaseClient || !currentUser) { showToast("로그인이 필요해요."); return; }

  const startTime = document.getElementById("scheduleStartTime").value;
  const endTime = document.getElementById("scheduleEndTime").value;
  const title = document.getElementById("scheduleTitle").value.trim();
  const memo = document.getElementById("scheduleMemo").value.trim();

  if (!title) { showToast("일정 제목을 입력해주세요."); return; }

  const { data, error } = await supabaseClient.from("user_schedules").insert({
    user_id: currentUser.id,
    schedule_date: calendarSelectedDate,
    start_time: startTime || null,
    end_time: endTime || null,
    title, memo,
  }).select();

  if (error) {
    showToast("일정 저장 중 오류가 발생했어요.");
    console.error("일정 저장 오류:", error);
    return;
  }

  if (data && data[0]) personalSchedules.push(data[0]);
  scheduleFormOverlay.classList.remove("open");
  showToast("일정이 저장됐어요 📅");
  renderCalendarGrid();
  renderCalendarDayDetail(calendarSelectedDate);
});

