"""
POST /api/candidates_scan
Vercel Cron이 매주 1회 호출합니다 (vercel.json의 crons 설정 참고).

Claude의 "web_search" 도구를 사용해 카테고리별로 실제 진행 중인
할인 프로모션을 찾아 event_candidates 테이블에 'pending' 상태로 저장합니다.
⚠️ 이 결과는 절대 자동으로 사이트에 노출되지 않습니다 — 반드시 관리자가
   /admin.html 에서 출처(source_url)를 확인하고 승인해야 실제 이벤트로 등록됩니다.

────────────────────────────────────────────────────────────────
2026-07 변경: 기존엔 Gemini를 썼는데, 무료 티어 호출 한도(429)에 자주
걸려서 Claude API(web_search 도구)로 교체했습니다. 프롬프트/저장 로직/
카테고리 순회 구조는 이전과 동일하게 유지했습니다.

또한 기존엔 카테고리당 후보들을 한 번에 묶어서 sb_insert했는데, 이 방식은
묶음 안에 단 하나라도 기존 pending과 중복되는 게 있으면(브랜드+제목+시작일
동일) PostgREST가 묶음 전체를 실패시켜서, 진짜 새로운 후보까지 같이 유실되는
문제가 있었습니다. 이번에 후보를 하나씩 저장하도록 바꿔서, 중복 하나 때문에
나머지가 같이 날아가지 않게 했습니다.
────────────────────────────────────────────────────────────────
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import time
import urllib.request
import urllib.error
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_insert

CATEGORIES = ["fashion", "beauty", "food", "popup"]
CATEGORY_LABEL = {
    "fashion": "패션", "beauty": "뷰티", "food": "카페·디저트", "popup": "팝업·컬처",
}
# "living(라이프스타일)"은 일부러 뺐습니다 — 실제 웹검색 테스트를 두 차례 해보니, 이
# 카테고리는 검색해도 소비자 대상 이벤트보다 서울리빙디자인페어·홈테이블데코페어 같은
# B2B 박람회/전시회가 압도적으로 많이 잡혀서 자동 스캔 효율이 낮았습니다. 다만 이
# 카테고리 자체를 없앤 건 아니라서, admin.html에서 URL/캡션 붙여넣기나 수동 등록으로는
# 그대로 라이프스타일 이벤트를 등록할 수 있습니다 (사람이 직접 찾은 건 신뢰할 수 있으니까요).


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        # ── Cron 보호: Vercel Cron만 호출 가능하도록 시크릿 검증 ──
        cron_secret = os.environ.get("CRON_SECRET", "")
        auth_header = self.headers.get("Authorization", "")
        if cron_secret and auth_header != f"Bearer {cron_secret}":
            self._send_json(401, {"error": "인증되지 않은 요청입니다."})
            return

        ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
        if not ANTHROPIC_API_KEY:
            self._send_json(500, {"error": "ANTHROPIC_API_KEY가 설정되지 않았습니다."})
            return

        total_found = 0
        total_saved = 0
        scan_errors = []

        for category in CATEGORIES:
            try:
                candidates = self._scan_category(ANTHROPIC_API_KEY, category)
                total_found += len(candidates)
                for c in candidates:
                    try:
                        sb_insert("event_candidates", c)
                        total_saved += 1
                    except Exception as e:
                        # 대부분은 idx_candidates_no_exact_dup(중복) 위반이라 정상적인 스킵.
                        # 그 외 사유일 수도 있으니 로그는 남기되, 이 후보 하나만 건너뛰고 계속 진행.
                        print(f"[candidates_scan] 저장 스킵 ({category}/{c.get('brand')}): {e}")
            except Exception as e:
                scan_errors.append({"category": category, "error": str(e)})

        self._send_json(200, {
            "success": True,
            "candidates_found": total_found,
            "candidates_saved": total_saved,
            "errors": scan_errors,
        })

    def _scan_category(self, api_key, category):
        label = CATEGORY_LABEL[category]

        # ══════════════════════════════════════════════════════════
        # 환각 방지 핵심: web_search 도구로 실제 웹 검색 결과에 "그라운딩"시켜서,
        # AI가 검색도 안 해보고 지어내는 것을 방지합니다. 그리고 이 결과는 여기서
        # 바로 게시되지 않고, 사람이 source_url을 열어서 직접 확인 후 승인해야만
        # 실제 노출됩니다 (이중 안전장치).
        # ══════════════════════════════════════════════════════════
        prompt = f"""오늘 날짜: {datetime.now().strftime('%Y-%m-%d')}

지금 한국에서 실제로 진행 중인 "{label}" 카테고리의 브랜드 할인 프로모션을
웹 검색으로 찾아서 최대 3개까지 알려줘.

반드시 지켜야 할 것:
1. 실제로 검색해서 확인한 것만 포함해. 검색 결과가 없거나 불확실하면 그 항목은 아예 빼.
2. 각 항목에는 반드시 정보를 확인한 실제 출처 URL(source_url)을 포함해.
3. 이미 종료된 프로모션(종료일이 오늘 이전)은 포함하지 마.
4. 확신이 서지 않는 할인율/기간은 "정확한 조건은 공식 채널 확인 필요"라고 명시해.
5. "쿠폰 총정리", "할인코드 모음" 같은 제휴 마케팅/블로그성 사이트는 출처로 쓰지 마 — 스스로 "참고용 가이드"라고 밝히거나 실제 브랜드 공지가 아닌, 과거 패턴을 짜깁기한 글이 많아서 부정확해. 반드시 브랜드 공식 채널이나 신뢰할 수 있는 언론 기사를 출처로 써.
6. 일반 소비자 대상 이벤트만 포함해. 사업자/업계 관계자 대상 박람회·전시회·컨퍼런스(예: OO페어, OO엑스포, OO쇼)는 제외해.
7. 검색할 때 "쿠폰", "할인코드" 같은 단어보다는 "공식 이벤트", "기획전" 같은 단어로 찾아봐 — 전자로 검색하면 브랜드와 무관한 제휴 마케팅 블로그가 먼저 잡히고, 후자로 검색하면 브랜드 공식몰의 실제 이벤트 페이지가 더 잘 잡혀.

각 항목을 아래 형식의 JSON 한 줄씩, 총 최대 3줄로만 응답해. 다른 설명은 쓰지 마:
{{"brand": "브랜드명", "title": "프로모션 제목", "discount": "할인 내용", "conditions": "적용 조건이 있다면 (예: 네이버페이 결제 시에만 적용, 신규 가입자 한정 등, 없으면 빈 문자열)", "period_start": "YYYY-MM-DD", "period_end": "YYYY-MM-DD", "channel": "이용 방법", "desc": "상세페이지 '상세안내'란에 그대로 들어갈 내용이야. 짧게 요약하지 말고, 실제 이벤트 페이지에 나온 내용(대상 상품/서비스, 구체적 조건, 참여 방법, 특전 내용 등)을 최대한 구체적으로 옮겨 적어줘 — 문장 압축보다 정보량이 우선이야. 단, 출처 자체에 짧은 제목 정도만 있고 상세 설명이 없다면 없는 내용을 지어내지 말고 있는 그대로만 적고, 그 사실을 confidence_note에 적어줘.", "source_url": "출처 URL", "confidence_note": "확신도나 주의사항. 출처에 상세 설명이 부족했다면 '출처에 상세 정보가 적어 승인 전 브랜드 공식 채널에서 추가 확인 필요'라고 명시해줘."}}"""

        url = "https://api.anthropic.com/v1/messages"
        payload = json.dumps({
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 4096,
            "messages": [{"role": "user", "content": prompt}],
            "tools": [{"type": "web_search_20250305", "name": "web_search"}],
        }).encode("utf-8")

        req_headers = {
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        }

        # 일시적 오류(429 요청과다, 529 서버과부하 등)는 짧게 대기 후 최대 2번까지 재시도.
        # 그래도 계속 실패하면 마지막 예외를 그대로 던져서, 상위(do_POST)에서
        # 해당 카테고리만 스킵 처리하고 나머지 카테고리는 계속 진행하게 한다.
        max_attempts = 3
        last_error = None
        result = None
        for attempt in range(max_attempts):
            try:
                req = urllib.request.Request(url, data=payload, headers=req_headers)
                with urllib.request.urlopen(req, timeout=45) as res:
                    result = json.loads(res.read())
                break
            except urllib.error.HTTPError as e:
                last_error = e
                if e.code in (429, 529, 503) and attempt < max_attempts - 1:
                    time.sleep(2 * (attempt + 1))  # 2초, 4초로 점점 늘려가며 대기
                    continue
                raise
            except Exception as e:
                last_error = e
                if attempt < max_attempts - 1:
                    time.sleep(2 * (attempt + 1))
                    continue
                raise

        if result is None:
            raise last_error or RuntimeError("알 수 없는 이유로 응답을 받지 못했습니다.")


        # Claude의 web_search 응답은 여러 종류의 블록(server_tool_use, web_search_tool_result, text)이
        # 섞여서 옵니다. 우리가 파싱할 최종 답변은 text 블록에만 들어있습니다.
        blocks = result.get("content", [])
        raw_text = "\n".join(b.get("text", "") for b in blocks if b.get("type") == "text")

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
                "source_type": "ai_scan",
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