from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error

OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        # 요청 body 읽기
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

        if not OPENAI_API_KEY:
            self._send_json(500, {"error": "API 키가 설정되지 않았습니다."})
            return

        # OpenAI API 호출
        prompt = f"사용자의 관심사: {interest}\n\n이 관심사에 맞는 이벤트나 행사를 3가지 추천해주세요. 각각 제목과 간단한 설명을 포함해주세요."

        payload = json.dumps({
            "model": "gpt-3.5-turbo",
            "messages": [
                {"role": "system", "content": "당신은 이벤트 추천 전문가입니다."},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 500
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.openai.com/v1/chat/completions",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OPENAI_API_KEY}"
            }
        )

        try:
            with urllib.request.urlopen(req) as res:
                result = json.loads(res.read())
                recommendation = result["choices"][0]["message"]["content"]
                self._send_json(200, {"recommendation": recommendation})
        except urllib.error.HTTPError as e:
            self._send_json(500, {"error": f"OpenAI 오류: {e.code}"})
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