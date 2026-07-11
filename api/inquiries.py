"""
GET  /api/inquiries        → 최근 문의 10건 조회 (상태 배지 포함)
POST /api/inquiries        → 문의 등록 + Gmail 알림 발송

Google Sheets/Apps Script를 대체합니다.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import smtplib
import sys
from email.mime.text import MIMEText

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_insert


def is_valid_email(email):
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))


def send_gmail_notification(name, email, message):
    """Gmail SMTP + 앱 비밀번호로 알림 발송 (Google Apps Script 대신)."""
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
        try:
            rows = sb_select("inquiries", {
                "select": "name,message,status,created_at",
                "order": "created_at.desc",
                "limit": "10",
            })
            result = [{
                "name": r.get("name") or "익명",
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
            name = (data.get("name") or "").strip() or "익명"
            email = (data.get("email") or "").strip()
            message = (data.get("message") or "").strip()
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

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

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
