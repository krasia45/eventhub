"""
GET  /api/events
     Supabase에서 전체 이벤트 + 통계(조회수/좋아요)를 조회해 프론트엔드가 쓰던
     기존 EVENTS 배열과 동일한 필드 이름으로 변환해 반환합니다.

POST /api/events
     { "action": "trackView" | "like" | "unlike", "eventId": "e001" }
     { "action": "navClick", "tab": "home" | "search" | "saved" | "more" | "profile" }
     조회수/좋아요를 원자적으로 증감시킵니다 (increment_event_stat RPC 사용).
     하단탭 클릭 집계는 increment_nav_click RPC 사용.

(원래 GET은 events.py, POST는 stats.py로 분리돼 있었는데, 서로 메서드가 겹치지 않아서
 Vercel Hobby 플랜 함수 개수 제한 때문에 한 파일로 합쳤습니다.)
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_rpc

VALID_TABS = ("home", "search", "saved", "more", "profile")


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    # ── 이벤트 목록 조회 (기존 events.py) ──
    def do_GET(self):
        try:
            rows = sb_select("events", {
                "select": "*,event_stats(views,likes)",
                "is_active": "eq.true",
                "order": "created_at.desc",
            })

            events = []
            for r in rows:
                stats = (r.get("event_stats") or [{}])
                stats = stats[0] if isinstance(stats, list) and stats else (stats or {})
                events.append({
                    "id": r["id"],
                    "category": r["category"],
                    "brand": r["brand"],
                    "merchantType": r.get("merchant_type", "브랜드"),
                    "isVerifiedReal": r.get("is_verified_real", False),
                    "lat": r["lat"],
                    "lng": r["lng"],
                    "title": r["title"],
                    "subtitle": r.get("subtitle", ""),
                    "discount": r["discount"],
                    "period": r["period"],
                    "periodEnd": r.get("period_end"),
                    "periodStart": r.get("period_start"),
                    "createdAt": r.get("created_at"),
                    "channel": r.get("channel", ""),
                    "conditions": r.get("conditions", ""),
                    "targetAudience": r.get("target_audience", ""),
                    "desc": r.get("desc", ""),
                    "tags": r.get("tags", []) or [],
                    "image": r.get("image", ""),
                    "domain": r.get("domain", ""),
                    "link": r.get("link", ""),
                    "views": stats.get("views", 0),
                    "likes": stats.get("likes", 0),
                })

            self._send_json(200, events, cache=True)

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    # ── 조회수/좋아요/탭클릭 통계 (기존 stats.py) ──
    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            action = data.get("action")
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        if action == "navClick":
            tab = data.get("tab")
            if tab not in VALID_TABS:
                self._send_json(400, {"error": "유효한 tab 값이 필요합니다."})
                return
            try:
                sb_rpc("increment_nav_click", {"p_tab": tab})
                self._send_json(200, {"success": True})
            except Exception as e:
                self._send_json(200, {"success": False, "error": str(e)})
            return

        event_id = data.get("eventId")

        if not event_id or action not in ("trackView", "like", "unlike"):
            self._send_json(400, {"error": "eventId와 유효한 action이 필요합니다."})
            return

        field = "views" if action == "trackView" else "likes"
        delta = -1 if action == "unlike" else 1

        try:
            sb_rpc("increment_event_stat", {
                "p_event_id": event_id,
                "p_field": field,
                "p_delta": delta,
            })
            self._send_json(200, {"success": True})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status, data, cache=False):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        if cache:
            self.send_header("Cache-Control", "public, max-age=60")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)