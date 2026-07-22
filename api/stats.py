"""
POST /api/stats
{ "action": "trackView" | "like" | "unlike", "eventId": "e001" }
{ "action": "navClick", "tab": "home" | "search" | "saved" | "more" | "profile" }

조회수/좋아요를 Supabase에 원자적으로 증감시킵니다 (increment_event_stat RPC 사용).
하단탭 클릭 집계는 increment_nav_click RPC를 사용합니다 — 어느 탭 배치가
실제로 많이 쓰이는지 데이터로 검증하기 위한 가벼운 카운터입니다.
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_rpc

VALID_TABS = ("home", "search", "saved", "more", "profile")


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

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
                # 탭 클릭 집계는 부가 기능이라 실패해도 사용자 경험엔 영향 없어야 함
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

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)