"""
GET /api/events
Supabase에서 전체 이벤트 + 통계(조회수/좋아요)를 조회해 프론트엔드가 쓰던
기존 EVENTS 배열과 동일한 필드 이름으로 변환해 반환합니다.
(main.js가 하드코딩된 EVENTS 대신 이 API를 fetch해서 사용하도록 변경됩니다.)
"""

from http.server import BaseHTTPRequestHandler
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

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
                    "periodEnd": r.get("period_end"),  # 프론트에서 D-day를 매일 새로 계산하기 위한 원본 날짜
                    "periodStart": r.get("period_start"),  # 캘린더에 기간 전체를 표시하기 위한 원본 날짜
                    "createdAt": r.get("created_at"),  # 팔로우 브랜드 "새 이벤트" 알림 판별용
                    "channel": r.get("channel", ""),
                    "conditions": r.get("conditions", ""),
                    "targetAudience": r.get("target_audience", ""),
                    "desc": r.get("desc", ""),
                    "tags": r.get("tags", []),
                    "image": r.get("image", ""),
                    "domain": r.get("domain", ""),
                    "link": r.get("link", ""),
                    "views": stats.get("views", 0),
                    "likes": stats.get("likes", 0),
                })

            self._send_json(200, events)

        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=60")  # 1분 캐시로 과도한 DB 조회 방지
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)