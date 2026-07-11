"""
POST /api/stats
{ "action": "trackView" | "like" | "unlike", "eventId": "e001" }

조회수/좋아요를 Supabase에 원자적으로 증감시킵니다 (increment_event_stat RPC 사용).
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from api._supabase_client import sb_rpc


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
            event_id = data.get("eventId")
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

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
