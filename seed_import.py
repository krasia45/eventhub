"""
초기 마이그레이션 스크립트 — 로컬에서 1회 실행합니다 (Vercel에 배포되는 파일이 아닙니다).

사용법:
  1) pip install requests
  2) 환경변수 설정: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  3) python seed_import.py

seed_events.json(main.js에서 자동 추출된 160개 이벤트)을 Supabase의
events 테이블과 event_stats 테이블에 채워 넣습니다.
"""

import os
import json
import re
import sys
import requests  # pip install requests

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL or not SERVICE_KEY:
    print("❌ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 환경변수를 먼저 설정해주세요.")
    sys.exit(1)

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates,return=representation",
}


def parse_period(period_str):
    """'2026.07.01 - 2026.07.31' → ('2026-07-01', '2026-07-31')"""
    m = re.findall(r"(\d{4})\.(\d{2})\.(\d{2})", period_str)
    if len(m) >= 2:
        start = f"{m[0][0]}-{m[0][1]}-{m[0][2]}"
        end = f"{m[1][0]}-{m[1][1]}-{m[1][2]}"
        return start, end
    if len(m) == 1:
        d = f"{m[0][0]}-{m[0][1]}-{m[0][2]}"
        return d, d
    return None, None


def main():
    with open("seed_events.json", "r", encoding="utf-8") as f:
        events = json.load(f)

    event_rows = []
    stat_rows = []

    for ev in events:
        period_start, period_end = parse_period(ev.get("period", ""))
        event_rows.append({
            "id": ev["id"],
            "category": ev["category"],
            "brand": ev["brand"],
            "merchant_type": ev.get("merchantType", "브랜드"),
            "is_verified_real": ev.get("isVerifiedReal", False),
            "lat": ev["lat"],
            "lng": ev["lng"],
            "title": ev["title"],
            "subtitle": ev.get("subtitle", ""),
            "discount": ev["discount"],
            "period": ev["period"],
            "period_start": period_start,
            "period_end": period_end,
            "channel": ev.get("channel", ""),
            "desc": ev.get("desc", ""),
            "tags": ev.get("tags", []),
            "image": ev.get("image", ""),
            "domain": ev.get("domain", ""),
            "link": ev.get("link", ""),
            "source_url": ev.get("link") if ev.get("isVerifiedReal") else None,
        })
        stat_rows.append({"event_id": ev["id"], "views": 0, "likes": 0})

    print(f"이벤트 {len(event_rows)}건 업로드 중...")
    res = requests.post(f"{SUPABASE_URL}/rest/v1/events", headers=HEADERS, json=event_rows)
    print("events:", res.status_code, res.text[:200])

    print(f"통계 초기값 {len(stat_rows)}건 업로드 중...")
    res2 = requests.post(f"{SUPABASE_URL}/rest/v1/event_stats", headers=HEADERS, json=stat_rows)
    print("event_stats:", res2.status_code, res2.text[:200])

    print("✅ 완료!")


if __name__ == "__main__":
    main()
