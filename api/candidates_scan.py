"""
POST /api/candidates_scan
Vercel Cron이 매주 1회 호출합니다 (vercel.json의 crons 설정 참고).

Gemini의 "Google Search 그라운딩" 기능을 사용해 카테고리별로 실제 진행 중인
할인 프로모션을 찾아 event_candidates 테이블에 'pending' 상태로 저장합니다.
⚠️ 이 결과는 절대 자동으로 사이트에 노출되지 않습니다 — 반드시 관리자가
   /admin.html 에서 출처(source_url)를 확인하고 승인해야 실제 이벤트로 등록됩니다.
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sys
import urllib.request
import urllib.error

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_insert

CATEGORIES = ["fashion", "beauty", "food", "tech", "delivery", "stay", "living", "popup"]
CATEGORY_LABEL = {
    "fashion": "패션", "beauty": "뷰티", "food": "푸드/외식", "tech": "전자기기",
    "delivery": "배달", "stay": "숙박", "living": "리빙/인테리어", "popup": "팝업스토어",
}


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        # ── Cron 보호: Vercel Cron만 호출 가능하도록 시크릿 검증 ──
        cron_secret = os.environ.get("CRON_SECRET", "")
        auth_header = self.headers.get("Authorization", "")
        if cron_secret and auth_header != f"Bearer {cron_secret}":
            self._send_json(401, {"error": "인증되지 않은 요청입니다."})
            return

        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
        if not GEMINI_API_KEY:
            self._send_json(500, {"error": "API 키가 설정되지 않았습니다."})
            return

        total_found = 0
        scan_errors = []

        for category in CATEGORIES:
            try:
                candidates = self._scan_category(GEMINI_API_KEY, category)
                if candidates:
                    sb_insert("event_candidates", candidates)
                    total_found += len(candidates)
            except Exception as e:
                scan_errors.append({"category": category, "error": str(e)})

        self._send_json(200, {
            "success": True,
            "candidates_found": total_found,
            "errors": scan_errors,
        })

    def _scan_category(self, api_key, category):
        label = CATEGORY_LABEL[category]

        # ══════════════════════════════════════════════════════════
        # 환각 방지 핵심: google_search 도구로 실제 웹 검색 결과에
        # "그라운딩"시켜서, AI가 검색도 안 해보고 지어내는 것을 방지합니다.
        # 그리고 이 결과는 여기서 바로 게시되지 않고, 사람이 source_url을
        # 열어서 직접 확인 후 승인해야만 실제 노출됩니다 (이중 안전장치).
        # ══════════════════════════════════════════════════════════
        prompt = f"""지금 한국에서 실제로 진행 중인 "{label}" 카테고리의 브랜드 할인 프로모션을
웹 검색으로 찾아서 최대 3개까지 알려줘.

반드시 지켜야 할 것:
1. 실제로 검색해서 확인한 것만 포함해. 검색 결과가 없거나 불확실하면 그 항목은 아예 빼.
2. 각 항목에는 반드시 정보를 확인한 실제 출처 URL(source_url)을 포함해.
3. 이미 종료된 프로모션(종료일이 오늘 이전)은 포함하지 마.
4. 확신이 서지 않는 할인율/기간은 "정확한 조건은 공식 채널 확인 필요"라고 명시해.

각 항목을 아래 형식의 JSON 한 줄씩, 총 최대 3줄로만 응답해. 다른 설명은 쓰지 마:
{{"brand": "브랜드명", "title": "프로모션 제목", "discount": "할인 내용", "conditions": "적용 조건이 있다면 (예: 네이버페이 결제 시에만 적용, 신규 가입자 한정 등, 없으면 빈 문자열)", "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD", "channel": "이용 방법", "desc": "2문장 이내 설명", "source_url": "출처 URL", "confidence_note": "확신도나 주의사항"}}"""

        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={api_key}"
        )
        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "tools": [{"google_search": {}}],
            "generationConfig": {"temperature": 0.2},
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        with urllib.request.urlopen(req, timeout=30) as res:
            result = json.loads(res.read())
            raw_text = result["candidates"][0]["content"]["parts"][0]["text"]

        candidates = []
        for line in raw_text.strip().splitlines():
            line = line.strip().strip("`")
            if not line.startswith("{"):
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue

            if not item.get("source_url") or not item.get("brand"):
                continue  # 출처 없는 항목은 신뢰할 수 없으므로 폐기

            candidates.append({
                "category": category,
                "brand": item.get("brand", ""),
                "title": item.get("title", ""),
                "subtitle": item.get("confidence_note", ""),
                "discount": item.get("discount", ""),
                "conditions": item.get("conditions", ""),
                "period_start": item.get("period_start"),
                "period_end": item.get("period_end"),
                "period": f"{item.get('period_start', '')} - {item.get('period_end', '')}",
                "channel": item.get("channel", ""),
                "desc": item.get("desc", ""),
                "tags": [label],
                "source_url": item.get("source_url"),
                "ai_confidence_note": item.get("confidence_note", ""),
                "status": "pending",
            })

        return candidates

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)