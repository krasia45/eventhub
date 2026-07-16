from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select


MAX_DAYS = 5  # 과도한 API 호출/비용 방지를 위한 상한


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        errors = []

        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            region = (data.get("region") or "").strip()
            start_date = (data.get("start_date") or "").strip()
            end_date = (data.get("end_date") or "").strip()
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        # ── 입력 검증 ─────────────────────────────────────
        if not region:
            self._send_json(400, {"error": "여행하실 지역을 입력해 주세요."})
            return
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", start_date) or not re.match(r"^\d{4}-\d{2}-\d{2}$", end_date):
            self._send_json(400, {"error": "날짜는 YYYY-MM-DD 형식으로 입력해 주세요."})
            return

        try:
            d1 = datetime.strptime(start_date, "%Y-%m-%d")
            d2 = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            self._send_json(400, {"error": "유효하지 않은 날짜입니다."})
            return

        num_days = (d2 - d1).days + 1
        if num_days < 1:
            self._send_json(400, {"error": "종료 날짜가 시작 날짜보다 빠를 수 없어요."})
            return
        if num_days > MAX_DAYS:
            self._send_json(400, {"error": f"한 번에 최대 {MAX_DAYS}일까지 계획할 수 있어요. 기간을 줄여서 다시 시도해주세요."})
            return

        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
        if not GEMINI_API_KEY:
            self._send_json(500, {"error": "API 키가 설정되지 않았습니다."})
            return

        date_list = [(d1 + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(num_days)]

        # ── 1. AI: 명소/행사/동선 팁만 담당 (사실 검증이 어려운 "설명형" 정보) ──
        ai_plan = self._call_gemini(GEMINI_API_KEY, region, date_list, errors)

        # ── 2. 네이버 실시간 검색: 맛집/숙박은 AI가 아닌 실제 검색 결과만 사용 (환각 방지 핵심) ──
        restaurants = self._search_naver(region, "맛집", 6, errors, "Restaurant Search")
        lodgings = self._search_naver(region, "숙박", 3, errors, "Lodging Search")

        if not restaurants:
            errors.append({"step": "Restaurant Search", "type": "Fallback Triggered",
                            "message": "실시간 맛집 검색 결과가 없어 AI 백업 데이터로 대체합니다."})
            restaurants = ai_plan.get("fallback_restaurants", [])
        if not lodgings:
            errors.append({"step": "Lodging Search", "type": "Fallback Triggered",
                            "message": "실시간 숙박 검색 결과가 없어 AI 백업 데이터로 대체합니다."})
            lodgings = ai_plan.get("fallback_lodgings", [])

        # ── 3. EventHub에 등록된 숙박앱 특가(야놀자/여기어때/Agoda 등, category=stay) ──
        # 네이버 검색 결과(실제 지역 숙소 장소)와는 성격이 달라 섞지 않고 별도 필드로 분리해서 제공.
        # "평점" 데이터는 네이버 지역검색/EventHub 어느 쪽에도 없어서 정렬 기준으로 쓸 수 없고,
        # 대신 실제로 값을 가진 할인율(discount) 기준으로 정렬한다.
        stay_deals = self._get_stay_deals(errors)

        # 맛집을 날짜별 점심/저녁 슬롯에 순환 배분 (AI가 아닌 실제 검색 결과 기반)
        days_result = []
        ai_days = ai_plan.get("days", [])
        for i, date in enumerate(date_list):
            ai_day = ai_days[i] if i < len(ai_days) else {}
            lunch = restaurants[(i * 2) % len(restaurants)] if restaurants else None
            dinner = restaurants[(i * 2 + 1) % len(restaurants)] if restaurants else None

            days_result.append({
                "day_number": i + 1,
                "date": date,
                "morning": ai_day.get("morning", {"name": "데이터 없음", "description": ""}),
                "lunch": lunch,
                "afternoon": ai_day.get("afternoon", {"name": "데이터 없음", "description": ""}),
                "dinner": dinner,
                "evening": ai_day.get("evening", {"name": "데이터 없음", "description": ""}),
                "route_tip": ai_day.get("route_tip", ""),
            })

        result = {
            "destination": region,
            "start_date": start_date,
            "end_date": end_date,
            "num_days": num_days,
            "days": days_result,
            "lodgings": lodgings[:3],
            "stay_deals": stay_deals[:5],
            "errors": errors,
        }

        self._send_json(200, result)

    # ------------------------------------------------------------------
    def _get_stay_deals(self, errors):
        """EventHub에 등록된 숙박앱/숙박 브랜드 이벤트(category=stay)를 할인율 기준 내림차순으로 반환."""
        try:
            rows = sb_select("events", {
                "select": "id,brand,title,discount,link,domain,merchant_type",
                "category": "eq.stay",
                "is_active": "eq.true",
            })
        except Exception as e:
            errors.append({
                "step": "Stay Deals (EventHub)",
                "type": "Query Error",
                "message": f"등록된 숙박 이벤트를 불러오지 못했습니다: {e}",
            })
            return []

        def discount_percent(discount_text):
            m = re.search(r"(\d+)\s*%", discount_text or "")
            return int(m.group(1)) if m else 0

        deals = [{
            "id": r["id"],
            "brand": r["brand"],
            "title": r["title"],
            "discount": r.get("discount", ""),
            "link": r.get("link") or r.get("domain", ""),
            "merchantType": r.get("merchant_type", "브랜드"),
        } for r in rows]

        deals.sort(key=lambda d: discount_percent(d["discount"]), reverse=True)
        return deals

    # ------------------------------------------------------------------
    def _call_gemini(self, api_key, region, date_list, errors):
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={api_key}"
        )

        # ══════════════════════════════════════════════════════════════
        # 환각 방지 프롬프트 설계 핵심 원칙:
        # 1) AI에게 "사실(상호명·주소·전화번호)"을 절대 만들지 말라고 명시적으로 금지
        # 2) 확신 없는 정보(축제 정확한 날짜 등)는 지어내지 말고 일반적인 정보로 대체하도록 지시
        # 3) 응답 스키마를 엄격히 강제해서 자유 서술로 인한 사실 왜곡 가능성을 줄임
        # 4) 맛집/숙박의 실제 상호명은 이 함수가 아닌 네이버 검색 API가 담당 (AI는 관여하지 않음)
        # ══════════════════════════════════════════════════════════════
        prompt = f"""당신은 한국 국내 여행 일정을 설계하는 여행 플래너입니다.

[중요한 제약사항 — 반드시 지켜야 함]
1. 당신은 "명소/행사 이름과 설명", "이동 동선 팁"만 제공합니다. 맛집이나 숙박 시설의 실제 상호명은 절대 만들어내지 마세요 (그건 별도 시스템이 실시간 검색으로 채웁니다).
2. 특정 축제나 행사를 추천할 때, 정확한 개최 날짜나 장소를 확신할 수 없다면 "그 시기에 열릴 가능성이 있는 행사"라고 애매하게 표현하지 말고, 대신 계절/지역 특성에 맞는 "일반적으로 안정적인 명소"(공원, 해변, 전통시장, 박물관 등 상시 운영 장소)를 추천하세요.
3. 존재를 확신할 수 없는 장소, 사라졌을 수도 있는 업체, 불확실한 통계 수치는 절대 언급하지 마세요.
4. 모르는 것은 "정보 없음"으로 남기세요. 그럴듯하게 지어내는 것보다 정직하게 비어있는 것이 훨씬 낫습니다.

[요청 내용]
지역: "{region}"
여행 날짜: {', '.join(date_list)} (총 {len(date_list)}일)

각 날짜별로 오전/오후/저녁 활동을 1개씩 추천하고, 하루 동선에 대한 이동 팁을 작성해주세요.
오전/오후/저녁 항목은 "명소" 또는 "행사/축제" 중 하나이며, activity_type 필드로 구분합니다.

또한 네이버 검색 API가 실패할 경우를 대비한 폴백용 맛집 3곳, 숙박 3곳 후보도 함께 제공하되,
반드시 실제로 존재를 확신하는 곳만 포함하고, 확신이 없으면 목록을 비워두세요.

다른 설명 문장 없이 아래 JSON 스키마에 맞춰서만 응답하세요."""

        schema = {
            "type": "OBJECT",
            "properties": {
                "days": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "morning": {
                                "type": "OBJECT",
                                "properties": {
                                    "activity_type": {"type": "STRING", "enum": ["명소", "행사"]},
                                    "name": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                },
                                "required": ["activity_type", "name", "description"],
                            },
                            "afternoon": {
                                "type": "OBJECT",
                                "properties": {
                                    "activity_type": {"type": "STRING", "enum": ["명소", "행사"]},
                                    "name": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                },
                                "required": ["activity_type", "name", "description"],
                            },
                            "evening": {
                                "type": "OBJECT",
                                "properties": {
                                    "activity_type": {"type": "STRING", "enum": ["명소", "행사"]},
                                    "name": {"type": "STRING"},
                                    "description": {"type": "STRING"},
                                },
                                "required": ["activity_type", "name", "description"],
                            },
                            "route_tip": {"type": "STRING"},
                        },
                        "required": ["morning", "afternoon", "evening", "route_tip"],
                    },
                },
                "fallback_restaurants": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "category": {"type": "STRING"},
                            "address": {"type": "STRING"},
                        },
                        "required": ["name", "category", "address"],
                    },
                },
                "fallback_lodgings": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "name": {"type": "STRING"},
                            "category": {"type": "STRING"},
                            "address": {"type": "STRING"},
                        },
                        "required": ["name", "category", "address"],
                    },
                },
            },
            "required": ["days", "fallback_restaurants", "fallback_lodgings"],
        }

        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,  # 낮은 temperature로 창작보다 안정적인 응답 유도
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        # 429(요청 한도 초과)는 순간적인 트래픽 몰림으로 발생하는 경우가 많아
        # 짧게 대기했다가 한 번만 재시도한다. 그래도 실패하면 안전한 기본값으로 폴백.
        for attempt in range(2):
            try:
                with urllib.request.urlopen(req, timeout=25) as res:
                    result = json.loads(res.read())
                    raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(raw_text)

            except urllib.error.HTTPError as e:
                if e.code == 429 and attempt == 0:
                    time.sleep(1.5)
                    continue
                errors.append({"step": "LLM Generation", "type": "API Connection Error", "message": f"Gemini 요청 실패 (HTTP {e.code})"})
                break
            except json.JSONDecodeError:
                errors.append({"step": "LLM Generation", "type": "Parsing Error", "message": "AI 응답을 JSON으로 해석하지 못했습니다."})
                break
            except Exception as e:
                errors.append({"step": "LLM Generation", "type": "Unknown Error", "message": str(e)})
                break

        return {"days": [], "fallback_restaurants": [], "fallback_lodgings": []}

    # ------------------------------------------------------------------
    def _search_naver(self, region, keyword, display, errors, step_name):
        naver_id = os.environ.get("NAVER_CLIENT_ID", "")
        naver_secret = os.environ.get("NAVER_CLIENT_SECRET", "")

        if not naver_id or not naver_secret:
            errors.append({"step": step_name, "type": "Authentication Missing", "message": "네이버 API 키가 설정되지 않았습니다."})
            return []

        query = urllib.parse.urlencode({"query": f"{region} {keyword}", "display": display, "start": 1, "sort": "comment"})
        url = f"https://openapi.naver.com/v1/search/local.json?{query}"
        req = urllib.request.Request(url, headers={
            "X-Naver-Client-Id": naver_id,
            "X-Naver-Client-Secret": naver_secret,
        })

        try:
            with urllib.request.urlopen(req, timeout=8) as res:
                data = json.loads(res.read())
                items = data.get("items", [])
                results = []
                for item in items:
                    title = re.sub(r"</?b>", "", item.get("title", ""))
                    results.append({
                        "name": title,
                        "address": item.get("roadAddress") or item.get("address", "정보 없음"),
                        "category": item.get("category", "정보 없음"),
                        "url": item.get("link", ""),
                    })
                return results
        except urllib.error.HTTPError as e:
            errors.append({"step": step_name, "type": "HTTP Error Status", "message": f"네이버 API 요청 실패 (Status Code: {e.code})"})
            return []
        except Exception as e:
            errors.append({"step": step_name, "type": "Network Exception", "message": f"네이버 API 연동 중 예외 발생: {str(e)}"})
            return []

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)