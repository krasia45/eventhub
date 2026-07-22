"""
GET  /api/inquiries?key=ADMIN_SECRET   → 문의 목록 조회 (관리자 전용, 공개 노출 안 함)
POST /api/inquiries                    → 문의 등록 + Gmail 알림 발송 (누구나 가능)
POST /api/inquiries { action: "markAnswered", key, inquiryId } → 답변완료 처리 (관리자 전용)

Google Sheets/Apps Script를 대체합니다.

스팸 방지: 허니팟(honeypot) 필드 "website"를 폼에 숨겨두고, 값이 채워져서 오면
봇으로 간주해 저장/메일 발송 없이 조용히 성공 응답만 돌려줍니다 (봇에게 실패를
알려주지 않아야 재시도를 안 하기 때문). 실제 사용자에게는 안 보이는 필드라 정상
제출에는 영향이 없습니다.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import smtplib
import sys
from email.mime.text import MIMEText
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_insert, sb_update


def is_valid_email(email):
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def check_admin_key(provided_key):
    real_key = os.environ.get("ADMIN_SECRET", "")
    return bool(real_key) and provided_key == real_key


def send_gmail_notification(name, email, message):
    """Gmail SMTP + 앱 비밀번호로 알림 발송 (Google Apps Script 대신).​"""
    gmail_user = os.environ.get("GMAIL_USER", "")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD", "")
    notify_to = os.environ.get("NOTIFY_EMAIL", gmail_user)

    if not gmail_user or not gmail_app_password:
        return  # 메일 설정이 없으면 조용히 건너뜀 (문의 저장 자체는 계속 진행)

    body_text = f"이름: {name}\n이메일: {email}\n\n문의 내용:\n{message}"
    msg = MIMEText(body_text)
    msg["Subject"] = f"[EventHub 문의] {name}님의 새 문의가 도착했어요"
    msg["From"] = gmail_user
    msg["To"] = notify_to

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=8) as server:
        server.login(gmail_user, gmail_app_password)
        server.sendmail(gmail_user, [notify_to], msg.as_string())


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        # ── 개인정보 보호: 문의 목록은 더 이상 공개 노출하지 않고 관리자만 조회 가능 ──
        query = parse_qs(urlparse(self.path).query)
        key = query.get("key", [""])[0]

        if not check_admin_key(key):
            self._send_json(401, {"error": "관리자 인증이 필요합니다."})
            return

        try:
            rows = sb_select("inquiries", {
                "select": "id,name,email,message,status,created_at",
                "order": "created_at.desc",
                "limit": "50",
            })
            result = [{
                "id": r["id"],
                "name": r.get("name") or "익명",
                "email": r.get("email", ""),
                "message": r["message"],
                "status": r.get("status", "답변대기"),
                "time": r["created_at"][:16].replace("T", " "),
            } for r in rows]
            self._send_json(200, result)
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        if data.get("action") == "markAnswered":
            self._handle_mark_answered(data)
            return

        # ── 스팸 방지: 허니팟 필드가 채워져 있으면 봇으로 간주. 저장/메일 발송 없이
        #    성공 응답만 돌려줘서 봇이 재시도하지 않게 함 (실패를 알려주지 않는 게 핵심). ──
        if (data.get("website") or "").strip():
            self._send_json(200, {"success": True})
            return

        name = (data.get("name") or "").strip() or "익명"
        email = (data.get("email") or "").strip()
        message = (data.get("message") or "").strip()

        if not message:
            self._send_json(400, {"error": "문의 내용을 입력해주세요."})
            return
        if not email or not is_valid_email(email):
            self._send_json(400, {"error": "올바른 이메일을 입력해주세요."})
            return

        try:
            sb_insert("inquiries", {
                "name": name, "email": email, "message": message, "status": "답변대기",
            })
        except Exception as e:
            self._send_json(500, {"error": f"저장 중 오류: {str(e)}"})
            return

        try:
            send_gmail_notification(name, email, message)
        except Exception as e:
            # 메일 발송 실패해도 문의 저장은 이미 성공했으므로 에러로 처리하지 않고 로그만 남김
            print("Gmail 발송 실패:", str(e))

        self._send_json(200, {"success": True})

    def _handle_mark_answered(self, data):
        """admin.html에서 문의를 '답변완료'로 표시할 때 사용 (관리자 전용)."""
        if not check_admin_key(data.get("key", "")):
            self._send_json(401, {"error": "관리자 인증이 필요합니다."})
            return

        inquiry_id = data.get("inquiryId")
        if not inquiry_id:
            self._send_json(400, {"error": "inquiryId가 필요합니다."})
            return

        try:
            sb_update("inquiries", {"id": f"eq.{inquiry_id}"}, {"status": "답변완료"})
        except Exception as e:
            self._send_json(500, {"error": f"상태 변경 중 오류: {str(e)}"})
            return

        self._send_json(200, {"success": True})

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)