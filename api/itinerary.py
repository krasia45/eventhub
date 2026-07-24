"""
POST /api/itinerary
     여행 일정 생성 (AI 명소/행사 추천 + 네이버 실시간 맛집/숙박 검색 조합)

GET  /api/itinerary?lat=&lng= 또는 ?region=
     날씨 정보 조회 (OpenWeatherMap)

(원래 itinerary.py는 POST만, weather.py는 GET만 쓰는 서로 다른 파일이었는데,
 메서드가 겹치지 않아서 Vercel Hobby 플랜 함수 개수 제한 때문에 한 파일로 합쳤습니다.
 프론트엔드 호출 경로는 각각 그대로 유지: /api/itinerary(POST), /api/weather→/api/itinerary(GET))
"""
from http.server import BaseHTTPRequestHandler
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_select


MAX_DAYS = 5  # 과도한 API 호출/비용 방지를 위한 상한

# 날씨 아이콘 매핑 (OpenWeatherMap 코드 → 이모지)
ICON_MAP = {
    "01": "☀️", "02": "🌤", "03": "☁️", "04": "☁️",
    "09": "🌧", "10": "🌦", "11": "⛈", "13": "❄️", "50": "🌫",
}

WEEKDAY_KR = ["월", "화", "수", "목", "금", "토", "일"]

# Vercel 서버리스 함수는 UTC로 돌아간다. datetime.now()를 그대로 쓰면
# 실제 한국 시각보다 9시간 밀려서 "지금" 시간대나 오늘/내일 날짜 경계가 어긋난다.
# 그래서 항상 이 헬퍼로 명시 변환해서 쓴다.
KST = timezone(timedelta(hours=9))


def now_kst():
    """지금 이 순간을 한국시간 기준의 naive datetime으로 반환."""
    return datetime.now(KST).replace(tzinfo=None)


def to_kst(unix_ts):
    """OpenWeatherMap이 주는 UTC epoch 타임스탬프를 한국시간 기준의 naive datetime으로 변환."""
    return datetime.fromtimestamp(unix_ts, tz=KST).replace(tzinfo=None)




class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
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

        now = now_kst()
        days = {}
        raw_list = data.get("list", [])
        today_key = now.strftime("%Y-%m-%d")

        for item in raw_list:
            dt = to_kst(item["dt"])
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
            dt = to_kst(item["dt"])
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