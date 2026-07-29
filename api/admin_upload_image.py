"""
POST /api/admin_upload_image
body: { key, filename, contentType, base64Data }

관리자페이지에서 이미지 파일을 선택하면, base64로 인코딩해서 이 API로 보낸다.
Supabase Storage("event-images" 버킷, public)에 업로드하고 공개 URL을 리턴한다.
이 URL을 그대로 "대표이미지"/"상세페이지 이미지" 입력칸에 자동으로 채워 넣으면 된다.

⚠️ Vercel 서버리스 함수는 요청 본문 크기 제한(약 4.5MB)이 있다. base64로 인코딩하면
   원본보다 약 33% 커지므로, 원본 파일 기준 최대 3MB까지만 허용한다(넉넉하게 잡되
   제한을 넘으면 사용자에게 "사진 용량을 줄여달라"고 명확히 안내한다).
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import sys
import base64
import re
import time

sys.path.insert(0, os.path.dirname(__file__))
from _supabase_client import sb_storage_upload

MAX_FILE_BYTES = 3 * 1024 * 1024  # 3MB
BUCKET = "event-images"
ALLOWED_EXT = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}


def check_admin_key(provided_key):
    real_key = os.environ.get("ADMIN_SECRET", "")
    return bool(real_key) and provided_key == real_key


def safe_filename(original_name, content_type):
    """업로드 경로에 쓸 안전한 파일명 생성 — 한글/공백/특수문자가 섞여 있어도
    Storage 경로로 문제없이 쓸 수 있게 영문/숫자만 남기고, 타임스탬프로 충돌을 방지한다."""
    ext = ALLOWED_EXT.get(content_type)
    if not ext:
        base = os.path.splitext(original_name or "")[1].lstrip(".").lower()
        ext = base if base in ("jpg", "jpeg", "png", "webp", "gif") else "jpg"
    stamp = str(int(time.time() * 1000))
    return f"{stamp}.{ext}"


class handler(BaseHTTPRequestHandler):

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            data = json.loads(raw)
        except Exception:
            self._send_json(400, {"error": "요청 형식이 올바르지 않습니다."})
            return

        key = data.get("key", "")
        if not check_admin_key(key):
            self._send_json(401, {"error": "관리자 인증이 필요합니다."})
            return

        content_type = (data.get("contentType") or "").strip()
        filename = (data.get("filename") or "").strip()
        base64_data = data.get("base64Data") or ""

        if content_type not in ALLOWED_EXT:
            self._send_json(400, {"error": "jpg/png/webp/gif 형식의 이미지만 업로드할 수 있어요."})
            return

        # data:image/jpeg;base64,xxxxx 형태로 오면 접두사를 떼어낸다
        base64_data = re.sub(r"^data:[^;]+;base64,", "", base64_data)

        try:
            file_bytes = base64.b64decode(base64_data)
        except Exception:
            self._send_json(400, {"error": "이미지 데이터를 읽을 수 없어요."})
            return

        if len(file_bytes) > MAX_FILE_BYTES:
            size_mb = round(len(file_bytes) / 1024 / 1024, 1)
            self._send_json(400, {"error": f"파일이 너무 커요({size_mb}MB). 3MB 이하로 줄여서 다시 시도해주세요."})
            return

        path = safe_filename(filename, content_type)
        try:
            public_url = sb_storage_upload(BUCKET, path, file_bytes, content_type)
        except Exception as e:
            self._send_json(500, {"error": f"업로드 중 오류: {str(e)}"})
            return

        self._send_json(200, {"success": True, "url": public_url})

    def _send_json(self, status, payload):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))