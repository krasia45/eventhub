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
import time
import urllib.request
import urllib.error
from urllib.parse import urlparse
from datetime import datetime

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

        if data.get("mode") == "parse_caption":
            self._handle_parse_caption(data)
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
            "source_type": "url_auto",
            "ai_confidence_note": "관리자가 URL을 직접 등록했습니다. og:title/description/image를 자동 추출했으나, 할인 정보와 기간은 반드시 직접 확인 후 승인해주세요.",
            "status": "pending",
        }

        try:
            sb_insert("event_candidates", candidate)
        except Exception as e:
            self._send_json(500, {"error": f"저장 중 오류: {str(e)}"})
            return

        self._send_json(200, {"success": True, "extracted": {"title": og_title, "image": og_image}})

    def _handle_parse_caption(self, data):
        """인스타그램 캡션처럼 사람이 읽는 텍스트를 관리자가 그대로 붙여넣으면,
        Gemini가 브랜드/제목/카테고리/혜택/기간/참여방법을 추출해서 관리자 수동등록
        폼에 미리 채워준다. DB에는 저장하지 않고 값만 반환 — 최종 저장은 관리자가
        내용을 확인하고 '추가하기'를 눌러야만 이뤄진다 (환각/오탐 방지 원칙 유지)."""
        caption = (data.get("caption") or "").strip()
        if not caption:
            self._send_json(400, {"error": "붙여넣을 캡션 내용이 없어요."})
            return
        if len(caption) > 3000:
            caption = caption[:3000]

        api_key = os.environ.get("GEMINI_API_KEY", "")
        if not api_key:
            self._send_json(500, {"error": "AI 파싱 기능을 쓰려면 GEMINI_API_KEY 설정이 필요해요."})
            return

        today = datetime.now().strftime("%Y-%m-%d")
        prompt = f"""아래는 인스타그램 등에서 그대로 복사해온 이벤트/팝업스토어 홍보 캡션입니다.
이 텍스트에서 실제로 명시된 정보만 뽑아서 JSON으로 정리해주세요. 지어내지 마세요.

오늘 날짜: {today} (연도가 캡션에 안 써있으면 이 날짜를 기준으로 가장 가까운 미래로 추정)

[캡션 원문]
{caption}

먼저 이 이벤트가 아래 중 어떤 성격에 가장 가까운지 판단하고, 그에 맞게 discount/channel을 채워주세요
(이 판단 결과 자체를 출력하는 건 아니고, 아래 필드를 더 적절하게 채우기 위한 내부 기준입니다):
- 할인: 정가 대비 할인율/금액
- 쿠폰: 발급되는 쿠폰의 금액·조건
- 팝업/체험: 방문해서 체험하는 것 (체험 내용을 discount에)
- 미션: 특정 행동을 완료하면 받는 보상
- 응모: 응모 후 추첨으로 받는 경품
- 대형 프로모션: 혜택이 여러 개면 "혜택A + 혜택B" 형식으로 +로 이어서 (상세페이지에서 자동으로 칩이 나뉘어 보여짐)

규칙:
- brand: 브랜드/매장명. 협업이면 "A X B" 형식으로.
- title: 이벤트/팝업 제목이나 한 줄 소개.
- category: 다음 중 하나만 — fashion, beauty, food, popup (애매하면 popup)
- discount: 위 유형 판단에 맞는 혜택 요약 (없으면 빈 문자열)
- period_start, period_end: YYYY-MM-DD 형식. 캡션에 기간이 명시 안 되어 있으면 둘 다 null.
- channel: 운영시간/장소/참여방법 등 (캡션에 있는 만큼만, 없으면 빈 문자열).
  ⚠️ 성격이 다른 정보(시간, 장소, 참여조건 등)가 두 가지 이상이면 반드시 줄바꿈(\\n)으로 구분해서 각각 한 줄씩 쓰세요.
  한 줄에 이어붙이지 마세요 (예: "11:00-21:00\\n서울 성동구 연무장길 101\\n1인 1개 한정" ← 이렇게, "11:00-21:00, 서울 성동구..." ← 이렇게 하지 말 것)
- confidence_note: 애매하게 추정한 부분이 있으면 한 문장으로 명시, 없으면 빈 문자열

다른 설명 없이 JSON만 응답하세요."""

        schema = {
            "type": "OBJECT",
            "properties": {
                "brand": {"type": "STRING"},
                "title": {"type": "STRING"},
                "category": {"type": "STRING", "enum": ["fashion", "beauty", "food", "popup"]},
                "discount": {"type": "STRING"},
                "period_start": {"type": "STRING", "nullable": True},
                "period_end": {"type": "STRING", "nullable": True},
                "channel": {"type": "STRING"},
                "confidence_note": {"type": "STRING"},
            },
            "required": ["brand", "title", "category", "discount", "channel", "confidence_note"],
        }

        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        }).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        parsed = None
        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=20) as res:
                    result = json.loads(res.read())
                    raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
                    parsed = json.loads(raw_text)
                break
            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 0:
                    time.sleep(1.5)
                    continue
                self._send_json(502, {"error": f"AI 파싱 요청 실패 (HTTP {e.code}). 잠시 후 다시 시도하거나 직접 입력해주세요."})
                return
            except Exception as e:
                self._send_json(500, {"error": f"AI 파싱 중 오류: {str(e)}. 직접 입력해주세요."})
                return

        self._send_json(200, {"success": True, "parsed": parsed})

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
            "source_type": "manual",
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