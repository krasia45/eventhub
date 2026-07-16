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
        region = query.get("region", [None])[0]

        API_KEY = os.environ.get("OPENWEATHER_API_KEY", "")
        if not API_KEY:
            self._send_json(500, {"error": "날씨 API 키가 설정되지 않았습니다."})
            return

        resolved_name = None

        # lat/lng가 없고 지역명(구 단위 포함, 예: "강남구", "해운대구")이 왔다면
        # OpenWeatherMap Geocoding API로 실제 좌표를 찾는다.
        if (not lat or not lng) and region:
            geocoded = self._geocode_region(region, API_KEY)
            if not geocoded:
                self._send_json(404, {"error": f"'{region}' 지역을 찾지 못했어요. 다른 이름으로 다시 검색해보세요."})
                return
            lat, lng, resolved_name = geocoded["lat"], geocoded["lon"], geocoded["name"]

        if not lat or not lng:
            self._send_json(400, {"error": "위치 정보(lat, lng) 또는 지역명(region)이 필요합니다."})
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
            location = resolved_name or data.get("name") or "현재 위치"

            forecast, hourly = self._fetch_forecast(lat, lng, API_KEY)

            self._send_json(200, {
                "location": location,
                "tempC": temp_c,
                "description": description,
                "icon": icon,
                "advice": self._advice_for(temp_c, icon_code),
                "forecast": forecast,  # [{ "label": "오늘"/"화" 등, "icon": "☀️", "tempMax": 30, "tempMin": 22 }, ...]
                "hourly": hourly,  # [{ "label": "지금"/"15시" 등, "icon": "☀️", "tempC": 27 }, ...] — 네이버 날씨처럼 시간대별
            })

        except urllib.error.HTTPError as e:
            self._send_json(500, {"error": f"날씨 API 오류: {e.code}"})
        except Exception as e:
            self._send_json(500, {"error": str(e)})

    def _geocode_region(self, region, api_key):
        """지역명(시/도, 시/군/구 단위 포함)을 OpenWeatherMap Geocoding API로 좌표 변환.
        예: '강남구' → 국내에 동명 지역이 있을 수 있어 ',KR'을 붙여 한국으로 한정하고,
        찾지 못하면 None을 반환해 호출부에서 '지역을 찾지 못했다'고 안내하도록 한다."""
        import urllib.parse as _urlparse
        q = _urlparse.quote(f"{region},KR")
        url = f"https://api.openweathermap.org/geo/1.0/direct?q={q}&limit=1&appid={api_key}"
        try:
            with urllib.request.urlopen(url, timeout=8) as res:
                results = json.loads(res.read())
        except Exception:
            return None

        if not results:
            return None

        r = results[0]
        # local_names에 한글 표기가 있으면 그걸, 없으면 영문 name을 그대로 사용
        local_names = r.get("local_names") or {}
        display_name = local_names.get("ko") or r.get("name") or region
        return {"lat": r["lat"], "lon": r["lon"], "name": display_name}

    def _fetch_forecast(self, lat, lng, api_key):
        """5일치 3시간 단위 예보를 하루 단위(최고/최저기온, 대표 아이콘)로 묶은 목록과,
        네이버 날씨처럼 지금부터 이어지는 3시간 간격 시간대별 목록을 함께 반환한다."""
        url = (
            "https://api.openweathermap.org/data/2.5/forecast"
            f"?lat={lat}&lon={lng}&appid={api_key}&units=metric&lang=kr"
        )
        try:
            with urllib.request.urlopen(url, timeout=8) as res:
                data = json.loads(res.read())
        except Exception:
            return [], []  # 예보 조회 실패해도 현재 날씨는 보여줄 수 있도록 조용히 빈 값 반환

        days = {}
        raw_list = data.get("list", [])
        today_key = datetime.now().strftime("%Y-%m-%d")

        for item in raw_list:
            dt = datetime.fromtimestamp(item["dt"])
            date_key = dt.strftime("%Y-%m-%d")
            temp = item["main"]["temp"]
            icon_code = item["weather"][0]["icon"][:2]

            if date_key not in days:
                days[date_key] = {"temps": [], "icons": [], "date": dt}
            days[date_key]["temps"].append(temp)
            days[date_key]["icons"].append(icon_code)

        result = []
        for i, (date_key, d) in enumerate(sorted(days.items())[:5]):
            label = "오늘" if date_key == today_key else WEEKDAY_KR[d["date"].weekday()]
            common_icon = max(set(d["icons"]), key=d["icons"].count)
            result.append({
                "label": label,
                "icon": ICON_MAP.get(common_icon, "🌤"),
                "tempMax": round(max(d["temps"])),
                "tempMin": round(min(d["temps"])),
            })

        # 시간대별(3시간 간격) — 지금 이후 앞으로의 8개 구간(약 24시간)만 보여줌
        hourly = []
        for i, item in enumerate(raw_list[:8]):
            dt = datetime.fromtimestamp(item["dt"])
            icon_code = item["weather"][0]["icon"][:2]
            hourly.append({
                "label": "지금" if i == 0 else f"{dt.hour}시",
                "icon": ICON_MAP.get(icon_code, "🌤"),
                "tempC": round(item["main"]["temp"]),
            })

        return result, hourly

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