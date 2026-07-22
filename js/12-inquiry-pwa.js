/* =========================================================
   문의하기 (Inquiry) — Google Apps Script 웹앱 연동
   ========================================================= */
const inquiryForm = document.getElementById("inquiryForm");
const inquiryStatus = document.getElementById("inquiryStatus");
const inquirySubmitBtn = document.getElementById("inquirySubmitBtn");

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showInquiryStatus(message, isError) {
  inquiryStatus.hidden = false;
  inquiryStatus.textContent = message;
  inquiryStatus.style.color = isError ? "#E53E3E" : "";
}

if (inquiryForm) {
  inquiryForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("inquiryName").value.trim();
    const email = document.getElementById("inquiryEmail").value.trim();
    const message = document.getElementById("inquiryMessage").value.trim();
    const website = document.getElementById("inquiryWebsite").value; // 허니팟 — 사람은 못 보니 항상 빈 값이어야 정상

    // ── 예외처리 1: 이메일 형식 오류
    if (!email || !isValidEmail(email)) {
      showInquiryStatus("올바른 이메일을 입력해주세요.", true);
      return;
    }
    // ── 예외처리 2: 빈 문의 내용
    if (!message) {
      showInquiryStatus("문의 내용을 입력해주세요.", true);
      return;
    }

    inquirySubmitBtn.disabled = true;
    inquirySubmitBtn.textContent = "등록 중...";
    showInquiryStatus("문의를 등록하는 중입니다...", false);

    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });

      const result = await res.json();

      // ── 이전 버전의 버그: 응답을 확인하지 않고 항상 "성공"으로 표시했음.
      //    백엔드가 에러를 반환해도 화면에는 성공 메시지가 떠서 문제를 알아챌 수 없었습니다.
      if (!res.ok || result.error) {
        throw new Error(result.error || `서버 오류 (${res.status})`);
      }

      showInquiryStatus("문의가 정상적으로 접수되었습니다. 감사합니다!", false);
      inquiryForm.reset();

    } catch (err) {
      // ── 예외처리 3: 네트워크/서버 오류
      console.error("문의 등록 오류:", err);
      showInquiryStatus(err.message || "잠시 후 다시 시도해주세요.", true);

    } finally {
      inquirySubmitBtn.disabled = false;
      inquirySubmitBtn.textContent = "문의 등록하기";
    }
  });
}

/* ---------- PWA: 서비스 워커 등록 (설치 가능 + 기본 오프라인 셸 캐싱) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("서비스 워커 등록 실패(치명적이지 않음):", err);
    });
  });
}