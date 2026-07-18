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
        # 예상 못한 예외로 서버가 응답 없이 죽는 걸 막는 최상위 안전망.
        # (실제로 tags가 null인 이벤트 하나 때문에 전체가 500으로 죽은 적이 있었음)
        try:
            self._handle_post()
        except Exception as e:
            self._send_json(500, {"error": f"예상치 못한 오류가 발생했어요: {str(e)}"})

    def _handle_post(self):
        # 1. 요청 바디 읽기
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        # 2. JSON 파싱
        try:
            data = json.loads(body)
            interest = (data.get("interest", "") or data.get("query", "")).strip()
            events = data.get("events", [])  # 프론트에서 보내주는 실제 등록 이벤트 요약 목록
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        # 3. 입력값 확인
        if not interest:
            self._send_json(400, {"error": "다른 검색어로 입력해 주세요."})
            return
        if not isinstance(events, list) or len(events) == 0:
            self._send_json(400, {"error": "추천할 이벤트 데이터가 없습니다."})
            return

        # 4. API 키 확인
        GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
        if not GEMINI_API_KEY:
            self._send_json(500, {"error": "API 키가 설정되지 않았습니다."})
            return

        # 5. Gemini API 호출 — 새로 만들지 말고, 전달받은 이벤트 목록 안에서만 고르도록 강제
        url = (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"gemini-2.5-flash:generateContent?key={GEMINI_API_KEY}"
        )

        # 이벤트 요약본을 프롬프트에 그대로 포함 (id를 반드시 반환하도록 지시)
        events_text = "\n".join(
            f"- id:{e.get('id')} | 브랜드:{e.get('brand')} | 카테고리:{e.get('category')} | "
            f"제목:{e.get('title')} | 태그:{','.join(e.get('tags') or [])} | 혜택:{e.get('discount')}"
            for e in events
        )

        prompt = (
            f"아래는 EventHub 서비스에 실제로 등록되어 있는 이벤트 목록이야.\n\n"
            f"{events_text}\n\n"
            f"사용자의 관심사: \"{interest}\"\n\n"
            "위 목록에 있는 이벤트 중에서만 사용자 관심사에 가장 잘 맞는 것을 정확히 6개 골라줘. "
            "절대로 목록에 없는 새로운 이벤트를 만들어내지 마. "
            "목록에 있는 이벤트가 6개 미만이면 있는 만큼만 골라줘. "
            "반드시 목록에 있는 id 값 그대로, 문자열 배열(JSON)로만 응답해. "
            "다른 설명 문장은 절대 붙이지 마."
        )

        payload = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "responseMimeType": "application/json",
                "responseSchema": {
                    "type": "ARRAY",
                    "items": {"type": "STRING"},
                    "minItems": 1,
                    "maxItems": 6,
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
                    picked_ids = json.loads(raw_text)
                    if not isinstance(picked_ids, list) or len(picked_ids) == 0:
                        raise ValueError("empty result")
                except Exception:
                    self._send_json(200, {
                        "error": "AI가 이 검색어를 이해하지 못했어요. 다른 검색어로 입력해 주세요."
                    })
                    return

                # ── 환각 방지: AI가 목록에 없는 id를 반환했으면 걸러낸다 ──
                valid_ids = {e.get("id") for e in events}
                picked_ids = [pid for pid in picked_ids if pid in valid_ids][:6]

                if not picked_ids:
                    self._send_json(200, {
                        "error": "조건에 맞는 이벤트를 찾지 못했어요. 다른 검색어로 입력해 주세요."
                    })
                    return

                self._send_json(200, {"ids": picked_ids})

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