from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        # 1. 요청 바디 읽기
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # 2. JSON 파싱
        try:
            data = json.loads(body)
            interest = data.get("interest", "") or data.get("query", "")
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        # 3. interest 값 확인 (모호하거나 빈 입력 방어)
        interest = interest.strip()
        if not interest or len(interest) < 1:
            self._send_json(400, {"error": "다른 검색어로 입력해 주세요."})
            return

        # 4. API 키 확인
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
        if not GEMINI_API_KEY:
            self._send_json(500, {"error": "API 키가 설정되지 않았습니다."})
            return

        # 5. Gemini API 호출 — 카드 UI로 바로 렌더링할 수 있도록 JSON 스키마 강제
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        )

        prompt = (
            f"사용자의 관심사: \"{interest}\"\n\n"
            "이 관심사에 맞는 할인 이벤트/행사를 정확히 3개 추천해줘. "
            "각 항목은 title(15자 내외의 짧은 이벤트 제목), "
            "description(40자 내외의 간단한 설명), "
            "category(fashion/beauty/food/tech/delivery/stay/living/popup 중 하나) "
            "3개 필드를 가진 JSON 배열로만 응답해. 다른 설명 문장은 절대 붙이지 마."
        )

        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "ARRAY",
                    "items": {
                        "type": "OBJECT",
                        "properties": {
                            "title": {"type": "STRING"},
                            "description": {"type": "STRING"},
                            "category": {"type": "STRING"},
                        },
                        "required": ["title", "description", "category"],
                    },
                    "minItems": 3,
                    "maxItems": 3,
                },
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                result = json.loads(res.read())
                raw_text = result["candidates"][0]["content"]["parts"][0]["text"]

                try:
                    cards = json.loads(raw_text)
                    if not isinstance(cards, list) or len(cards) == 0:
                        raise ValueError("empty result")
                except Exception:
                    # AI가 형식을 어긴 경우 → 프론트에서 "다른 검색어로 입력해주세요" 문구를 띄우도록 에러 처리
                    self._send_json(200, {
                        "error": "AI가 이 검색어를 이해하지 못했어요. 다른 검색어로 입력해 주세요."
                    })
                    return

                self._send_json(200, {"results": cards})

        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            self._send_json(500, {"error": f"Gemini 오류: {e.code} / {error_body}"})

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