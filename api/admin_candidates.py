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
import re
import sys
import uuid
from urllib.parse import urlparse, parse_qs
from datetime import date

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_insert, sb_update, sb_delete


def normalize_domain(raw):
    """api/admin_url_register.py의 normalize_domain과 동일한 로직.
    승인 화면(.f-domain)에서 관리자가 프로토콜/www/경로가 섞인 값을 넣어도,
    실제로 events 테이블에 최종 저장되는 이 지점에서 한 번 더 정제한다."""
    if not raw:
        return ""
    d = raw.strip().lower()
    d = re.sub(r"^https?://", "", d)
    d = d.split("/")[0].split("?")[0].split("#")[0]
    if d.startswith("www."):
        d = d[4:]
    return d.strip()


KOREAN_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]


def format_date_kr(date_str):
    """api/admin_url_register.py의 format_date_kr과 동일한 로직.
    'YYYY-MM-DD' -> '2026.07.31(금)' — 게시된 이벤트의 기간을 수정할 때도 수동등록과
    같은 형식(요일 포함)으로 period 문구를 다시 만든다."""
    try:
        d = date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return date_str.replace("-", ".") if isinstance(date_str, str) else ""
    return f"{d.year}.{d.month:02d}.{d.day:02d}({KOREAN_WEEKDAYS[d.weekday()]})"

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
        elif query.get("resource", [""])[0] == "review_needed":
            self._get_review_needed_events()
        else:
            self._get_pending_candidates()

    # 관리자가 매번 이메일을 안 봐도, 관리자페이지 안에서 "지금 뭘 확인해야 하는지" 한눈에
    # 보이게 하기 위한 리소스. 세 가지 사유로 뽑는다:
    #   1) 링크 확인이 최근에 1번 실패함(link_fail_count>=1, 아직 비활성화 임계치는 아님)
    #   2) 종료일이 지났는데 아직 is_active=true로 남아있는 이례 케이스
    #      (링크는 살아있어서 자동 비활성화 로직을 안 탄 경우 — 실제로는 내려야 함)
    #   3) 승인(등록)된 지 30일 이상 지남 — 정보가 여전히 정확한지 관리자가 한 번 다시 봐야 함
    REVIEW_STALE_DAYS = 30

    def _get_review_needed_events(self):
        try:
            from datetime import date, timedelta
            today = date.today()
            stale_before = (today - timedelta(days=self.REVIEW_STALE_DAYS)).isoformat()
            rows = sb_select("events", {
                "select": "id,category,brand,title,period_end,link_fail_count,created_at,is_active",
                "is_active": "eq.true",
                "or": f"(link_fail_count.gte.1,period_end.lt.{today.isoformat()},created_at.lt.{stale_before})",
                "order": "created_at.asc",
                "limit": "100",
            })
            for r in rows:
                reasons = []
                if (r.get("link_fail_count") or 0) >= 1:
                    reasons.append("link_warning")
                if r.get("period_end") and r["period_end"] < today.isoformat():
                    reasons.append("ended_but_active")
                if r.get("created_at") and r["created_at"][:10] < stale_before:
                    reasons.append("stale_30days")
                r["review_reasons"] = reasons
            self._send_json(200, rows)
        except Exception as e:
            self._send_json(500, {"error": str(e)})

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
            is_nationwide = bool(data.get("nationwide"))

            candidate_rows = sb_select("event_candidates", {"select": "*", "id": f"eq.{candidate_id}"})
            if not candidate_rows:
                self._send_json(404, {"error": "후보를 찾을 수 없습니다."})
                return
            c = candidate_rows[0]

            # ⚠️ 카드/상세페이지의 "온라인"·"오프라인"·"온오프라인" 배지는 좌표가 아니라
            # channel(참여방법) 텍스트에서 "온라인"/"매장·오프라인·현장·방문" 같은 단어를
            # 찾아서 판단한다(js/04-render-tabs-ranking-feed.js의 getChannelMode). 관리자가
            # 승인 화면에서 "전국 매장/위치 다수" 체크박스로 온라인+오프라인을 표시했는데,
            # 정작 참여방법 텍스트에 그 단어가 하나도 없으면 온라인 전용으로 잘못 표시되는
            # 문제가 있었다 — 텍스트를 관리자가 정확히 쓰기를 기대하는 대신, 여기서 필요한
            # 단어를 자동으로 보장해서 화면 표시가 체크박스와 항상 일치하게 만든다.
            channel = c.get("channel") or ""
            if is_nationwide:
                missing_markers = []
                if not re.search(r"온라인", channel):
                    missing_markers.append("온라인에서도 이용 가능")
                if not re.search(r"오프라인|매장|현장|방문", channel):
                    missing_markers.append("전국 매장 등 오프라인에서도 이용 가능")
                if missing_markers:
                    channel = "\n".join(missing_markers + ([channel] if channel else []))

            new_id = f"real-{uuid.uuid4().hex[:10]}"
            sb_insert("events", {
                "id": new_id,
                "category": c["category"],
                "brand": c["brand"],
                "merchant_type": data.get("merchantType") or "브랜드",
                "is_verified_real": True,
                "lat": lat, "lng": lng,
                "title": c["title"],
                "subtitle": c.get("subtitle") or "",
                "discount": c.get("discount") or "",
                "period": c.get("period") or "",
                "period_start": c.get("period_start"),
                "period_end": c.get("period_end"),
                "channel": channel,
                "conditions": data.get("conditions") or c.get("conditions") or "",
                "target_audience": data.get("targetAudience") or c.get("target_audience") or "",
                "desc": data.get("desc") or c.get("desc") or "",
                "tags": c.get("tags") or [],
                "image": data.get("image") or c.get("image") or "",
                "domain": normalize_domain(data.get("domain") or ""),
                "link": data.get("link") or c.get("source_url"),
                "source_url": c.get("source_url"),
                "source_type": c.get("source_type") or "unknown",
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
                    if start and end:
                        clean_patch["period"] = f"{format_date_kr(start)} - {format_date_kr(end)}"
                    elif start:
                        # 종료일을 지워서 저장하면(= 소진시까지 등 무기한으로 전환) "2026.07.01(수) - "
                        # 처럼 문구가 비어 보이지 않도록 기본 라벨을 채워준다.
                        clean_patch["period"] = f"{format_date_kr(start)} - 소진시까지"
                    elif end:
                        clean_patch["period"] = f"{format_date_kr(end)}까지"
                    else:
                        clean_patch["period"] = "소진시까지"

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