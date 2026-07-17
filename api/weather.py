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

            forecast, hourly = self._fetch_forecast(lat, lng, API_KEY, temp_c, icon)

            self._send_json(200, {
                "location": location,
                "tempC": temp_c,
                "description": description,
                "icon": icon,
                "advice": self._advice_for(temp_c, icon_code),
                "forecast": forecast,  # [{ "label", "amIcon", "amPop", "pmIcon", "pmPop", "tempMax", "tempMin" }, ...] — 네이버 주간예보처럼 오전/오후 구분
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

    def _fetch_forecast(self, lat, lng, api_key, current_temp_c, current_icon):
        """5일치 3시간 단위 예보를 하루 단위로 묶어서 오전/오후 아이콘·강수확률·최고/최저기온을
        반환하고(네이버 주간예보와 같은 형태), 동시에 지금부터 이어지는 3시간 간격 시간대별
        목록도 함께 반환한다.

        정확도를 위해 두 가지를 신경씀:
        1. '지금' 슬롯은 예보값이 아니라 방금 조회한 실제 현재 날씨를 그대로 사용한다.
           (예보의 첫 항목은 최대 3시간 전에 시작된 구간일 수 있어 '지금'이라기엔 부정확했음)
        2. 이미 끝난 3시간 구간은 목록에서 제외한다 (예: 지금이 07시인데 06시 구간이
           그대로 남아있던 문제)."""
        url = (
            "https://api.openweathermap.org/data/2.5/forecast"
            f"?lat={lat}&lon={lng}&appid={api_key}&units=metric&lang=kr"
        )
        try:
            with urllib.request.urlopen(url, timeout=8) as res:
                data = json.loads(res.read())
        except Exception:
            return [], [{"label": "지금", "icon": current_icon, "tempC": current_temp_c}]

        now = datetime.now()
        days = {}
        raw_list = data.get("list", [])
        today_key = now.strftime("%Y-%m-%d")

        for item in raw_list:
            dt = datetime.fromtimestamp(item["dt"])
            date_key = dt.strftime("%Y-%m-%d")
            temp = item["main"]["temp"]
            icon_code = item["weather"][0]["icon"][:2]

            if date_key not in days:
                days[date_key] = {"date": dt, "am": [], "pm": []}
            slot = (icon_code, temp)
            (days[date_key]["am"] if dt.hour < 12 else days[date_key]["pm"]).append(slot)

        def half_day_summary(slots):
            if not slots:
                return None
            icons = [s[0] for s in slots]
            temps = [s[1] for s in slots]
            common_icon = max(set(icons), key=icons.count)
            avg_temp = round(sum(temps) / len(temps))
            return {"icon": ICON_MAP.get(common_icon, "🌤"), "temp": avg_temp}

        result = []
        for date_key, d in sorted(days.items())[:5]:
            label = "오늘" if date_key == today_key else WEEKDAY_KR[d["date"].weekday()]
            am = half_day_summary(d["am"])
            pm = half_day_summary(d["pm"])
            result.append({
                "label": label,
                "amIcon": am["icon"] if am else None,
                "amTemp": am["temp"] if am else None,
                "pmIcon": pm["icon"] if pm else None,
                "pmTemp": pm["temp"] if pm else None,
            })

        # 시간대별 — 네이버 날씨처럼 '지금'부터 1시간 간격으로 24시간 쭉 이어지게 구성.
        # OpenWeatherMap 무료 예보는 3시간 단위라, 두 개의 실측 지점 사이 온도는 선형보간하고
        # (예: 21시 25도 → 24시 22도 라면 22시/23시는 그 사이값으로 자연스럽게 채움),
        # 아이콘/강수확률은 그 시각이 속한 3시간 구간의 실제 예보값을 그대로 사용한다.
        # (아이콘까지 보간하면 있지도 않은 '중간 날씨'를 지어내는 셈이라 그건 하지 않음)
        anchors = [(now, current_temp_c, current_icon, None)]
        for item in raw_list:
            dt = datetime.fromtimestamp(item["dt"])
            if dt <= now:
                continue
            icon_code = item["weather"][0]["icon"][:2]
            anchors.append((dt, item["main"]["temp"], ICON_MAP.get(icon_code, "🌤"), round(item.get("pop", 0) * 100)))

        def value_at(target_dt):
            """target_dt 시점의 (온도, 아이콘, 강수확률)을 anchors 사이에서 계산."""
            before = None
            after = None
            for a in anchors:
                if a[0] <= target_dt:
                    before = a
                if a[0] >= target_dt and after is None:
                    after = a
            if before is None:
                before = anchors[0]
            if after is None:
                after = anchors[-1]
            if before[0] == after[0]:
                return round(before[1]), (before[2] or after[2]), before[3] if before[3] is not None else after[3]
            ratio = (target_dt - before[0]).total_seconds() / (after[0] - before[0]).total_seconds()
            temp = before[1] + (after[1] - before[1]) * ratio
            # 아이콘/강수확률은 보간하지 않고, 더 가까운 쪽(주로 이후 구간)의 실제 예보값을 사용
            icon = after[2] or before[2]
            pop = after[3] if after[3] is not None else before[3]
            return round(temp), icon, pop

        hourly = []
        cursor = now.replace(minute=0, second=0, microsecond=0)
        last_date_key = now.strftime("%Y-%m-%d")
        for i in range(25):  # 지금(0) ~ +24시간(다음날 같은 시각)까지 정확히 포함
            target = cursor if i == 0 else cursor + timedelta(hours=i)
            date_key = target.strftime("%Y-%m-%d")
            date_label = None
            if i > 0 and date_key != last_date_key:
                delta_days = (target.date() - now.date()).days
                date_label = "내일" if delta_days == 1 else f"{target.month}/{target.day}"
                last_date_key = date_key

            if i == 0:
                temp_c, icon_c, pop_c = current_temp_c, current_icon, None
                label = "지금"
            else:
                temp_c, icon_c, pop_c = value_at(target)
                label = f"{target.hour}시"

            hourly.append({
                "label": label,
                "dateLabel": date_label,  # 날짜가 바뀌는 시점에만 값이 있고, 나머진 null
                "icon": icon_c,
                "tempC": temp_c,
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