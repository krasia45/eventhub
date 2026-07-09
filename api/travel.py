from http.server import BaseHTTPRequestHandler
import json
import os
import re
import urllib.request
import urllib.error
import urllib.parse


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
            date = (data.get("date") or "").strip()
            region = (data.get("region") or "").strip()
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        # ── 입력 검증 ─────────────────────────────────────
        if not region:
            self._send_json(400, {"error": "여행하실 지역을 입력해 주세요."})
            return
        if not date or not re.match(r"^\d{4}-\d{2}-\d{2}$", date):
            self._send_json(400, {"error": "날짜는 YYYY-MM-DD 형식으로 입력해 주세요."})
            return

        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
        if not GEMINI_API_KEY:
            self._send_json(500, {"error": "API 키가 설정되지 않았습니다."})
            return

        # ── 1. Gemini: 날씨 요약 + 지역 행사/축제 + 추천 이유 + 맛집/숙박 폴백 데이터 ──
        ai_data = self._call_gemini(GEMINI_API_KEY, region, date, errors)

        # ── 2. 네이버 지역 검색: 실시간 맛집 (실패 시 Gemini 폴백 데이터 사용) ──
        restaurants = self._search_naver(region, "맛집", errors, "Restaurant Search")
        if not restaurants:
            errors.append({
                "step": "Restaurant Search",
                "type": "Fallback Triggered",
                "message": f"'{region}' 지역의 실시간 네이버 맛집 검색 결과가 없어 AI 백업 데이터로 대체합니다.",
            })
            restaurants = ai_data.get("fallback_restaurants", [])

        # ── 3. 네이버 지역 검색: 실시간 숙박 (실패 시 Gemini 폴백 데이터 사용) ──
        lodgings = self._search_naver(region, "숙박", errors, "Lodging Search")
        if not lodgings:
            errors.append({
                "step": "Lodging Search",
                "type": "Fallback Triggered",
                "message": f"'{region}' 지역의 실시간 네이버 숙박 검색 결과가 없어 AI 백업 데이터로 대체합니다.",
            })
            lodgings = ai_data.get("fallback_lodgings", [])

        result = {
            "destination": region,
            "date": date,
            "weather_summary": ai_data.get("weather", "날씨 정보를 불러오지 못했습니다."),
            "local_events": ai_data.get("events", []),
            "recommendation_reason": ai_data.get("reason", ""),
            "restaurants": restaurants[:3],
            "lodgings": lodgings[:3],
            "route_tip": ai_data.get("route_tip", "각 장소 간 이동은 카카오맵/네이버맵에서 실제 경로를 확인해보세요."),
            "errors": errors,
        }

        self._send_json(200, result)

    # ------------------------------------------------------------------
    def _call_gemini(self, api_key, region, date, errors):
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={api_key}"
        )

        prompt = (
            "당신은 한국 여행 전문 플래너입니다. 사용자가 요청한 날짜와 지역을 바탕으로 "
            "계절적 특징, 날씨, 지역 축제/행사 정보를 분석해서 아래 JSON 스키마에 맞춰 답해주세요. "
            "실시간 검색 API가 실패할 경우를 대비한 맛집/숙박 폴백 데이터도 함께 제공해야 합니다. "
            "다른 설명 문장 없이 JSON만 출력하세요.\n\n"
            f"지역: \"{region}\"\n날짜: \"{date}\""
        )

        schema = {
            "type": "OBJECT",
            "properties": {
                "weather": {"type": "STRING"},
                "events": {"type": "ARRAY", "items": {"type": "STRING"}},
                "reason": {"type": "STRING"},
                "route_tip": {"type": "STRING"},
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
            "required": ["weather", "events", "reason", "route_tip", "fallback_restaurants", "fallback_lodgings"],
        }

        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": schema,
            },
        }).encode("utf-8")

        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                result = json.loads(res.read())
                raw_text = result["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(raw_text)

        except urllib.error.HTTPError as e:
            errors.append({
                "step": "LLM Generation",
                "type": "API Connection Error",
                "message": f"Gemini 요청 실패 (HTTP {e.code})",
            })
        except json.JSONDecodeError:
            errors.append({
                "step": "LLM Generation",
                "type": "Parsing Error",
                "message": "AI 응답을 JSON으로 해석하지 못했습니다.",
            })
        except Exception as e:
            errors.append({
                "step": "LLM Generation",
                "type": "Unknown Error",
                "message": str(e),
            })

        # ── 예외처리: AI 응답 실패 시 안전한 기본 구조 반환 ──
        return {
            "weather": "날씨 정보를 불러오지 못했습니다.",
            "events": [],
            "reason": "AI 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주시거나, 하단의 백업 데이터를 확인해 주세요.",
            "route_tip": "",
            "fallback_restaurants": [],
            "fallback_lodgings": [],
        }

    # ------------------------------------------------------------------
    def _search_naver(self, region, keyword, errors, step_name):
        naver_id = os.environ.get("NAVER_CLIENT_ID", "")
        naver_secret = os.environ.get("NAVER_CLIENT_SECRET", "")

        if not naver_id or not naver_secret:
            errors.append({
                "step": step_name,
                "type": "Authentication Missing",
                "message": "네이버 API 키가 설정되지 않았습니다.",
            })
            return []

        query = urllib.parse.urlencode({
            "query": f"{region} {keyword}",
            "display": 5,
            "start": 1,
            "sort": "comment",
        })
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
            errors.append({
                "step": step_name,
                "type": "HTTP Error Status",
                "message": f"네이버 API 요청 실패 (Status Code: {e.code})",
            })
            return []
        except Exception as e:
            errors.append({
                "step": step_name,
                "type": "Network Exception",
                "message": f"네이버 API 연동 중 예외 발생: {str(e)}",
            })
            return []

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)