"""
GET  /api/admin_events?key=ADMIN_SECRET&search=검색어&category=fashion
     → 이미 게시된 이벤트(events 테이블) 목록 조회 (관리자 전용). search는 브랜드/제목 부분일치.

POST /api/admin_events
     body: { key, action: "update", eventId, patch: {...} }   → 정보 수정 (patch에 넣은 필드만 변경)
     body: { key, action: "deactivate", eventId }             → 비활성화 (soft — 사이트에서 즉시 숨겨지지만 복구 가능)
     body: { key, action: "reactivate", eventId }             → 재활성화
     body: { key, action: "delete", eventId }                 → 완전 삭제 (되돌릴 수 없음 — event_stats 등 연관 데이터도 같이 삭제됨)

⚠️ "삭제"는 되돌릴 수 없어서, admin.html에서는 기본으로 "비활성화"를 먼저 권하고
   "완전 삭제"는 별도로 한 번 더 확인받는 위험한 동작으로 다룹니다.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_update, sb_delete

# events 테이블에서 수정 가능한 필드 화이트리스트.
# id/created_at처럼 시스템이 관리하는 값이나, 임의 컬럼 주입을 막기 위해 명시적으로 허용된 것만 반영한다.
EDITABLE_FIELDS = {
    "category", "brand", "merchant_type", "title", "subtitle", "discount",
    "conditions", "period_start", "period_end", "channel", "desc", "tags",
    "image", "domain", "link", "lat", "lng",
}


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

        search = query.get("search", [""])[0].strip()
        category = query.get("category", [""])[0].strip()

        params = {
            "select": "id,category,brand,merchant_type,title,subtitle,discount,conditions,"
                      "period,period_start,period_end,channel,\"desc\",tags,image,domain,link,"
                      "source_url,is_active,link_fail_count,created_at,updated_at",
            "order": "created_at.desc",
            "limit": "200",
        }
        if category:
            params["category"] = f"eq.{category}"
        if search:
            # PostgREST or 필터: 브랜드 또는 제목에 검색어가 포함된 것
            safe = search.replace(",", " ").replace("(", " ").replace(")", " ")
            params["or"] = f"(brand.ilike.*{safe}*,title.ilike.*{safe}*)"

        try:
            rows = sb_select("events", params)
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
        event_id = data.get("eventId")
        if action not in ("update", "deactivate", "reactivate", "delete") or not event_id:
            self._send_json(400, {"error": "action과 eventId가 필요합니다."})
            return

        try:
            if action == "deactivate":
                sb_update("events", {"id": f"eq.{event_id}"}, {"is_active": False})
                self._send_json(200, {"success": True})
                return

            if action == "reactivate":
                sb_update("events", {"id": f"eq.{event_id}"}, {
                    "is_active": True, "link_fail_count": 0,
                })
                self._send_json(200, {"success": True})
                return

            if action == "delete":
                sb_delete("events", {"id": f"eq.{event_id}"})
                self._send_json(200, {"success": True})
                return

            # ── update ──
            patch = data.get("patch") or {}
            clean_patch = {k: v for k, v in patch.items() if k in EDITABLE_FIELDS}
            if not clean_patch:
                self._send_json(400, {"error": "수정할 내용이 없습니다."})
                return

            # period_start/period_end 중 하나라도 바뀌면, 화면 표시용 period 텍스트도 같이 맞춰준다
            if "period_start" in clean_patch or "period_end" in clean_patch:
                current = sb_select("events", {"select": "period_start,period_end", "id": f"eq.{event_id}"})
                if current:
                    start = clean_patch.get("period_start", current[0].get("period_start")) or ""
                    end = clean_patch.get("period_end", current[0].get("period_end")) or ""
                    clean_patch["period"] = f"{start} - {end}"

            clean_patch["updated_at"] = "now()"
            sb_update("events", {"id": f"eq.{event_id}"}, clean_patch)
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