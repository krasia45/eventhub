"""
POST /api/check_broken_links
Vercel Cron이 매일 1회 호출합니다.

모든 활성 이벤트의 link 필드에 HEAD 요청을 보내서, 404/500 등 오류 응답이거나
연결이 아예 안 되면 해당 이벤트를 is_active=false로 비활성화하고
관리자에게 이메일로 요약 알림을 보냅니다.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import smtplib
import urllib.request
import urllib.error
from email.mime.text import MIMEText

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_update


def check_link(url, timeout=6):
    """HEAD 요청으로 링크 상태 확인. 일부 서버는 HEAD를 안 받아줘서 실패하면 GET으로 재시도."""
    for method in ("HEAD", "GET"):
        try:
            req = urllib.request.Request(url, method=method, headers={"User-Agent": "Mozilla/5.0 (EventHub-LinkChecker)"})
            with urllib.request.urlopen(req, timeout=timeout) as res:
                if res.status < 400:
                    return True
        except urllib.error.HTTPError as e:
            if e.code < 400:
                return True
            continue
        except Exception:
            continue
    return False


def send_summary_email(broken_events):
    gmail_user = os.environ.get("GMAIL_USER", "")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD", "")
    notify_to = os.environ.get("NOTIFY_EMAIL", gmail_user)

    if not gmail_user or not gmail_app_password or not broken_events:
        return

    lines = [f"- [{ev['category']}] {ev['brand']} · {ev['title']} ({ev['link']})" for ev in broken_events]
    body_text = (
        f"매일 자동 링크 점검 결과, {len(broken_events)}개 이벤트의 링크가 깨져서 자동 비활성화됐습니다.\n\n"
        + "\n".join(lines)
        + "\n\nSupabase Table Editor에서 확인 후, 필요하면 다시 활성화(is_active=true)해주세요."
    )
    msg = MIMEText(body_text)
    msg["Subject"] = f"[EventHub] 깨진 링크 {len(broken_events)}건 자동 비활성화됨"
    msg["From"] = gmail_user
    msg["To"] = notify_to

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=8) as server:
            server.login(gmail_user, gmail_app_password)
            server.sendmail(gmail_user, [notify_to], msg.as_string())
    except Exception as e:
        print("링크 점검 알림 메일 발송 실패:", str(e))


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        cron_secret = os.environ.get("CRON_SECRET", "")
        auth_header = self.headers.get("Authorization", "")
        if cron_secret and auth_header != f"Bearer {cron_secret}":
            self._send_json(401, {"error": "인증되지 않은 요청입니다."})
            return

        try:
            events = sb_select("events", {
                "select": "id,category,brand,title,link",
                "is_active": "eq.true",
            })
        except Exception as e:
            self._send_json(500, {"error": str(e)})
            return

        broken = []
        for ev in events:
            link = ev.get("link")
            if not link:
                continue
            if not check_link(link):
                broken.append(ev)

        for ev in broken:
            try:
                sb_update("events", {"id": f"eq.{ev['id']}"}, {
                    "is_active": False,
                    "link_last_checked": "now()",
                })
            except Exception as e:
                print(f"이벤트 {ev['id']} 비활성화 실패:", str(e))

        send_summary_email(broken)

        self._send_json(200, {
            "success": True,
            "checked": len(events),
            "deactivated": len(broken),
        })

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
