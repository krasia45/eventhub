"""
POST /api/auth_naver_callback
body: { code: string }

네이버 로그인 흐름 (Supabase가 네이버를 기본 지원하지 않아서 직접 연결):

1. 프론트가 사용자를 네이버 로그인 페이지로 보냄 (이 파일이 하는 일 아님, 10-auth.js에서 처리)
2. 네이버가 우리 사이트로 ?code=...&state=... 를 붙여서 돌려보냄
3. 프론트가 그 code를 이 API로 전달 ← 지금 이 파일
4. 이 API가:
   a) code를 네이버 서버에 보내 access_token으로 교환 (Client Secret 필요 — 반드시 서버에서만)
   b) 그 access_token으로 네이버 프로필(이메일) 조회
   c) 이메일로 Supabase 사용자를 새로 만들거나(이미 있으면 그대로 진행)
   d) 그 사용자용 "매직링크" 토큰을 발급해서 프론트에 돌려줌
5. 프론트가 그 토큰으로 supabase.auth.verifyOtp()를 호출해서 진짜 로그인 세션을 완성

⚠️ 필요한 환경변수: NAVER_CLIENT_ID, NAVER_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
⚠️ 네이버 디벨로퍼스 콘솔에 등록해야 하는 Callback URL은 프론트가 실제 배포된 도메인의 루트
   (예: https://krasia-eventhub-eventhub2.vercel.app/) 이어야 한다 (10-auth.js의 NAVER_REDIRECT_URI와 정확히 일치해야 함).
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_admin_create_user, sb_admin_generate_magiclink


def _naver_request(url, timeout=10):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (EventHub-Bot)"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read())


def _extract_token_hash(link_data):
    """generate_link 응답에서 token_hash를 뽑아낸다.
    Supabase 버전에 따라 필드명이 hashed_token / token_hash 등으로 다를 수 있어서,
    직접 필드 + action_link URL 파싱까지 순서대로 시도해서 최대한 안전하게 뽑는다."""
    for key in ("hashed_token", "token_hash", "email_otp"):
        if link_data.get(key):
            return link_data[key]
    action_link = link_data.get("action_link") or link_data.get("properties", {}).get("action_link", "")
    if action_link:
        parsed = urllib.parse.urlparse(action_link)
        qs = urllib.parse.parse_qs(parsed.query)
        for key in ("token_hash", "token"):
            if qs.get(key):
                return qs[key][0]
    return None


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(content_length))
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        code = data.get("code")
        if not code:
            self._send_json(400, {"error": "code가 필요합니다."})
            return

        client_id = os.environ.get("NAVER_CLIENT_ID", "")
        client_secret = os.environ.get("NAVER_CLIENT_SECRET", "")
        redirect_uri = data.get("redirectUri", "")
        if not client_id or not client_secret:
            self._send_json(500, {"error": "네이버 로그인 환경변수(NAVER_CLIENT_ID/SECRET)가 설정되지 않았습니다."})
            return

        try:
            # 1) 인가코드 → 액세스 토큰
            token_url = (
                "https://nid.naver.com/oauth2.0/token"
                f"?grant_type=authorization_code&client_id={urllib.parse.quote(client_id)}"
                f"&client_secret={urllib.parse.quote(client_secret)}"
                f"&code={urllib.parse.quote(code)}"
                f"&redirect_uri={urllib.parse.quote(redirect_uri)}"
            )
            token_data = _naver_request(token_url)
            access_token = token_data.get("access_token")
            if not access_token:
                self._send_json(400, {"error": f"네이버 토큰 발급 실패: {token_data.get('error_description', '알 수 없는 오류')}"})
                return

            # 2) 액세스 토큰 → 프로필(이메일)
            profile_req = urllib.request.Request(
                "https://openapi.naver.com/v1/nid/me",
                headers={"Authorization": f"Bearer {access_token}"},
            )
            with urllib.request.urlopen(profile_req, timeout=10) as res:
                profile_data = json.loads(res.read())

            if profile_data.get("resultcode") != "00":
                self._send_json(400, {"error": "네이버 프로필 조회에 실패했어요."})
                return

            naver_profile = profile_data.get("response", {})
            email = naver_profile.get("email")
            name = naver_profile.get("name", "")
            naver_id = naver_profile.get("id", "")

            if not email:
                # 네이버 계정에 이메일 제공 동의를 안 한 경우 (네이버 앱 설정에서 이메일을 필수로 안 걸어뒀을 때 발생 가능)
                self._send_json(400, {"error": "네이버 계정에서 이메일 제공에 동의해주셔야 로그인할 수 있어요."})
                return

            # 3) Supabase 사용자 생성 시도 (이미 있으면 실패하는 게 정상 — 그 경우는 무시하고 계속 진행)
            try:
                sb_admin_create_user(email, user_metadata={"name": name, "provider": "naver", "naver_id": naver_id})
            except Exception as e:
                if "already" not in str(e).lower() and "exists" not in str(e).lower() and "registered" not in str(e).lower():
                    raise  # '이미 가입된 사용자' 계열 오류가 아니면 진짜 문제이므로 그대로 올린다

            # 4) 매직링크 토큰 발급 (이 시점엔 사용자가 반드시 존재함 — 방금 만들었거나 원래 있었거나)
            link_data = sb_admin_generate_magiclink(email)
            token_hash = _extract_token_hash(link_data)
            if not token_hash:
                self._send_json(500, {"error": "로그인 토큰 생성에 실패했어요. 다시 시도해주세요."})
                return

            self._send_json(200, {"success": True, "email": email, "tokenHash": token_hash})

        except Exception as e:
            self._send_json(500, {"error": f"네이버 로그인 처리 중 오류: {e}"})

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)