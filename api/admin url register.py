"""
POST /api/admin_url_register
body: { key, url, category }

관리자가 브랜드 이벤트 페이지 URL을 붙여넣으면, 해당 페이지의 OpenGraph 메타태그
(og:title, og:description, og:image)를 자동으로 추출해서 event_candidates 테이블에
'pending' 상태로 저장합니다. (기존 admin.html 승인 화면에서 그대로 검토/승인 가능)

⚠️ 자동 추출은 참고용입니다 — 실제 할인율/기간/브랜드명은 반드시 관리자가
   승인 화면에서 직접 확인하고 필요시 수정해야 합니다 (환각/오탐 방지).
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sys
import urllib.request
import urllib.error
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_insert


def check_admin_key(provided_key):
    real_key = os.environ.get("ADMIN_SECRET", "")
    return bool(real_key) and provided_key == real_key


def extract_meta(html, prop):
    """<meta property="og:xxx" content="..."> 또는 name="xxx" 형태 모두 대응."""
    patterns = [
        rf'<meta[^>]+property=["\']{prop}["\'][^>]+content=["\']([^"\']*)["\']',
        rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+property=["\']{prop}["\']',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.IGNORECASE)
        if m:
            return m.group(1).strip()
    return ""


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
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        if not check_admin_key(data.get("key", "")):
            self._send_json(401, {"error": "관리자 인증이 필요합니다."})
            return

        if data.get("mode") == "manual":
            self._handle_manual(data)
            return

        url = (data.get("url") or "").strip()
        category = (data.get("category") or "").strip()

        if not url.startswith("http"):
            self._send_json(400, {"error": "올바른 URL을 입력해주세요 (http:// 또는 https://로 시작)."})
            return
        if category not in ("fashion", "beauty", "food", "popup"):
            self._send_json(400, {"error": "카테고리를 선택해주세요."})
            return

        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (EventHub-Bot)"})
            with urllib.request.urlopen(req, timeout=10) as res:
                raw = res.read(500_000)  # 500KB로 제한 (과도한 다운로드 방지)
                html = raw.decode("utf-8", errors="ignore")
        except Exception as e:
            self._send_json(502, {"error": f"페이지를 불러오지 못했어요: {str(e)}"})
            return

        og_title = extract_meta(html, "og:title")
        og_desc = extract_meta(html, "og:description")
        og_image = extract_meta(html, "og:image")
        domain = urlparse(url).netloc.replace("www.", "")

        if not og_title:
            self._send_json(200, {
                "error": "이 페이지에서 제목 정보를 추출하지 못했어요. 수동으로 이벤트를 등록해주세요."
            })
            return

        candidate = {
            "category": category,
            "brand": domain.split(".")[0].capitalize(),
            "title": og_title[:100],
            "subtitle": "관리자가 URL로 직접 등록 (자동 추출된 정보이므로 승인 전 확인 필요)",
            "discount": "정보 확인 필요",
            "period": "정보 확인 필요",
            "channel": "",
            "desc": og_desc[:300] if og_desc else "",
            "tags": [],
            "image": og_image,
            "domain": domain,
            "link": url,
            "source_url": url,
            "ai_confidence_note": "관리자가 URL을 직접 등록했습니다. og:title/description/image를 자동 추출했으나, 할인 정보와 기간은 반드시 직접 확인 후 승인해주세요.",
            "status": "pending",
        }

        try:
            sb_insert("event_candidates", candidate)
        except Exception as e:
            self._send_json(500, {"error": f"저장 중 오류: {str(e)}"})
            return

        self._send_json(200, {"success": True, "extracted": {"title": og_title, "image": og_image}})

    def _handle_manual(self, data):
        """URL 스크래핑 없이, 관리자가 이미 텍스트로 알고 있는 정보를 그대로 후보로 등록.
        인스타그램 큐레이션 게시물처럼 자동 추출이 안 되는 소스에서 정보를 옮길 때 사용."""
        brand = (data.get("brand") or "").strip()
        title = (data.get("title") or "").strip()
        category = (data.get("category") or "").strip()
        discount = (data.get("discount") or "").strip()
        channel = (data.get("channel") or "").strip()
        period_start = (data.get("periodStart") or "").strip()
        period_end = (data.get("periodEnd") or "").strip()
        source_url = data.get("sourceUrl")

        if not brand or not title or not period_start or not period_end:
            self._send_json(400, {"error": "브랜드명, 제목, 시작일, 종료일은 필수예요."})
            return
        if category not in ("fashion", "beauty", "food", "popup"):
            self._send_json(400, {"error": "카테고리를 선택해주세요."})
            return

        period_label = f"{period_start.replace('-', '.')} - {period_end.replace('-', '.')}"

        candidate = {
            "category": category,
            "brand": brand,
            "title": title[:100],
            "subtitle": "관리자가 직접 수동 등록",
            "discount": discount or "정보 확인 필요",
            "period": period_label,
            "period_start": period_start,
            "period_end": period_end,
            "channel": channel,
            "desc": "",
            "tags": [],
            "image": "",
            "domain": "",
            "link": source_url or "",
            "source_url": source_url or "",
            "ai_confidence_note": "관리자가 수동으로 입력했습니다. 이미지/도메인은 승인 시 직접 채워주세요.",
            "status": "pending",
        }

        try:
            sb_insert("event_candidates", candidate)
        except Exception as e:
            self._send_json(500, {"error": f"저장 중 오류: {str(e)}"})
            return

        self._send_json(200, {"success": True, "extracted": {"title": title, "image": ""}})

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)