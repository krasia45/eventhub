"""
POST /api/cron_jobs?job=candidates_scan
     Vercel Cron이 매주 1회 호출 (vercel.json 참고). Claude의 web_search로
     카테고리별 실제 진행 중인 프로모션을 찾아 event_candidates에 저장.

POST /api/cron_jobs?job=check_broken_links
     Vercel Cron이 매일 1회 호출. 모든 활성 이벤트의 link에 HEAD 요청을 보내
     연속 실패 시 자동 비활성화.

(원래 candidates_scan.py / check_broken_links.py로 분리돼 있었는데, 둘 다
 "Cron이 호출하는 POST 전용" 함수라 Vercel Hobby 플랜 함수 개수 제한 때문에
 한 파일로 합쳤습니다. vercel.json의 crons 설정에서 ?job= 쿼리로 어느 작업인지
 구분해서 지정합니다.)
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import time
import smtplib
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs
from email.mime.text import MIMEText
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select, sb_update, sb_insert

FAIL_THRESHOLD = 2  # 링크 점검: 이 횟수만큼 연속 실패해야 비활성화

CANDIDATE_CATEGORIES = ["fashion", "beauty", "food", "popup", "convenience"]
CANDIDATE_CATEGORY_LABEL = {
    "fashion": "패션", "beauty": "뷰티", "food": "카페·디저트", "popup": "팝업·컬처",
    "convenience": "편의점",
}
# "living(라이프스타일)"은 실제 이벤트 조사 결과 타깃(10-20대 여성) 이벤트 유형과 안 맞아서
# 카테고리 자체를 없앴습니다(프론트 CATEGORIES에서도 제거됨).
# "convenience(편의점)"는 GS25·CU·세븐일레븐 등 1+1·2+1 행사가 실제로 확인되어 새로 추가했습니다.


class handler(BaseHTTPRequestHandler):

    def do_GET(self):
        # ⚠️ Vercel 공식 문서(vercel.com/docs/cron-jobs): "Vercel makes an HTTP GET
        # request"라고 명시돼 있다 — 즉 Cron이 실제로 호출하는 방식은 GET인데, 이 핸들러가
        # do_POST만 갖고 있어서 GET 요청이 오면 Python이 자동으로 501(지원 안 하는 메서드)로
        # 거부하고 있었다. 이게 "승인 대기 후보가 계속 0개"였던 근본 원인 — 매일 새벽 3시마다
        # Vercel이 호출을 시도했어도 요청 자체가 처리되지 못하고 있었던 것.
        self.do_POST()

    def do_POST(self):
        # 인증 방식 두 가지를 모두 허용한다:
        # 1) Vercel이 매일 새벽 자동 실행할 때 보내는 CRON_SECRET (Authorization 헤더)
        # 2) 관리자가 admin.html에서 "지금 바로 실행" 버튼을 눌렀을 때 보내는 ADMIN_SECRET
        #    (다른 admin API들과 동일하게 ?key= 쿼리파라미터) — 둘 중 하나만 맞으면 통과.
        query = parse_qs(urlparse(self.path).query)
        cron_secret = os.environ.get("CRON_SECRET", "")
        auth_header = self.headers.get("Authorization", "")
        is_cron_auth = (not cron_secret) or (auth_header == f"Bearer {cron_secret}")

        admin_secret = os.environ.get("ADMIN_SECRET", "")
        provided_key = query.get("key", [""])[0]
        is_admin_auth = bool(admin_secret) and provided_key == admin_secret

        if not is_cron_auth and not is_admin_auth:
            self._send_json(401, {"error": "인증되지 않은 요청입니다."})
            return

        job = query.get("job", [""])[0]

        if job == "candidates_scan":
            self._run_candidates_scan()
        elif job == "check_broken_links":
            self._run_check_broken_links()
        else:
            self._send_json(400, {"error": "?job=candidates_scan 또는 ?job=check_broken_links 가 필요합니다."})

    # ══════════════════════════════════════════════════════════════
    # job = candidates_scan (기존 candidates_scan.py)
    # ══════════════════════════════════════════════════════════════
    def _run_candidates_scan(self):
        anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
        if not anthropic_key:
            self._send_json(500, {"error": "ANTHROPIC_API_KEY가 설정되지 않았습니다."})
            return

        # ⚠️ 카테고리 5개를 한 요청 안에서 전부 순차로 돌리면(웹검색이라 카테고리당
        # 15~20초 이상 걸릴 수 있음), Vercel 함수 제한(maxDuration 60초)을 넘겨서
        # 강제종료되고 그 결과 JSON이 아닌 Vercel 자체 에러페이지가 응답으로 와서
        # 프론트의 res.json()이 깨지는 문제가 있었다("가끔씩 되긴 하는데" 증상과 일치).
        # ?category=하나만 지정하면 그 카테고리만 처리해서 훨씬 빠르게 끝난다 — 관리자가
        # "지금 바로 실행" 버튼을 누를 때는 카테고리별로 나눠서 여러 번 호출하는 방식으로
        # 이 타임아웃을 원천적으로 피한다(admin.html 쪽 수정과 세트).
        query = parse_qs(urlparse(self.path).query)
        only_category = query.get("category", [""])[0]
        categories_to_scan = [only_category] if only_category in CANDIDATE_CATEGORIES else CANDIDATE_CATEGORIES

        total_found = 0
        total_saved = 0
        scan_errors = []

        for category in categories_to_scan:
            try:
                candidates = self._scan_category(anthropic_key, category)
                total_found += len(candidates)
                for c in candidates:
                    try:
                        sb_insert("event_candidates", c)
                        total_saved += 1
                    except Exception as e:
                        print(f"[candidates_scan] 저장 스킵 ({category}/{c.get('brand')}): {e}")
            except Exception as e:
                scan_errors.append({"category": category, "error": str(e)})

        self._send_json(200, {
            "success": True,
            "categories_scanned": categories_to_scan,
            "candidates_found": total_found,
            "candidates_saved": total_saved,
            "errors": scan_errors,
        })

    def _scan_category(self, api_key, category):
        label = CANDIDATE_CATEGORY_LABEL[category]

        prompt = f"""오늘 날짜: {datetime.now().strftime('%Y-%m-%d')}

지금 한국에서 실제로 진행 중인 "{label}" 카테고리의 브랜드 할인 프로모션을
웹 검색으로 찾아서 최대 3개까지 알려줘.

반드시 지켜야 할 것:
1. 실제로 검색해서 확인한 것만 포함해. 검색 결과가 없거나 불확실하면 그 항목은 아예 빼.
2. 각 항목에는 반드시 정보를 확인한 실제 출처 URL(source_url)을 포함해.
3. 이미 종료된 프로모션(종료일이 오늘 이전)은 포함하지 마.
3-1. ⚠️ 정보 출처가 오래된 게 아닌지 확인하는 방법은 출처 종류에 따라 다르게 판단해:
   - 브랜드 공식 홈페이지/공식 인스타그램/공식 앱처럼 "지금 진행 중인 이벤트"를 보여주는 라이브
     페이지는 원래 작성일·게시일이라는 게 따로 없는 경우가 많아 — 이런 페이지는 게시일을 못
     찾았다고 제외하지 말고, 페이지에 나온 period_end(종료일)가 오늘 이후인지만 확인하면 충분해.
   - 반면 뉴스 기사·블로그 글처럼 "특정 시점에 작성된 글"이 출처라면, 그 글의 작성일·게시일을
     반드시 확인해. 오늘({datetime.now().strftime('%Y-%m-%d')}) 기준 최근 것(최대한 1~2개월
     이내, 아무리 길어도 6개월 이상 지난 글은 절대 포함하지 마)이 아니면 무조건 제외해.
     "2014년", "2019년" 처럼 몇 년 전 기사에서 찾은 정보를, 종료일을 못 찾았다는 이유로
     "아직 진행 중"이라고 추측해서 넣는 게 가장 흔한 실수야 — 확신이 안 서면 넣지 말고 빼.
4. 확신이 서지 않는 할인율/기간은 "정확한 조건은 공식 채널 확인 필요"라고 명시해.
5. ⚠️ 브랜드 공식 홈페이지·공식 인스타그램·공식 앱 공지사항을 먼저 찾아봐. 거기서 할인율/기간
   같은 구체적인 정보를 실제로 확인할 수 있으면 그걸 출처로 써. 하지만 요즘 브랜드 사이트는
   자동화된 접근을 막아두거나(로봇 차단), 자바스크립트로 나중에 내용이 채워지는 구조가 많아서
   공식 채널을 찾아도 "이벤트 목록 페이지입니다" 같은 일반 설명만 보이고 구체적인 내용은 못 볼
   때가 실제로 자주 있어. 그럴 땐 주저하지 말고 신뢰할 수 있는 언론사의 최신 기사를 정상적인
   출처로 써 — 이건 부끄러운 차선책이 아니라 실무적으로 흔히 쓰는 정상 경로야. 다만 "쿠폰
   총정리", "할인코드 모음" 같은 제휴 마케팅/블로그성 사이트는 여전히 절대 출처로 쓰지 마.
6. 일반 소비자 대상 이벤트만 포함해. 사업자/업계 관계자 대상 박람회·전시회·컨퍼런스(예: OO페어, OO엑스포, OO쇼)는 제외해.
7. 검색 순서: 먼저 "{label} 브랜드 공식 홈페이지 이벤트", "{label} 브랜드 공식 인스타그램" 처럼
   브랜드 자체 채널을 겨냥해서 찾아봐. 그걸로 안 잡히면 그 다음에 "공식 이벤트", "기획전" 같은
   단어로 넓게 찾아봐. "쿠폰", "할인코드" 같은 단어는 쓰지 마 — 브랜드와 무관한 제휴 마케팅
   블로그가 먼저 잡혀서 부정확해.

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
                    time.sleep(2 * (attempt + 1))
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
                continue

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
                "channel": item.get("channel") or "",
                "desc": item.get("desc", ""),
                "tags": [label],
                "source_url": item.get("source_url"),
                "source_type": "ai_scan",
                "ai_confidence_note": item.get("confidence_note", ""),
                "status": "pending",
            })

        return candidates

    # ══════════════════════════════════════════════════════════════
    # job = check_broken_links (기존 check_broken_links.py)
    # ══════════════════════════════════════════════════════════════
    def _run_check_broken_links(self):
        try:
            events = sb_select("events", {
                "select": "id,category,brand,title,link,link_fail_count",
                "is_active": "eq.true",
            })
        except Exception as e:
            self._send_json(500, {"error": str(e)})
            return

        deactivated = []
        warned = []

        for ev in events:
            link = ev.get("link")
            if not link:
                continue

            ok = self._check_link(link)

            if ok:
                if ev.get("link_fail_count", 0) != 0:
                    try:
                        sb_update("events", {"id": f"eq.{ev['id']}"}, {
                            "link_fail_count": 0,
                            "link_last_checked": "now()",
                        })
                    except Exception as e:
                        print(f"이벤트 {ev['id']} 리셋 실패:", str(e))
                else:
                    try:
                        sb_update("events", {"id": f"eq.{ev['id']}"}, {"link_last_checked": "now()"})
                    except Exception as e:
                        print(f"이벤트 {ev['id']} link_last_checked 갱신 실패:", str(e))
                continue

            new_fail_count = (ev.get("link_fail_count") or 0) + 1
            patch = {"link_fail_count": new_fail_count, "link_last_checked": "now()"}

            if new_fail_count >= FAIL_THRESHOLD:
                patch["is_active"] = False
                deactivated.append(ev)
            else:
                warned.append(ev)

            try:
                sb_update("events", {"id": f"eq.{ev['id']}"}, patch)
            except Exception as e:
                print(f"이벤트 {ev['id']} 갱신 실패:", str(e))

        self._send_broken_links_email(deactivated, warned)

        self._send_json(200, {
            "success": True,
            "checked": len(events),
            "deactivated": len(deactivated),
            "warned": len(warned),
        })

    def _check_link(self, url, timeout=6):
        for method in ("HEAD", "GET"):
            try:
                req = urllib.request.Request(url, method=method, headers={"User-Agent": "Mozilla/5.0 (EventHub-LinkChecker)"})
                with urllib.request.urlopen(req, timeout=timeout) as res:
                    if res.status < 400:
                        return True
            except urllib.error.HTTPError as e:
                if e.code < 400:
                    return True
                continue
            except Exception:
                continue
        return False

    def _send_broken_links_email(self, deactivated, warned):
        gmail_user = os.environ.get("GMAIL_USER", "")
        gmail_app_password = os.environ.get("GMAIL_APP_PASSWORD", "")
        notify_to = os.environ.get("NOTIFY_EMAIL", gmail_user)

        if not gmail_user or not gmail_app_password or not (deactivated or warned):
            return

        parts = []
        if deactivated:
            lines = [f"- [{ev['category']}] {ev['brand']} · {ev['title']} ({ev['link']})" for ev in deactivated]
            parts.append(f"🚫 자동 비활성화됨 ({len(deactivated)}건, 연속 {FAIL_THRESHOLD}회 실패):\n" + "\n".join(lines))
        if warned:
            lines = [f"- [{ev['category']}] {ev['brand']} · {ev['title']} ({ev['link']})" for ev in warned]
            parts.append(f"⚠️ 이번에 실패했지만 아직 비활성화는 안 됨 (내일도 실패하면 비활성화됨, {len(warned)}건):\n" + "\n".join(lines))

        body_text = "\n\n".join(parts) + "\n\nSupabase Table Editor에서 확인 후, 필요하면 is_active를 다시 true로 바꿔주세요."
        msg = MIMEText(body_text)
        msg["Subject"] = f"[EventHub] 링크 점검 결과 — 비활성화 {len(deactivated)}건 / 경고 {len(warned)}건"
        msg["From"] = gmail_user
        msg["To"] = notify_to

        try:
            with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=8) as server:
                server.login(gmail_user, gmail_app_password)
                server.sendmail(gmail_user, [notify_to], msg.as_string())
        except Exception as e:
            print("링크 점검 알림 메일 발송 실패:", str(e))

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)