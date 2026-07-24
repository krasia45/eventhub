"""
승인 대기 후보(event_candidates) + 게시된 이벤트(events) 관리를 한 파일로 통합.
(Vercel Hobby 플랜의 "서버리스 함수 12개 제한"에 걸려서, 원래 admin_events.py였던
 기능을 이 파일에 합쳤습니다. 프론트(admin.html)에서는 여전히 /api/admin_candidates
 하나로만 호출하고, resource/action 값으로 어느 쪽 로직인지 구분합니다.)

── 승인 대기 후보 ──
GET  /api/admin_candidates?key=ADMIN_SECRET
POST /api/admin_candidates
     body: { key, action: "approve"|"reject", candidateId, lat, lng, image, domain, link, conditions, desc }

── 게시된 이벤트 관리 (이전 admin_events.py) ──
GET  /api/admin_candidates?key=ADMIN_SECRET&resource=events&search=검색어&category=fashion
POST /api/admin_candidates
     body: { key, action: "update", eventId, patch: {...} }
     body: { key, action: "deactivate"|"reactivate"|"delete", eventId }

ADMIN_SECRET은 Vercel 환경변수로 설정하고, 관리자만 아는 값으로 유지하세요.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import uuid
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_insert, sb_update, sb_delete

# events 테이블에서 수정 가능한 필드 화이트리스트.
# id/created_at처럼 시스템이 관리하는 값이나, 임의 컬럼 주입을 막기 위해 명시적으로 허용된 것만 반영한다.
EDITABLE_EVENT_FIELDS = {
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

        if query.get("resource", [""])[0] == "events":
            self._get_published_events(query)
        else:
            self._get_pending_candidates()

    def _get_pending_candidates(self):
        try:
            rows = sb_select("event_candidates", {
                "select": "*",
                "status": "eq.pending",
                "order": "found_at.desc",
            })
            self._send_json(200, rows)
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _get_published_events(self, query):
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

        if action in ("approve", "reject"):
            self._handle_candidate_action(data, action)
        elif action in ("update", "deactivate", "reactivate", "delete"):
            self._handle_event_action(data, action)
        else:
            self._send_json(400, {"error": "올바르지 않은 action입니다."})

    # ── 승인 대기 후보 처리 (기존 admin_candidates.py 로직 그대로) ──
    def _handle_candidate_action(self, data, action):
        candidate_id = data.get("candidateId")
        if not candidate_id:
            self._send_json(400, {"error": "candidateId가 필요합니다."})
            return

        try:
            if action == "reject":
                sb_update("event_candidates", {"id": f"eq.{candidate_id}"}, {
                    "status": "rejected", "reviewed_at": "now()",
                })
                self._send_json(200, {"success": True})
                return

            lat = data.get("lat")
            lng = data.get("lng")

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
                "conditions": data.get("conditions") or c.get("conditions", ""),
                "desc": data.get("desc") or c.get("desc", ""),
                "tags": c.get("tags", []),
                "image": data.get("image") or c.get("image", ""),
                "domain": data.get("domain", ""),
                "link": data.get("link") or c.get("source_url"),
                "source_url": c.get("source_url"),
                "source_type": c.get("source_type", "unknown"),
                "source_checked_at": "now()",
            })
            sb_insert("event_stats", {"event_id": new_id, "views": 0, "likes": 0})
            sb_update("event_candidates", {"id": f"eq.{candidate_id}"}, {
                "status": "approved", "reviewed_at": "now()",
            })

            self._send_json(200, {"success": True, "eventId": new_id})

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    # ── 게시된 이벤트 관리 (기존 admin_events.py 로직 그대로) ──
    def _handle_event_action(self, data, action):
        event_id = data.get("eventId")
        if not event_id:
            self._send_json(400, {"error": "eventId가 필요합니다."})
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
            clean_patch = {k: v for k, v in patch.items() if k in EDITABLE_EVENT_FIELDS}
            if not clean_patch:
                self._send_json(400, {"error": "수정할 내용이 없습니다."})
                return

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