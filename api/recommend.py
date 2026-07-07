# api/recommend.py
# Vercel Serverless Function — Python Handler
# 
# Vercel은 이 파일을 자동으로 "/api/recommend" 엔드포인트로 등록해줘요.
# 함수 이름은 반드시 "handler"여야 하고, request/response 객체를 다뤄요.

import json
import os
import urllib.request   # 표준 라이브러리만 사용 (외부 패키지 최소화)
import urllib.error

# ── 환경변수에서 API 키 읽기 ──────────────────────────────────────────────
# 절대로 키를 코드에 직접 쓰지 마세요!
# Vercel 대시보드 → Settings → Environment Variables 에서 등록합니다.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")


def handler(request, response):
    """
    Vercel Python Serverless Function 진입점.
    
    [요청] POST /api/recommend
           Body: { "query": "자취생 식비 절약" }
    
    [응답] 200 OK
           Body: { "result": "AI가 생성한 추천 텍스트" }
    
    [오류] 400 / 500
           Body: { "error": "오류 메시지" }
    """

    # ── CORS 헤더 설정 ────────────────────────────────────────────────────
    # 브라우저가 다른 도메인(프론트엔드)에서 이 API를 호출할 수 있도록 허용
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Content-Type"] = "application/json"

    # OPTIONS 요청(브라우저 사전 확인)은 빈 200으로 응답
    if request.method == "OPTIONS":
        response.status_code = 200
        return response.end("{}")

    # ── POST 요청만 허용 ──────────────────────────────────────────────────
    if request.method != "POST":
        response.status_code = 405
        return response.end(json.dumps({"error": "POST 요청만 허용됩니다."}))

    # ── 요청 바디 파싱 ────────────────────────────────────────────────────
    try:
        # request.body 는 bytes → decode → JSON 파싱
        body_bytes = request.body
        body_str = body_bytes.decode("utf-8") if isinstance(body_bytes, bytes) else body_bytes
        body = json.loads(body_str)
        user_query = body.get("query", "").strip()
    except (json.JSONDecodeError, AttributeError):
        response.status_code = 400
        return response.end(json.dumps({"error": "요청 형식이 잘못되었습니다."}))

    # ── 빈 입력값 검증 ────────────────────────────────────────────────────
    if not user_query:
        response.status_code = 400
        return response.end(json.dumps({"error": "검색어를 입력해주세요."}))

    # ── API 키 존재 확인 ──────────────────────────────────────────────────
    if not OPENAI_API_KEY:
        response.status_code = 500
        return response.end(json.dumps({"error": "서버 설정 오류: API 키가 없습니다."}))

    # ── OpenAI API 호출 ───────────────────────────────────────────────────
    try:
        ai_result = call_openai(user_query)
        response.status_code = 200
        return response.end(json.dumps({"result": ai_result}, ensure_ascii=False))

    except TimeoutError:
        response.status_code = 504
        return response.end(json.dumps({"error": "AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요."}))

    except Exception as e:
        # 예상치 못한 오류는 로그에만 남기고 사용자에게는 일반 메시지 전달
        print(f"[ERROR] OpenAI 호출 실패: {e}")
        response.status_code = 500
        return response.end(json.dumps({"error": "AI 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요."}))


def call_openai(user_query: str) -> str:
    """
    OpenAI Chat Completions API를 호출해서 추천 텍스트를 반환합니다.
    urllib만 사용 (requests 라이브러리 불필요 → Vercel 환경에서 안전)
    """

    # 시스템 프롬프트: AI에게 역할과 출력 형식을 지정
    system_prompt = """당신은 대한민국 최고의 쇼핑 혜택 큐레이터입니다.
사용자가 입력한 상황이나 관심사에 딱 맞는 브랜드 이벤트와 할인 혜택을 추천해주세요.

[출력 규칙]
- 반드시 한국어로 답변하세요.
- 2~3개의 구체적인 브랜드/이벤트를 추천하세요.
- 각 추천에는 브랜드명, 혜택 내용, 한 줄 이유를 포함하세요.
- 전체 답변은 150자 이내로 간결하게 작성하세요.
- 이모지를 적절히 활용해 읽기 쉽게 만드세요.

[출력 예시]
🛒 쿠팡 로켓배송 — 식료품 5% 적립 | 자취생 장보기에 딱!
☕ 스타벅스 — 음료 1+1 (화~목) | 카페 비용 절반으로!"""

    # API 요청 데이터 구성
    payload = {
        "model": "gpt-4o-mini",   # 비용 효율적인 모델 선택
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"상황: {user_query}"}
        ],
        "max_tokens": 300,         # 응답 길이 제한 (비용 절감)
        "temperature": 0.7         # 창의성 수준 (0=일관성, 1=창의적)
    }

    # HTTP 요청 준비
    url = "https://api.openai.com/v1/chat/completions"
    data = json.dumps(payload).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {OPENAI_API_KEY}"
        },
        method="POST"
    )

    # 타임아웃 8초 설정 (Vercel 함수 제한 고려)
    try:
        with urllib.request.urlopen(req, timeout=8) as res:
            result = json.loads(res.read().decode("utf-8"))
            # OpenAI 응답 구조: choices[0].message.content
            return result["choices"][0]["message"]["content"].strip()

    except urllib.error.HTTPError as e:
        # OpenAI API 자체 오류 (401 인증실패, 429 한도초과 등)
        error_body = e.read().decode("utf-8")
        print(f"[OpenAI HTTPError] {e.code}: {error_body}")
        if e.code == 401:
            raise Exception("API 키 인증 실패")
        elif e.code == 429:
            raise Exception("API 사용 한도 초과")
        else:
            raise Exception(f"OpenAI 오류: {e.code}")

    except TimeoutError:
        raise TimeoutError("응답 시간 초과")