# ResearchBot - AI 논문 분석 챗봇 MVP

## 📋 프로젝트 개요

**ResearchBot**은 논문 PDF를 업로드하고 AI와 대화하며 논문 내용을 분석할 수 있는 RAG(Retrieval-Augmented Generation) 기반 챗봇입니다.

## 🚀 주요 기능

- **📄 PDF 업로드**: 논문 PDF 파일을 드래그 앤 드롭으로 업로드
- **🤖 AI 대화**: 업로드된 논문에 대해 질문하고 AI 답변 받기
- **🔍 출처 제공**: 답변의 출처 정보(페이지, 섹션) 자동 제공
- **📚 기존 파일 관리**: 업로드 폴더의 기존 PDF 파일 목록 표시
- **💡 샘플 질문**: 논문 분석을 위한 유용한 샘플 질문 제공

## 🏗️ 기술 스택

### Backend
- **FastAPI**: Python 웹 프레임워크
- **Upstage AI**: 한국의 AI 서비스 (Solar 모델)
- **ChromaDB**: 벡터 데이터베이스
- **PyPDF2**: PDF 텍스트 추출
- **LangChain**: LLM 애플리케이션 프레임워크

### Frontend
- **React 18**: 사용자 인터페이스
- **TypeScript**: 타입 안전성
- **Tailwind CSS**: 스타일링
- **shadcn/ui**: UI 컴포넌트
- **React Query**: 데이터 페칭 및 상태 관리

## 🛠️ 설치 및 실행

### 1. 프로젝트 클론
```bash
git clone <repository-url>
cd vibe_coding_RAG
```

### 2. Backend 설정
```bash
cd backend
pip install -r requirements.txt
cp env.example .env
# .env 파일에서 Upstage AI API 키 설정
```

### 3. Frontend 설정
```bash
cd frontend
npm install
```

### 4. 서버 실행
```bash
# Backend (새 터미널)
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Frontend (새 터미널)
cd frontend
npm run dev
```

## ⚙️ 환경 변수 설정

### Backend (.env)
```env
# Upstage AI API 설정
UPSTAGE_API_KEY=your_upstage_api_key_here
UPSTAGE_BASE_URL=https://api.upstage.ai

# CORS 설정
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# 파일 업로드 설정
MAX_FILE_SIZE=52428800
UPLOAD_DIR=./uploads
CHROMADB_PERSIST_DIRECTORY=./chroma_db

# API 설정
API_PREFIX=/api
DEBUG=true

# LLM 모델 설정
LLM_MODEL=solar-1-mini
EMBEDDING_MODEL=solar-embedding-1-mini

# Mock 모드 설정 (Upstage AI API 할당량 부족 시 true로 설정)
USE_MOCK_MODE=false
```

## 🔧 Mock 모드

API 할당량이 부족하거나 테스트 목적으로 Mock 모드를 사용할 수 있습니다:

```env
USE_MOCK_MODE=true
```

Mock 모드에서는:
- 실제 Upstage AI API 호출 없이 테스트 가능
- 가상의 논문 분석 응답 제공
- 기존 PDF 파일과의 대화 지원

## 📱 사용법

### 1. 홈페이지 접속
- `http://localhost:3000` 접속
- 기존 PDF 파일 목록 확인

### 2. PDF 업로드
- "PDF 업로드" 메뉴 클릭
- PDF 파일을 드래그 앤 드롭
- 처리 완료까지 대기

### 3. AI와 대화
- "채팅 시작" 클릭
- 논문 내용에 대해 질문
- AI 답변과 출처 정보 확인

### 4. 샘플 질문 활용
- 제공되는 샘플 질문 클릭
- 논문 분석을 위한 가이드 활용

## 🏛️ 시스템 아키텍처

```
Frontend (React) ←→ Backend (FastAPI) ←→ Upstage AI API
                           ↓
                    ChromaDB (Vector DB)
                           ↓
                    PDF Processing Pipeline
```

## 🔍 API 엔드포인트

- 인증/계정
- `POST /api/auth/register`: 회원가입
- `POST /api/auth/login`: 로그인 (JWT 발급)
- `GET /api/auth/me`: 내 프로필 조회 (인증 필요)
- `POST /api/auth/logout`: 로그아웃
- 
- `GET /api/documents/existing`: 기존 PDF 파일 목록
- `POST /api/documents/upload`: PDF 업로드
- `POST /api/documents/upload-multiple`: 다중 PDF 업로드
- `GET /api/documents/{id}/status`: 처리 상태 확인
- `POST /api/chat/{id}`: 채팅 메시지 전송
- `POST /api/chat/multi`: 멀티 문서 채팅 메시지 전송
- `GET /api/chat/{session_id}/history`: 채팅 히스토리
- `GET /api/chat/{id}/sample-questions`: 샘플 질문
- `DELETE /api/documents/{id}`: 문서 삭제
\- `GET /api/documents/{id}/logs`: 문서 처리 로그 조회
\- `POST /api/admin/refresh-document-status`: 문서 상태 동기화

## 🎯 개발 일정

- **Day 1**: 프로젝트 설정, Backend API 개발
- **Day 2**: Frontend UI 개발, 통합 테스트

## 🚧 제한사항 (MVP)

- 단일 사용자 환경
- 인메모리 세션 관리
- 기본적인 PDF 텍스트 추출
- 제한된 파일 크기 (50MB)

## 🔮 향후 개선 계획

- 사용자 계정 및 인증 시스템
- 대화 히스토리 영구 저장
- 다국어 지원 확대
- 모바일 최적화
- 고급 PDF 처리 (수식, 도표)
- 협업 기능

## 📄 라이선스

MIT License

## 👥 기여

이슈 리포트 및 풀 리퀘스트 환영합니다!

---

**ResearchBot**으로 논문 분석을 더욱 쉽고 효율적으로 만들어보세요! 🚀

## 📝 오늘의 변경사항

날짜: 2025-09-04

- 멀티문서 채팅 500 오류 수정: `ChatResponse` 객체를 딕셔너리처럼 접근하던 코드를 객체 접근(`response.response`, `response.sources`)으로 수정
- Pydantic 경고 제거: `source.dict()` → `source.model_dump()`로 변경 (Pydantic v2 권장 방식)
- 멀티문서 채팅 라우팅 충돌 해결: `/api/chat/multi` 엔드포인트를 `/api/chat/{document_id}` 보다 먼저 선언하여 404/매칭 오류 방지
- 프런트엔드 멀티문서 헤더 표시 수정: 선택한 모든 문서명이 채팅 헤더에 표시되도록 로직 보완
- 멀티문서 전송 404 수정: 프런트 `?documents=id1&documents=id2` 쿼리 구성 및 백엔드 라우팅 정합성 확보
- 다중 파일 업로드 지원: 클라이언트 드롭존·업로드 UI 및 서버 업로드 API(`POST /api/documents/upload-multiple`) 추가
- 중복 파일 제외 로직: 파일명/체크섬 기반 중복 탐지 및 스킵 처리
- 처리 상태 동기화 개선: 서버 재기동 후 `pending` 고착 방지를 위한 상태 초기화 및 수동 동기화 API 추가(`POST /api/admin/refresh-document-status`)
- 처리 로그 조회 API 추가: 업로드 진행 화면에서 서버 로그를 하단에 표시 가능(`GET /api/documents/{id}/logs`)

검증 방법
- 멀티선택 후 "분석" → `/api/chat/multi` 200 OK 확인, 응답에 선택 문서 수 표기
- 업로드 화면에서 여러 PDF 드래그앤드롭 → 중복 파일은 제외 메시지 확인, 상태 및 로그 표시 확인
- 서버 재기동 후 문서 상태가 정상적으로 복구되는지 확인

참고 사항
- 프런트 인증 우회(데모): `/chat?demo=true` 접근 가능
- 백엔드 실행은 conda `py311` 환경에서 진행 권장
