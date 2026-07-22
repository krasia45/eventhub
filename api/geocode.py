"""
POST /api/geocode
body: { key, query }

admin.html 승인 화면에서 입력한 주소/장소명을 좌표(lat/lng)로 변환합니다.

⚠️ 카카오맵 JS SDK(브라우저에서 직접 로드)는 카카오 개발자 콘솔에 배포 도메인이
정확히 등록돼 있어야만 동작합니다. 그 등록 여부와 무관하게 안정적으로 쓰기 위해,
여기서는 서버에서 카카오 로컬 REST API(주소 검색 + 키워드/장소 검색)를 직접 호출합니다.
REST API 키는 JS 키와 별개이며, 브라우저 도메인 등록이 필요 없습니다.

KAKAO_REST_API_KEY는 Vercel 환경변수로 설정하세요.
(카카오 디벨로퍼스 → 내 애플리케이션 → 해당 앱 선택 → 앱 키 → "REST API 키")
"""

from http.server import BaseHTTPRequestHandler
import json
import os
import re
import urllib.request
import urllib.error
import urllib.parse


def check_admin_key(provided_key):
    real_key = os.environ.get("ADMIN_SECRET", "")
    return bool(real_key) and provided_key == real_key


def strip_detail_suffix(address):
    """"1층", "지하1층", "302호"처럼 뒤에 붙은 상세정보는 지오코딩 정확도를 떨어뜨리는
    경우가 많아, 원본으로 실패하면 이걸 뗀 버전으로 한 번 더 시도하기 위한 정제 함수."""
    cleaned = re.sub(r"\s*(지하)?\s*\d+\s*층\s*$", "", address)
    cleaned = re.sub(r"\s*\d+\s*호\s*$", "", cleaned)
    cleaned = re.sub(r",\s*$", "", cleaned)
    return cleaned.strip()


def kakao_local_search(path, query, rest_key, timeout=6):
    """카카오 로컬 API(주소 검색 또는 키워드 검색) 호출 후 documents 배열 반환."""
    url = f"https://dapi.kakao.com/v2/local/{path}?{urllib.parse.urlencode({'query': query})}"
    req = urllib.request.Request(url, headers={"Authorization": f"KakaoAK {rest_key}"})
    with urllib.request.urlopen(req, timeout=timeout) as res:
        data = json.loads(res.read().decode("utf-8"))
    return data.get("documents", [])


class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            self._handle_post()
        except Exception as e:
            self._send_json(500, {"error": f"예상치 못한 오류가 발생했어요: {str(e)}"})

    def _handle_post(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body)
        except Exception:
            self._send_json(400, {"error": "잘못된 요청 형식입니다."})
            return

        if not check_admin_key(data.get("key", "")):
            self._send_json(401, {"error": "관리자 인증이 필요합니다."})
            return

        query = (data.get("query") or "").strip()
        if not query:
            self._send_json(400, {"error": "주소 또는 장소명을 입력해주세요."})
            return

        rest_key = os.environ.get("KAKAO_REST_API_KEY", "")
        if not rest_key:
            self._send_json(500, {
                "error": "KAKAO_REST_API_KEY가 설정되지 않았습니다. "
                         "카카오 디벨로퍼스에서 REST API 키를 발급받아 Vercel 환경변수로 등록해주세요."
            })
            return

        cleaned = strip_detail_suffix(query)
        # 순서를 유지하면서 중복(원본==정제본인 경우) 제거
        candidates = list(dict.fromkeys([q for q in (query, cleaned) if q]))

        try:
            # 1차: 도로명/지번 주소 검색 (원본 → 상세정보 뗀 버전 순서로 시도)
            for q in candidates:
                docs = kakao_local_search("search/address.json", q, rest_key)
                if docs:
                    self._send_json(200, {
                        "lat": float(docs[0]["y"]), "lng": float(docs[0]["x"]),
                        "matchedQuery": q, "method": "address",
                    })
                    return

            # 2차: 상호명/장소명 키워드 검색 (예: "티팩토리 성수")
            for q in candidates:
                docs = kakao_local_search("search/keyword.json", q, rest_key)
                if docs:
                    self._send_json(200, {
                        "lat": float(docs[0]["y"]), "lng": float(docs[0]["x"]),
                        "matchedQuery": q, "method": "keyword",
                    })
                    return

            self._send_json(404, {
                "error": f"주소/장소를 찾을 수 없습니다. (시도한 검색어: {', '.join(candidates)})"
            })

        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="ignore")[:200]
            if e.code == 401:
                self._send_json(502, {"error": "카카오 REST API 키가 유효하지 않습니다. KAKAO_REST_API_KEY 값을 확인해주세요."})
            else:
                self._send_json(502, {"error": f"카카오 API 오류 ({e.code}): {detail}"})
        except Exception as e:
            self._send_json(500, {"error": f"지오코딩 중 오류가 발생했어요: {str(e)}"})

    def _send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)