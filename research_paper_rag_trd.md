# 논문 PDF RAG 챗봇 MVP - TRD

## 1. 시스템 아키텍처

### 1.1 전체 아키텍처
```
[Frontend (React)] ↔ [Backend API (FastAPI)] ↔ [Vector DB (ChromaDB)] 
                              ↕
                     [LLM API (OpenAI GPT-3.5)]
                              ↕
                     [PDF Processing (PyPDF2)]
```

### 1.2 기술 스택

#### Frontend
- **Framework**: React 18 + TypeScript
- **UI Library**: Tailwind CSS + shadcn/ui
- **State Management**: React Query (TanStack Query)
- **File Upload**: react-dropzone
- **HTTP Client**: Axios

#### Backend
- **Framework**: FastAPI (Python 3.11)
- **PDF Processing**: PyPDF2 + langchain
- **Vector Database**: ChromaDB (embedded mode)
- **Text Embedding**: OpenAI text-embedding-ada-002
- **LLM**: OpenAI GPT-3.5-turbo
- **Text Chunking**: langchain RecursiveCharacterTextSplitter

#### Infrastructure
- **Deployment**: Vercel (Frontend) + Railway/Render (Backend)
- **File Storage**: 임시 로컬 스토리지 (세션 기반)
- **Environment**: Docker 컨테이너

## 2. 데이터 모델링

### 2.1 Document Schema
```json
{
  "document_id": "uuid4",
  "filename": "string",
  "upload_timestamp": "datetime",
  "total_pages": "integer",
  "processing_status": "enum[processing, completed, error]",
  "chunks": [
    {
      "chunk_id": "uuid4",
      "content": "string",
      "page_number": "integer",
      "section": "string",
      "embedding": "vector[1536]"
    }
  ]
}
```

### 2.2 Chat Session Schema
```json
{
  "session_id": "uuid4",
  "document_id": "uuid4",
  "messages": [
    {
      "role": "enum[user, assistant]",
      "content": "string",
      "timestamp": "datetime",
      "sources": [
        {
          "chunk_id": "uuid4",
          "page_number": "integer",
          "section": "string",
          "relevance_score": "float"
        }
      ]
    }
  ]
}
```

## 3. API 명세

### 3.1 File Upload API
```
POST /api/documents/upload
Content-Type: multipart/form-data

Request:
- file: PDF file (max 50MB)

Response:
{
  "document_id": "uuid4",
  "filename": "example.pdf",
  "status": "processing",
  "estimated_processing_time": "30s"
}
```

### 3.2 Processing Status API
```
GET /api/documents/{document_id}/status

Response:
{
  "document_id": "uuid4",
  "status": "completed",
  "total_pages": 15,
  "total_chunks": 45,
  "error_message": null
}
```

### 3.3 Chat API
```
POST /api/chat/{document_id}

Request:
{
  "message": "이 연구의 주요 기여점은 무엇인가요?",
  "session_id": "uuid4" // optional
}

Response:
{
  "session_id": "uuid4",
  "response": "이 연구의 주요 기여점은...",
  "sources": [
    {
      "page_number": 3,
      "section": "Conclusion",
      "content_snippet": "Our main contributions are...",
      "relevance_score": 0.95
    }
  ],
  "processing_time": "2.3s"
}
```

### 3.4 Chat History API
```
GET /api/chat/{session_id}/history

Response:
{
  "session_id": "uuid4",
  "messages": [...],
  "document_info": {
    "filename": "example.pdf",
    "total_pages": 15
  }
}
```

## 4. 핵심 컴포넌트 구현

### 4.1 PDF Processing Pipeline

```python
class DocumentProcessor:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ".", "!", "?"]
        )
        self.embedding_model = OpenAIEmbeddings(model="text-embedding-ada-002")
    
    async def process_pdf(self, file_path: str, document_id: str):
        # 1. PDF 텍스트 추출
        text_chunks = self.extract_text_with_metadata(file_path)
        
        # 2. 텍스트 분할
        chunks = self.text_splitter.split_documents(text_chunks)
        
        # 3. 임베딩 생성
        embeddings = await self.embedding_model.aembed_documents(chunks)
        
        # 4. Vector DB 저장
        await self.store_in_vectordb(document_id, chunks, embeddings)
```

### 4.2 RAG Query Engine

```python
class RAGQueryEngine:
    def __init__(self, vector_db: ChromaDB, llm: ChatOpenAI):
        self.vector_db = vector_db
        self.llm = llm
    
    async def query(self, document_id: str, question: str) -> RAGResponse:
        # 1. 유사도 검색
        relevant_chunks = await self.vector_db.similarity_search(
            query=question,
            filter={"document_id": document_id},
            k=5
        )
        
        # 2. 컨텍스트 구성
        context = self.build_context(relevant_chunks)
        
        # 3. LLM 답변 생성
        response = await self.llm.ainvoke(
            self.build_prompt(context, question)
        )
        
        # 4. 출처 정보 포함하여 반환
        return RAGResponse(
            answer=response.content,
            sources=self.extract_sources(relevant_chunks)
        )
```

### 4.3 Frontend Components Structure

```typescript
// App.tsx
const App = () => {
  return (
    <QueryClient>
      <div className="min-h-screen bg-gray-50">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/chat/:documentId" element={<ChatPage />} />
          </Routes>
        </main>
      </div>
    </QueryClient>
  );
};

// UploadPage.tsx
const UploadPage = () => {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed'>('idle');
  
  return (
    <div className="max-w-2xl mx-auto">
      <FileDropzone onFileUpload={handleFileUpload} />
      <ProcessingStatus status={uploadStatus} />
    </div>
  );
};

// ChatPage.tsx
const ChatPage = () => {
  const { documentId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  
  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto">
      <DocumentInfo documentId={documentId} />
      <ChatMessages messages={messages} />
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};
```

## 5. 배포 및 인프라

### 5.1 배포 환경

#### Frontend (Vercel)
```yaml
# vercel.json
{
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/index.html"
    }
  ]
}
```

#### Backend (Railway/Render)
```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 5.2 환경 변수
```bash
# Backend Environment Variables
OPENAI_API_KEY=sk-...
CORS_ORIGINS=https://your-frontend.vercel.app
MAX_FILE_SIZE=52428800  # 50MB
CHROMADB_PERSIST_DIRECTORY=./chroma_db
```

### 5.3 데이터 저장 전략
- **임시 파일**: `/tmp` 디렉토리 사용, 세션 종료 시 자동 삭제
- **Vector DB**: ChromaDB embedded mode, 컨테이너 재시작 시 초기화
- **세션 데이터**: 메모리 기반, 서버 재시작 시 초기화

## 6. 성능 최적화

### 6.1 Backend 최적화
- **비동기 처리**: FastAPI + AsyncIO로 동시 요청 처리
- **임베딩 배치**: 여러 청크를 한번에 임베딩 처리
- **캐싱**: 자주 요청되는 유사도 검색 결과 메모리 캐싱
- **청크 크기 최적화**: 1000자 청크 + 200자 오버랩

### 6.2 Frontend 최적화
- **Lazy Loading**: 큰 문서의 경우 메시지 pagination
- **Debouncing**: 타이핑 중 불필요한 API 호출 방지
- **Progressive Enhancement**: 업로드 진행상황 실시간 표시

## 7. 보안 고려사항

### 7.1 데이터 보안
- **파일 검증**: PDF MIME type, 파일 헤더, 파일 크기 검증
- **배치 제한**: 사용자당 동시 배치 처리 수 제한 (최대 3개)
- **임시 저장**: 업로드된 파일은 처리 후 즉시 삭제, 최대 보관 시간 1시간
- **API Rate Limiting**: 동일 IP에서 분당 업로드 10회, 질문 30회 제한
- **Input Sanitization**: 모든 사용자 입력 (파일명, 배치명 등) 검증

### 7.2 API 보안  
- **CORS 설정**: Frontend 도메인만 허용
- **File Upload Security**: 파일 확장자 검증, 바이러스 스캔 (가능시)
- **Error Handling**: 민감한 정보 노출 방지, 일반화된 에러 메시지
- **Request Size Limiting**: 배치 업로드시 총 용량 제한 (500MB)
- **Path Traversal Protection**: 파일 저장시 경로 조작 방지10회 요청 제한

### 7.2 API 보안
- **CORS 설정**: Frontend 도메인만 허용
- **Input Validation**: 모든 사용자 입력 sanitization
- **Error Handling**: 민감한 정보 노출 방지

## 8. 모니터링 및 로깅

### 8.1 로그 수집
```python
import logging

# 구조화된 로깅
logger.info("Document processed", extra={
    "document_id": document_id,
    "pages": total_pages,
    "processing_time": processing_time,
    "chunks_created": len(chunks)
})
```

### 8.2 메트릭 수집
- **처리 시간**: 문서 업로드부터 벡터화 완료까지
- **응답 시간**: 질문 입력부터 답변까지
- **에러율**: 실패한 요청 비율
- **사용 패턴**: 세션당 질문 수, 인기 있는 질문 유형

## 9. 테스트 전략

### 9.1 단위 테스트
```python
# test_document_processor.py
def test_pdf_text_extraction():
    processor = DocumentProcessor()
    text = processor.extract_text("sample.pdf")
    assert len(text) > 0
    assert "expected_content" in text

def test_chunking():
    processor = DocumentProcessor()
    chunks = processor.split_text(sample_text)
    assert len(chunks) > 0
    assert all(len(chunk) <= 1000 for chunk in chunks)
```

### 9.2 통합 테스트
- PDF 업로드 → 처리 → 질문-답변 전체 플로우
- 다양한 PDF 형식 (스캔본, 텍스트 기반) 테스트
- 대용량 파일 처리 테스트

### 9.3 부하 테스트
- 동시 업로드 5개 파일 처리 가능 여부
- 연속 질문 10개 빠른 응답 가능 여부

## 10. 개발 일정 (2일)

### Day 1
**오전 (4시간)**
- 프로젝트 초기 설정
- Backend API 기본 구조 구축
- PDF 처리 파이프라인 구현

**오후 (4시간)**
- Vector DB 연동
- RAG 쿼리 엔진 구현
- 기본 API 테스트

### Day 2
**오전 (4시간)**
- Frontend React 앱 구축
- 파일 업로드 인터페이스
- 채팅 인터페이스 구현

**오후 (4시간)**
- Frontend-Backend 연동
- UI/UX 개선
- 배포 및 테스트

## 11. 리스크 및 대응방안

### 11.1 기술적 리스크
**리스크**: OpenAI API 응답 지연 또는 한도 초과  
**대응**: 
- API 타임아웃 설정 (30초) + 로딩 인디케이터
- Rate limiting 모니터링 및 배치 처리 속도 조절
- 백업 임베딩 모델 준비 (HuggingFace Transformers)

**리스크**: PDF 텍스트 추출 실패 (스캔본, 암호화 등)  
**대응**: 
- 파일 유형별 검증 및 명확한 에러 메시지
- OCR 없이는 스캔 PDF 처리 불가 안내
- 지원되는 PDF 형식 가이드라인 제공

**리스크**: Vector DB 메모리 부족 또는 성능 저하  
**대응**: 
- 최대 동시 처리 배치 수 제한 (3개)
- ChromaDB persistent mode로 데이터 보존
- 메모리 사용량 모니터링 및 가비지 컬렉션

**리스크**: 다중 파일 처리 시 부분 실패  
**대응**:
- 개별 파일 처리 상태 추적
- 부분 성공도 사용 가능하도록 설계
- 실패한 파일만 재처리 기능

### 11.2 일정 리스크
**리스크**: 2일 내 완성 불가  
**대응**: 
- 핵심 기능 우선 구현 (80/20 법칙)
- 부가 기능은 추후 업데이트로 연기
- 최소한 단일 문서 + 다중 문서 검색은 완성

**리스크**: 배치 처리 복잡도 과소평가  
**대응**:
- 단일 파일 처리를 먼저 완성한 후 배치로 확장
- WebSocket 실시간 업데이트는 폴링으로 대체 가능
- 배치 기능 구현 어려운 경우 개별 업로드만 우선 제공

### 11.3 품질 리스크
**리스크**: 다중 문서 검색 정확도 낮음  
**대응**: 
- 프롬프트 엔지니어링으로 다중 소스 처리 개선
- 청크 크기 및 오버랩 비율 실험적 조정
- 관련성 점수 기반 소스 필터링 강화

**리스크**: 대용량 파일 처리 시 시스템 불안정  
**대응**:
- 파일 크기 제한 (개별 50MB, 배치 총 500MB)
- 스트림 기반 파일 처리로 메모리 효율성 개선
- 처리 타임아웃 설정 및 진행률 피드백

### 11.4 사용성 리스크
**리스크**: 폴더 업로드 UX 복잡성  
**대응**:
- 브라우저별 폴더 업로드 지원 상황 확인
- 대체 방안으로 zip 파일 업로드 지원 검토
- 명확한 사용법 가이드 및 예시 제공

**리스크**: 배치 처리 시간이 길어 사용자 이탈  
**대응**:
- 예상 처리 시간 사전 안내
- 실시간 진행률 및 처리 상태 표시
- 백그라운드 처리 중에도 기존 문서 사용 가능

### 11.5 비용 리스크
**리스크**: OpenAI API 비용 급증  
**대응**:
- 일일 API 사용량 제한 설정
- 임베딩 캐싱으로 중복 요청 방지  
- 사용량 모니터링 대시보드 구현

### 11.6 보안 리스크
**리스크**: 업로드된 논문의 기밀성 문제  
**대응**:
- 명확한 데이터 보관 정책 공지
- 세션 종료 시 자동 파일 삭제
- HTTPS 통신 및 임시 저장소 보안 강화