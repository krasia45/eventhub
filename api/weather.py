from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timedelta

# 날씨 아이콘 매핑 (OpenWeatherMap 코드 → 이모지)
ICON_MAP = {
    "01": "☀️", "02": "🌤", "03": "☁️", "04": "☁️",
    "09": "🌧", "10": "🌦", "11": "⛈", "13": "❄️", "50": "🌫",
}

WEEKDAY_KR = ["월", "화", "수", "목", "금", "토", "일"]

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

        current_url = (
            "https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}&lon={lng}&appid={API_KEY}&units=metric&lang=kr"
        )

        try:
            with urllib.request.urlopen(current_url, timeout=8) as res:
                data = json.loads(res.read())

            temp_c = round(data["main"]["temp"])
            description = data["weather"][0]["description"]
            icon_code = data["weather"][0]["icon"][:2]
            icon = ICON_MAP.get(icon_code, "🌤")
            location = data.get("name") or "현재 위치"

            forecast, today_am_pm = self._fetch_forecast(lat, lng, API_KEY)

            self._send_json(200, {
                "location": location,
                "tempC": temp_c,
                "description": description,
                "icon": icon,
                "advice": self._advice_for(temp_c, icon_code),
                "forecast": forecast,  # [{ "label": "오늘"/"화" 등, "icon": "☀️", "tempMax": 30, "tempMin": 22 }, ...]
                "todayAmPm": today_am_pm,  # { "am": {"icon","tempAvg"}, "pm": {...} } — 오늘 오전/오후 대표 날씨
            })

        except urllib.error.HTTPError as e:
            self._send_json(500, {"error": f"날씨 API 오류: {e.code}"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _fetch_forecast(self, lat, lng, api_key):
        """5일치 3시간 단위 예보를 하루 단위로 묶어서(최고/최저기온, 대표 아이콘) 반환.
        네이버 날씨처럼 '오늘/화/수/목/금' 형태의 일별 예보 리스트를 만들기 위함.
        동시에 '오늘'에 해당하는 시간대를 오전(00~11시)/오후(12~23시)로 나눠서
        각각의 대표 아이콘과 평균 기온도 함께 계산해서 반환한다."""
        url = (
            "https://api.openweathermap.org/data/2.5/forecast"
            f"?lat={lat}&lon={lng}&appid={api_key}&units=metric&lang=kr"
        )
        try:
            with urllib.request.urlopen(url, timeout=8) as res:
                data = json.loads(res.read())
        except Exception:
            return [], None  # 예보 조회 실패해도 현재 날씨는 보여줄 수 있도록 조용히 빈 값 반환

        days = {}
        today_key = datetime.now().strftime("%Y-%m-%d")
        am_slots, pm_slots = [], []

        for item in data.get("list", []):
            dt = datetime.fromtimestamp(item["dt"])
            date_key = dt.strftime("%Y-%m-%d")
            temp = item["main"]["temp"]
            icon_code = item["weather"][0]["icon"][:2]

            if date_key not in days:
                days[date_key] = {"temps": [], "icons": [], "date": dt}
            days[date_key]["temps"].append(temp)
            days[date_key]["icons"].append(icon_code)

            if date_key == today_key:
                (am_slots if dt.hour < 12 else pm_slots).append((temp, icon_code))

        def summarize(slots):
            if not slots:
                return None
            temps = [t for t, _ in slots]
            icons = [i for _, i in slots]
            common_icon = max(set(icons), key=icons.count)
            return {"icon": ICON_MAP.get(common_icon, "🌤"), "tempAvg": round(sum(temps) / len(temps))}

        today_am_pm = {"am": summarize(am_slots), "pm": summarize(pm_slots)}

        result = []
        for i, (date_key, d) in enumerate(sorted(days.items())[:5]):
            label = "오늘" if date_key == today_key else WEEKDAY_KR[d["date"].weekday()]
            # 대표 아이콘: 그날 가장 자주 나온 코드
            common_icon = max(set(d["icons"]), key=d["icons"].count)
            result.append({
                "label": label,
                "icon": ICON_MAP.get(common_icon, "🌤"),
                "tempMax": round(max(d["temps"])),
                "tempMin": round(min(d["temps"])),
            })
        return result, today_am_pm

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