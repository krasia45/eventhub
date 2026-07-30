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


def sb_delete(table, match_params, use_service_role=True, timeout=10):
    """삭제. match_params 예: {'id': 'eq.xxx'}"""
    query = urllib.parse.urlencode(match_params)
    url = f"{_base_url()}/rest/v1/{table}?{query}"
    headers = _headers(use_service_role)
    req = urllib.request.Request(url, headers=headers, method="DELETE")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read()
            return json.loads(raw) if raw else None
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


# ============================================================
# Supabase Auth Admin API (네이버 로그인처럼 Supabase가 기본
# 지원하지 않는 OAuth Provider를 붙일 때 사용).
# 위의 sb_* 함수들은 /rest/v1(PostgREST, 테이블 CRUD)을 쓰지만,
# 이 아래는 /auth/v1/admin(GoTrue, 사용자 계정 자체)을 쓴다 — 완전히 다른 API.
# ============================================================

def _auth_admin_headers():
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.")
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def sb_admin_create_user(email, user_metadata=None, timeout=10):
    """사용자를 새로 만든다. 이미 있는 이메일이면 예외가 나는데,
    호출하는 쪽(auth_naver_callback.py)에서 그 경우를 잡아서 '이미 있는 사용자'로 처리한다."""
    url = f"{_base_url()}/auth/v1/admin/users"
    body = json.dumps({
        "email": email,
        "email_confirm": True,  # 네이버가 이미 이메일을 확인해줬으므로, 별도 인증메일 없이 바로 확정 처리
        "user_metadata": user_metadata or {},
    }).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=_auth_admin_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        _raise_with_body(e)


def sb_admin_generate_magiclink(email, timeout=10):
    """이 이메일로 로그인할 수 있는 매직링크 토큰을 생성한다.
    이 함수를 부르는 시점엔 사용자가 이미 존재해야 한다(생성 실패=이미 있음, 둘 다 OK).
    반환값 안의 token_hash를 프론트로 넘기면, 프론트가 supabase.auth.verifyOtp()로
    실제 로그인 세션을 만든다 — 네이버 로그인을 Supabase 세션에 연결하는 핵심 다리 역할."""
    url = f"{_base_url()}/auth/v1/admin/generate_link"
    body = json.dumps({"type": "magiclink", "email": email}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=_auth_admin_headers(), method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.loads(res.read())
    except urllib.error.HTTPError as e:
        _raise_with_body(e)


# ============================================================
# Supabase Storage (관리자 페이지에서 이벤트 이미지를 업로드할 때 사용).
# PostgREST(/rest/v1)와는 다른 API(/storage/v1)라 별도 헬퍼로 분리한다.
# ============================================================

def sb_storage_ensure_bucket(bucket, timeout=10):
    """버킷이 없으면 새로 만든다. 이미 있어서 실패하는 경우(다양한 상태코드/메시지로 옴)는
    조용히 무시한다 — 어차피 그 다음에 실제 업로드를 재시도하면서 진짜 문제인지 다시 드러난다."""
    url = f"{_base_url()}/storage/v1/bucket"
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    body = json.dumps({"id": bucket, "name": bucket, "public": True}).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            res.read()
    except urllib.error.HTTPError:
        pass  # 이미 있어서든 뭐든, 여기서 실패해도 업로드 재시도에서 진짜 문제면 다시 드러남


def sb_storage_upload(bucket, path, file_bytes, content_type, timeout=15):
    """파일을 업로드하고 공개 URL을 리턴한다. 버킷이 없으면 한 번 자동으로 만들고 재시도한다."""
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.")
    url = f"{_base_url()}/storage/v1/object/{bucket}/{path}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": content_type,
        "x-upsert": "true",  # 같은 경로에 이미 파일이 있으면 덮어쓰기(에러 대신)
    }
    req = urllib.request.Request(url, data=file_bytes, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            res.read()
    except urllib.error.HTTPError as e:
        # ⚠️ Supabase Storage는 "버킷이 없음"을 HTTP 404가 아니라 HTTP 400으로 응답하면서,
        # 응답 본문 JSON 안에만 {"statusCode":"404","code":"NoSuchBucket",...}을 담아 보낸다.
        # 예전엔 e.code(HTTP 상태코드)가 404인지만 확인했는데, 실제로는 400이 오니까 이 분기를
        # 전혀 못 타고 그대로 원본 에러가 관리자 화면에 노출되던 버그였다. 바디 내용으로 판정한다.
        try:
            body = json.loads(e.read().decode("utf-8", errors="ignore"))
        except Exception:
            body = {}
        is_no_bucket = body.get("code") == "NoSuchBucket" or str(body.get("statusCode")) == "404"

        if is_no_bucket:
            sb_storage_ensure_bucket(bucket)
            req2 = urllib.request.Request(url, data=file_bytes, headers=headers, method="POST")
            with urllib.request.urlopen(req2, timeout=timeout) as res2:
                res2.read()
        else:
            raise RuntimeError(f"Supabase Storage 오류: {json.dumps(body, ensure_ascii=False)}") from e
    return f"{_base_url()}/storage/v1/object/public/{bucket}/{path}"