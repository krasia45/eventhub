"""
공용 Supabase REST(PostgREST) 클라이언트 헬퍼.
외부 패키지(supabase-py) 없이 표준 라이브러리(urllib)만으로 동작하도록 작성했습니다.
Vercel 서버리스 함수들이 이 파일을 import해서 공용으로 사용합니다.
(이 파일 자체는 vercel.json에 라우트로 등록하지 않으므로 API 엔드포인트가 되지 않습니다.)
"""

import os
import json
import urllib.request
import urllib.error
import urllib.parse


def _raise_with_body(e):
    """urllib의 HTTPError는 str(e)로 찍으면 'HTTP Error 400: Bad Request'처럼
    상태코드/사유구문만 나오고, Supabase(PostgREST)가 응답 본문에 담아 보내는
    실제 실패 이유(예: 누락된 컬럼, NOT NULL 위반, 타입 불일치 등)는 사라진다.
    응답 본문을 읽어서 그대로 예외 메시지에 포함시켜 재발생시킨다."""
    try:
        detail = e.read().decode("utf-8", errors="ignore")
    except Exception:
        detail = ""
    raise RuntimeError(f"Supabase {e.code} {e.reason}: {detail}") from e


def _base_url():
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("SUPABASE_URL 환경변수가 설정되지 않았습니다.")
    return url


def _headers(use_service_role=False):
    key = os.environ.get(
        "SUPABASE_SERVICE_ROLE_KEY" if use_service_role else "SUPABASE_ANON_KEY", ""
    )
    if not key:
        raise RuntimeError("Supabase API 키 환경변수가 설정되지 않았습니다.")
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def sb_select(table, params=None, use_service_role=True, timeout=10):
    """조회. params 예: {'category': 'eq.food', 'order': 'created_at.desc'}"""
    query = urllib.parse.urlencode(params or {})
    url = f"{_base_url()}/rest/v1/{table}?{query}"
    req = urllib.request.Request(url, headers=_headers(use_service_role))
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        _raise_with_body(e)


def sb_insert(table, rows, use_service_role=True, timeout=10):
    """삽입. rows는 dict 또는 dict 리스트."""
    url = f"{_base_url()}/rest/v1/{table}"
    headers = _headers(use_service_role)
    headers["Prefer"] = "return=representation"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        _raise_with_body(e)


def sb_update(table, match_params, patch, use_service_role=True, timeout=10):
    """수정. match_params 예: {'id': 'eq.xxx'}"""
    query = urllib.parse.urlencode(match_params)
    url = f"{_base_url()}/rest/v1/{table}?{query}"
    headers = _headers(use_service_role)
    headers["Prefer"] = "return=representation"
    body = json.dumps(patch).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="PATCH")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        _raise_with_body(e)


def sb_upsert(table, rows, on_conflict, use_service_role=True, timeout=10):
    """UPSERT (있으면 갱신, 없으면 삽입)."""
    url = f"{_base_url()}/rest/v1/{table}?on_conflict={on_conflict}"
    headers = _headers(use_service_role)
    headers["Prefer"] = "resolution=merge-duplicates,return=representation"
    body = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        _raise_with_body(e)


def sb_rpc(fn_name, payload, use_service_role=True, timeout=10):
    """Postgres 함수(RPC) 호출 (조회수 증가처럼 원자적 연산이 필요할 때 사용)."""
    url = f"{_base_url()}/rest/v1/rpc/{fn_name}"
    headers = _headers(use_service_role)
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        _raise_with_body(e)