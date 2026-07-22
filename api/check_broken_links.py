"""
POST /api/check_broken_links
Vercel Cron이 매일 1회 호출합니다.

모든 활성 이벤트의 link 필드에 HEAD 요청을 보내서 상태를 확인합니다.

⚠️ 이전 버전: 한 번이라도 실패하면 바로 is_active=false로 비활성화했습니다.
   사이트 일시 점검, 네트워크 순단, 봇 차단(WAF) 등으로 인한 "가짜 실패"에도
   실제로 멀쩡한 이벤트가 조용히 사라지는 오탐 위험이 있었습니다.
   수정된 전략: 연속으로 FAIL_THRESHOLD번 실패해야만 비활성화합니다
   (link_fail_count로 연속 실패 횟수를 추적, 한 번이라도 성공하면 0으로 리셋).
   link_last_checked는 성공/실패와 무관하게 확인할 때마다 항상 갱신합니다.
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

FAIL_THRESHOLD = 2  # 이 횟수만큼 연속 실패해야 비활성화 (하루 1회 크론 기준 = 이틀 연속 실패)


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


def send_summary_email(deactivated, warned):
    gmail_user = os.environ.get("GMAIL_USER", "")
    gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD", "")
    notify_to = os.environ.get("NOTIFY_EMAIL", gmail_user)

    if not gmail_user or not gmail_app_password or not (deactivated or warned):
        return

    parts = []
    if deactivated:
        lines = [f"- [{ev['category']}] {ev['brand']} · {ev['title']} ({ev['link']})" for ev in deactivated]
        parts.append(f"🚫 자동 비활성화됨 ({len(deactivated)}건, 연속 {FAIL_THRESHOLD}회 실패):\n" + "\n".join(lines))
    if warned:
        lines = [f"- [{ev['category']}] {ev['brand']} · {ev['title']} ({ev['link']})" for ev in warned]
        parts.append(f"⚠️ 이번에 실패했지만 아직 비활성화는 안 됨 (내일도 실패하면 비활성화됨, {len(warned)}건):\n" + "\n".join(lines))

    body_text = "\n\n".join(parts) + "\n\nSupabase Table Editor에서 확인 후, 필요하면 is_active를 다시 true로 바꿔주세요."
    msg = MIMEText(body_text)
    msg["Subject"] = f"[EventHub] 링크 점검 결과 — 비활성화 {len(deactivated)}건 / 경고 {len(warned)}건"
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
                "select": "id,category,brand,title,link,link_fail_count",
                "is_active": "eq.true",
            })
        except Exception as e:
            self._send_json(500, {"error": str(e)})
            return

        deactivated = []
        warned = []

        for ev in events:
            link = ev.get("link")
            if not link:
                continue

            ok = check_link(link)

            if ok:
                # 성공: 실패 카운트 리셋 + 확인 시각 갱신 (한 번도 실패한 적 없어도 매번 갱신해서
                # "최근에 검증됨" 정보를 최신으로 유지)
                if ev.get("link_fail_count", 0) != 0:
                    try:
                        sb_update("events", {"id": f"eq.{ev['id']}"}, {
                            "link_fail_count": 0,
                            "link_last_checked": "now()",
                        })
                    except Exception as e:
                        print(f"이벤트 {ev['id']} 리셋 실패:", str(e))
                else:
                    try:
                        sb_update("events", {"id": f"eq.{ev['id']}"}, {"link_last_checked": "now()"})
                    except Exception as e:
                        print(f"이벤트 {ev['id']} link_last_checked 갱신 실패:", str(e))
                continue

            # 실패: 연속 실패 횟수를 올리고, 임계치에 도달했을 때만 비활성화
            new_fail_count = (ev.get("link_fail_count") or 0) + 1
            patch = {"link_fail_count": new_fail_count, "link_last_checked": "now()"}

            if new_fail_count >= FAIL_THRESHOLD:
                patch["is_active"] = False
                deactivated.append(ev)
            else:
                warned.append(ev)

            try:
                sb_update("events", {"id": f"eq.{ev['id']}"}, patch)
            except Exception as e:
                print(f"이벤트 {ev['id']} 갱신 실패:", str(e))

        send_summary_email(deactivated, warned)

        self._send_json(200, {
            "success": True,
            "checked": len(events),
            "deactivated": len(deactivated),
            "warned": len(warned),
        })

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)