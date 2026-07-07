# api/recommend.py - Gemini 버전으로 완전 교체
from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
            interest = data.get("interest", "")
        except:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        if not interest:
            self._send_json(400, {"error": "interest 값이 없습니다."})
            return

        if not GEMINI_API_KEY:
            self._send_json(500, {"error": "API 키가 설정되지 않았습니다."})
            return

        # ✅ Gemini API 호출
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

        prompt = f"사용자의 관심사: {interest}\n\n이 관심사에 맞는 이벤트나 행사를 3가지 추천해주세요. 각각 제목과 간단한 설명을 포함해주세요."

        payload = json.dumps({
            "contents": [{
                "parts": [{"text": prompt}]
            }]
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"}
        )

        try:
            with urllib.request.urlopen(req) as res:
                result = json.loads(res.read())
                recommendation = result["candidates"][0]["content"]["parts"][0]["text"]
                self._send_json(200, {"recommendation": recommendation})
        except urllib.error.HTTPError as e:
            error_body = e.read().decode()
            self._send_json(500, {"error": f"Gemini 오류: {e.code} / {error_body}"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def do_OPTIONS(self):
        self._send_cors()

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_cors(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()