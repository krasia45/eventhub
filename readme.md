# 🌟 EventHub (이벤트허브)

흩어진 모든 대형 브랜드 할인 및 프로모션 이벤트를 한곳에 모아 큐레이션하고, 구글 제미나이(Gemini) AI를 통해 맞춤형 혜택을 추천받을 수 있는 스마트 쇼핑 웹 서비스입니다.

---

## 🚀 배포 주소 (Live Demo)
* **Production URL:** [https://krasia-eventhub-3cjk2lbml-eventhub2.vercel.app](https://krasia-eventhub-3cjk2lbml-eventhub2.vercel.app)

---

## 🛠️ 기술 스택 (Tech Stack)
* **Frontend:** 순수 HTML5, CSS3 (CSS Variables, Flexbox, Media Query), Vanilla JavaScript (ES6+)
* **Backend:** Vercel Serverless Functions (Python)
* **AI Model:** Google Gemini API (`gemini-2.5-flash`)
* **Database & Notification:** Google Sheets (Apps Script Webhook) 연동을 통한 문의 데이터 저장 및 Gmail 자동 알림 발송
* **Deployment:** Vercel

---

## ✨ 주요 기능 및 과제 충족 사항

1. **브랜드별 토탈 큐레이션 및 분야별 랭킹 섹션 (필수)**
   * 패션, 뷰티, 푸드, 전자기기 등 카테고리별 실시간 인기 브랜드 이벤트 랭킹 및 피드 제공
   * 모바일 우선 반응형 카드 UI 및 바텀 시트(Bottom Sheet) 상세 팝업 구현
2. **AI 맞춤형 이벤트 추천 기능 (핵심)**
   * 사용자의 상황 및 관심사(예: "자취생 식비 절약")를 입력하면 파이썬 서버리스 API를 통해 Gemini AI가 맞춤 혜택과 이벤트 가이드를 실시간 반환
3. **고객센터 문의하기 및 Gmail 알림 (보너스 과제 1)**
   * 1:1 문의 폼 작성 시 데이터를 Google Sheets에 안전하게 비동기 저장 및 화면 표시
   * Google Apps Script 기반 웹훅을 통해 관리자 지메일(Gmail)로 실시간 이메일 알림 전송
4. **다크 모드 및 로컬 스토리지 연동 (보너스 과제 2)**
   * 시스템 OS 설정 연동 및 수동 전환이 가능한 Day/Night 테마 토글 버튼 (`localStorage` 상태 저장)
  
# [EventHub] 프로젝트 최종 검증 및 서비스 기획서

## 1. 서비스 개요
* **서비스 명:** EventHub (이벤트허브)
* **서비스 목적:** 브랜드별 프로모션과 할인을 직관적인 큐레이션과 랭킹으로 제공하며, AI를 통해 개인별 맞춤 소비 가이드를 제시하는 알뜰 쇼핑 플랫폼.
* **타겟 사용자:** 일일이 브랜드 앱을 켜기 번거로운 스마트 쇼핑족 및 효율적 소비를 지향하는 소비자.

## 2. 페이지 및 섹션 구성 (3개 이상 충족)
1. **메인 홈 및 카테고리 랭킹 섹션:** 8가지 카테고리 탭과 실시간 인기 브랜드 랭킹 리스트.
2. **이벤트 피드 및 상세 바텀 시트(Modal):** 브랜드별 할인 정보 카드 및 쿠폰 다운로드/관심 등록 인터페이스.
3. **AI 추천 큐레이터 및 고객센터(문의하기) 섹션:** 사용자 상황 입력에 따른 Gemini AI 추천 영역 및 데이터 연동 문의 폼.

## 3. 핵심 및 보너스 과제 구현 세부 내역
* **AI 연동:** Vercel Python Serverless Function(`api/recommend.py`)을 활용해 보안이 유지된 상태로 Gemini API 연동 완료.
* **보너스 1 (데이터 저장 & 알림):** 문의 폼 데이터를 Google Sheets에 실시간 적재하고, Apps Script 트리거를 통해 관리자 Gmail로 알림 메일 발송 구현.
* **보너스 2 (UX 고도화):** CSS 변수와 `localStorage`를 활용한 완벽한 다크모드 및 반응형 모바일/데스크톱 레이아웃 구축.

---

## 📚 개발 과정 요약

1. 서비스 기획 및 뼈대 만들기 (HTML / CSS / JavaScript)
* **아이디어 정의**: 대형 브랜드와 소상공인의 할인 및 프로모션 이벤트를 한곳에 모아 보여주는 'EventHub' 서비스를 기획했습니다.
* **HTML 구조화 (index.html)**: 웹페이지의 뼈대를 잡는 단계입니다. 메인 홈, 카테고리별/분야별 랭킹 섹션, AI 추천 입력창, 고객센터 문의하기 폼 등 최소 3개 이상의 구역을 나누어 구성했습니다.
* **CSS 디자인 (style.css)**: 오렌지 컬러 포인트를 주고, 모바일 기기와 데스크톱 모두에서 레이아웃이 깨지지 않도록 반응형 디자인(Media Query)을 적용했습니다. 또한, 사용자의 편의를 위해 다크 모드(Dark Mode) 기능을 추가했습니다.
* **JavaScript 동적 제어 (main.js)**: 사용자가 버튼을 누르거나 카테고리 탭을 바꿨을 때 화면이 실시간으로 바뀌도록 동작을 구현했습니다. 사용자의 다크모드 설정 등을 브라우저에 저장하는 localStorage 기능도 함께 묶었습니다.

2. 백엔드와 AI 기능 연동 (Vercel Serverless Functions & Python)
* **서버리스 파이썬 구현 (api/recommend.py)**: 프론트엔드와 통신하기 위해 Vercel의 서버리스 함수 기능을 활용해 파이썬 백엔드 코드를 작성했습니다.
* **Google Gemini API 결합**: 사용자가 관심사를 입력하면 자바스크립트의 fetch 함수가 파이썬 서버리스 엔드포인트로 요청을 보내고, 백엔드에서 안전하게 관리되는 환경 변수(GEMINI_API_KEY)를 통해 Gemini 모델을 호출한 뒤 결과를 화면에 출력하도록 만들었습니다.

3. 운영 자동화 및 알림 시스템 구축 (Google Sheets & Gmail)
* **문의하기 폼 연동**: 사용자가 웹페이지 내 고객센터/문의하기를 통해 메시지를 남기면, 해당 데이터가 외부 저장소인 Google Sheets에 자동으로 쌓이도록 설정했습니다.
* **Gmail 알림 발송**: 새로운 문의 데이터가 구글 시트에 들어오는 순간, 자동 트리거(Apps Script 웹훅)가 작동하여 관리자의 지메일(Gmail)로 실시간 알림 메일이 발송되는 운영 자동화 프로세스를 완성했습니다.

4. 배포 및 검증 (Vercel)
* **GitHub 연동 배포**: 작성한 코드를 깃허브(GitHub) 저장소에 올리고, Vercel과 연동하여 전 세계 누구나 접속할 수 있는 실제 URL 배포를 마쳤습니다. 에러가 발생했을 때 이전 커밋으로 되돌리거나 환경 변수를 재설정하는 등의 유지보수 과정을 거쳐 현재의 안정적인 웹 서비스를 완성했습니다.
