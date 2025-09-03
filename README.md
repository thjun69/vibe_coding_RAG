# ResearchBot - AI 논문 분석 챗봇

기업 R&D 엔지니어를 위한 AI 논문 분석 챗봇 MVP입니다. PDF 논문을 업로드하여 AI와 대화형으로 분석할 수 있습니다.

## 주요 기능

- 📄 PDF 논문 드래그 앤 드롭 업로드
- 🤖 AI 챗봇과 논문 내용 질문-답변
- 📍 정확한 출처 정보 제공 (페이지, 섹션)
- 💬 대화 히스토리 저장
- 📱 반응형 웹 인터페이스

## 기술 스택

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python 3.11
- **Vector DB**: ChromaDB
- **LLM**: OpenAI GPT-3.5-turbo
- **Embedding**: OpenAI text-embedding-ada-002

## 빠른 시작

### 1. 저장소 클론
```bash
git clone <repository-url>
cd vibe_coding_RAG
```

### 2. Backend 설정
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# .env 파일에 OPENAI_API_KEY 설정
uvicorn main:app --reload
```

### 3. Frontend 설정
```bash
cd frontend
npm install
npm run dev
```

### 4. 브라우저에서 접속
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000

## 사용법

1. 웹사이트에 접속
2. PDF 논문 파일을 드래그 앤 드롭으로 업로드
3. 문서 처리 완료 대기 (약 30초)
4. 논문에 대한 질문 입력
5. AI 답변과 출처 정보 확인

## 개발 일정

- **Day 1**: Backend API 및 PDF 처리 파이프라인
- **Day 2**: Frontend UI 및 통합 테스트

## 라이선스

MIT License
