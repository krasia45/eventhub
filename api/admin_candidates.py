"""
GET  /api/admin_candidates?key=ADMIN_SECRET          → 승인 대기 후보 목록
POST /api/admin_candidates                            → 승인/반려 처리
     body: { key, action: "approve"|"reject", candidateId, lat, lng, image, domain, link }

ADMIN_SECRET은 Vercel 환경변수로 설정하고, 관리자만 아는 값으로 유지하세요.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import uuid
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_insert, sb_update


def check_admin_key(provided_key):
    real_key = os.environ.get("ADMIN_SECRET", "")
    return bool(real_key) and provided_key == real_key


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        key = query.get("key", [""])[0]

        if not check_admin_key(key):
            self._send_json(401, {"error": "관리자 인증이 필요합니다."})
            return

        try:
            rows = sb_select("event_candidates", {
                "select": "*",
                "status": "eq.pending",
                "order": "found_at.desc",
            })
            self._send_json(200, rows)
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

        if not check_admin_key(data.get("key", "")):
            self._send_json(401, {"error": "관리자 인증이 필요합니다."})
            return

        action = data.get("action")
        candidate_id = data.get("candidateId")
        if action not in ("approve", "reject") or not candidate_id:
            self._send_json(400, {"error": "action과 candidateId가 필요합니다."})
            return

        try:
            if action == "reject":
                sb_update("event_candidates", {"id": f"eq.{candidate_id}"}, {
                    "status": "rejected", "reviewed_at": "now()",
                })
                self._send_json(200, {"success": True})
                return

            # ── 승인: 위치정보(lat/lng)는 AI가 신뢰성 있게 알 수 없으므로 관리자가 직접 입력 ──
            lat = data.get("lat")
            lng = data.get("lng")
            if lat is None or lng is None:
                self._send_json(400, {"error": "승인 시 위치(lat, lng)를 입력해야 합니다."})
                return

            candidate_rows = sb_select("event_candidates", {"select": "*", "id": f"eq.{candidate_id}"})
            if not candidate_rows:
                self._send_json(404, {"error": "후보를 찾을 수 없습니다."})
                return
            c = candidate_rows[0]

            new_id = f"real-{uuid.uuid4().hex[:10]}"
            sb_insert("events", {
                "id": new_id,
                "category": c["category"],
                "brand": c["brand"],
                "merchant_type": data.get("merchantType", "브랜드"),
                "is_verified_real": True,
                "lat": lat, "lng": lng,
                "title": c["title"],
                "subtitle": c.get("subtitle", ""),
                "discount": c.get("discount", ""),
                "period": c.get("period", ""),
                "period_start": c.get("period_start"),
                "period_end": c.get("period_end"),
                "channel": c.get("channel", ""),
                "desc": c.get("desc", ""),
                "tags": c.get("tags", []),
                "image": data.get("image") or c.get("image", ""),
                "domain": data.get("domain", ""),
                "link": data.get("link") or c.get("source_url"),
                "source_url": c.get("source_url"),
            })
            sb_insert("event_stats", {"event_id": new_id, "views": 0, "likes": 0})
            sb_update("event_candidates", {"id": f"eq.{candidate_id}"}, {
                "status": "approved", "reviewed_at": "now()",
            })

            self._send_json(200, {"success": True, "eventId": new_id})

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