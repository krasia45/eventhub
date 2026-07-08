from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs

# 날씨 아이콘 매핑 (OpenWeatherMap 코드 → 이모지)
ICON_MAP = {
    "01": "☀️", "02": "🌤", "03": "☁️", "04": "☁️",
    "09": "🌧", "10": "🌦", "11": "⛈", "13": "❄️", "50": "🌫",
}

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        query = parse_qs(urlparse(self.path).query)
        lat = query.get("lat", [None])[0]
        lng = query.get("lng", [None])[0]

        if not lat or not lng:
            self._send_json(400, {"error": "위치 정보(lat, lng)가 필요합니다."})
            return

        API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")
        if not API_KEY:
            self._send_json(500, {"error": "날씨 API 키가 설정되지 않았습니다."})
            return

        url = (
            "https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lng}&appid={API_KEY}&units=metric&lang=kr"
        )

        try:
            with urllib.request.urlopen(url, timeout=8) as res:
                data = json.loads(res.read())

            temp_c = round(data["main"]["temp"])
            description = data["weather"][0]["description"]
            icon_code = data["weather"][0]["icon"][:2]
            icon = ICON_MAP.get(icon_code, "🌤")
            location = data.get("name") or "현재 위치"

            self._send_json(200, {
                "location": location,
                "tempC": temp_c,
                "description": description,
                "icon": icon,
                "advice": self._advice_for(temp_c, icon_code),
            })

        except urllib.error.HTTPError as e:
            self._send_json(500, {"error": f"날씨 API 오류: {e.code}"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _advice_for(self, temp_c, icon_code):
        if icon_code in ("09", "10", "11"):
            return "비 소식이 있어요. 실내 이벤트 위주로 둘러보는 건 어때요? ☔"
        if temp_c >= 28:
            return "더운 날씨예요. 시원한 실내 매장 할인부터 확인해보세요!"
        if temp_c <= 5:
            return "쌀쌀한 날씨예요. 따뜻하게 입고 나가세요!"
        return "야외 활동하기 좋은 날씨예요. 팝업스토어 나들이 어때요?"

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)