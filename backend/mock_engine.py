import time
import logging
from typing import List, Dict, Any
from models import DocumentChunk, Source, ChatResponse

logger = logging.getLogger(__name__)

class MockEmbeddings:
    """Mock 임베딩 모델 - Upstage AI API 호출 없이 테스트용"""
    
    def __init__(self, model: str = "solar-embedding-1-mini"):
        self.model = model
        logger.info(f"MockEmbeddings initialized with model: {model}")
    
    async def aembed_documents(self, texts: List[str]) -> List[List[float]]:
        """문서 텍스트를 Mock 임베딩으로 변환"""
        logger.info(f"Mock embedding generation for {len(texts)} documents")
        
        # 간단한 Mock 임베딩 생성 (랜덤하지 않은 일관된 값)
        embeddings = []
        for i, text in enumerate(texts):
            # 텍스트 길이와 내용을 기반으로 한 Mock 임베딩
            embedding = []
            for j in range(1536):  # OpenAI ada-002와 동일한 차원
                # 일관된 Mock 값 생성
                value = (hash(f"{text[:10]}_{i}_{j}") % 1000) / 1000.0
                embedding.append(value)
            embeddings.append(embedding)
        
        return embeddings
    
    async def aembed_query(self, query: str) -> List[float]:
        """쿼리 텍스트를 Mock 임베딩으로 변환"""
        logger.info(f"Mock query embedding generation: {query[:50]}...")
        
        # 쿼리 기반 Mock 임베딩
        embedding = []
        for j in range(1536):
            value = (hash(f"query_{query[:10]}_{j}") % 1000) / 1000.0
            embedding.append(value)
        
        return embedding

class MockLLM:
    """Mock LLM 모델 - Upstage AI API 호출 없이 테스트용"""
    
    def __init__(self, model: str = "solar-1-mini"):
        self.model = model
        logger.info(f"MockLLM initialized with model: {model}")
    
    async def ainvoke(self, messages: List[Dict[str, str]]) -> Dict[str, str]:
        """Mock LLM 응답 생성"""
        logger.info(f"Mock LLM response generation for {len(messages)} messages")
        
        # 마지막 사용자 메시지 추출
        user_message = None
        for msg in reversed(messages):
            if msg.get("type") == "human" or "HumanMessage" in str(type(msg)):
                user_message = msg.get("content", "")
                break
        
        if not user_message:
            user_message = "안녕하세요"
        
        # 질문 내용에 따른 Mock 응답 생성
        response = self._generate_mock_response(user_message)
        
        return {"content": response}
    
    def _generate_mock_response(self, question: str) -> str:
        """질문에 따른 Mock 응답 생성"""
        question_lower = question.lower()
        
        # 한국어 질문 처리
        if any(keyword in question_lower for keyword in ['목적', 'purpose', 'goal']):
            return """이 연구의 주요 목적은 AI 기술을 활용한 논문 분석 시스템을 개발하는 것입니다. 
            
연구자들이 복잡한 논문을 효율적으로 이해하고 분석할 수 있도록 도와주는 것이 핵심 목표입니다.

출처: 페이지 1, 서론"""
        
        elif any(keyword in question_lower for keyword in ['방법', 'method', 'methodology', '방법론']):
            return """이 연구에서는 RAG(Retrieval-Augmented Generation) 기술을 활용했습니다. 
            
주요 방법은 다음과 같습니다:
1. PDF 문서를 텍스트로 변환
2. 텍스트를 의미 있는 청크로 분할
3. 벡터 데이터베이스에 저장
4. 사용자 질문과 유사한 내용 검색
5. AI 모델을 통한 답변 생성

출처: 페이지 2-3, 방법론"""
        
        elif any(keyword in question_lower for keyword in ['결과', 'result', '성과']):
            return """주요 실험 결과는 다음과 같습니다:
            
- PDF 처리 정확도: 95% 이상
- 질문 응답 정확도: 87%
- 평균 응답 시간: 2.3초
- 사용자 만족도: 4.2/5.0

이러한 결과는 제안된 시스템의 실용성을 보여줍니다.

출처: 페이지 4-5, 결과"""
        
        elif any(keyword in question_lower for keyword in ['한계', 'limitation', '제한']):
            return """이 연구의 주요 한계점은 다음과 같습니다:
            
1. 영어 논문에 대한 처리 성능이 한국어보다 낮음
2. 복잡한 수식이나 도표 처리의 한계
3. 대용량 문서 처리 시 성능 저하
4. 특정 분야 전문 용어에 대한 이해 부족

출처: 페이지 6, 논의"""
        
        elif any(keyword in question_lower for keyword in ['향후', 'future', '개선']):
            return """향후 연구 방향은 다음과 같습니다:
            
1. 다국어 지원 확대
2. 수식 및 도표 인식 기술 개선
3. 실시간 협업 기능 추가
4. 개인화된 학습 경험 제공
5. 모바일 환경 최적화

출처: 페이지 7, 결론"""
        
        elif any(keyword in question_lower for keyword in ['기여', 'contribution', '의의']):
            return """이 연구의 주요 기여점은 다음과 같습니다:
            
1. 한국어 논문 분석을 위한 최초의 RAG 시스템 제안
2. 학술 논문 특화 임베딩 모델 개발
3. 사용자 친화적 인터페이스 설계
4. 오픈소스 플랫폼으로의 공개

출처: 페이지 8, 결론"""
        
        else:
            return """제공된 논문 내용을 바탕으로 답변드렸습니다. 
            
더 구체적인 질문이 있으시면 언제든 말씀해 주세요. 
예를 들어, 연구 목적, 방법론, 결과, 한계점, 향후 방향 등에 대해 질문할 수 있습니다.

출처: 전체 문서"""

class MockDocumentProcessor:
    """Mock 문서 처리기 - Upstage AI API 호출 없이 테스트용"""
    
    def __init__(self):
        logger.info("MockDocumentProcessor initialized")
    
    async def process_pdf(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """Mock PDF 처리"""
        logger.info(f"Mock PDF processing for document: {document_id}")
        
        # 처리 시간 시뮬레이션
        await asyncio.sleep(1)
        
        return {
            "document_id": document_id,
            "total_pages": 8,
            "total_chunks": 12,
            "status": "completed"
        }
    
    async def search_similar_chunks(self, document_id: str, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Mock 유사 청크 검색"""
        logger.info(f"Mock similar chunks search for document: {document_id}")
        
        # Mock 청크 데이터 생성
        mock_chunks = []
        for i in range(min(k, 5)):
            mock_chunks.append({
                "chunk_id": f"mock_chunk_{i}",
                "content": f"이것은 Mock 청크 {i}의 내용입니다. {query}와 관련된 가상의 논문 내용을 포함하고 있습니다.",
                "metadata": {
                    "page_number": i + 1,
                    "section": "Mock 섹션",
                    "document_id": document_id
                },
                "relevance_score": 0.9 - (i * 0.1)
            })
        
        return mock_chunks
    
    def cleanup_document(self, document_id: str):
        """Mock 문서 정리"""
        logger.info(f"Mock document cleanup for: {document_id}")

class MockRAGQueryEngine:
    """Mock RAG 쿼리 엔진 - Upstage AI API 호출 없이 테스트용"""
    
    def __init__(self, document_processor: MockDocumentProcessor):
        self.document_processor = document_processor
        self.llm = MockLLM()
        logger.info("MockRAGQueryEngine initialized")
    
    async def query(self, document_id: str, question: str, session_id: str = None) -> ChatResponse:
        """Mock RAG 쿼리 처리"""
        logger.info(f"Mock RAG query for document: {document_id}")
        
        start_time = time.time()
        
        # Mock 유사 청크 검색
        relevant_chunks = await self.document_processor.search_similar_chunks(
            document_id, question, k=3
        )
        
        # Mock LLM 응답 생성
        messages = [{"type": "human", "content": question}]
        llm_response = await self.llm.ainvoke(messages)
        
        # Mock 출처 정보 생성
        sources = []
        for chunk in relevant_chunks:
            source = Source(
                page_number=chunk["metadata"]["page_number"],
                section=chunk["metadata"]["section"],
                content_snippet=chunk["content"][:100] + "...",
                relevance_score=chunk["relevance_score"]
            )
            sources.append(source)
        
        processing_time = f"{time.time() - start_time:.1f}s"
        
        return ChatResponse(
            session_id=session_id or "mock_session",
            response=llm_response["content"],
            sources=sources,
            processing_time=processing_time
        )
    
    async def get_sample_questions(self, document_id: str) -> List[str]:
        """Mock 샘플 질문 제공"""
        return [
            "이 연구의 주요 목적은 무엇인가요?",
            "연구에서 사용된 방법론은 무엇인가요?",
            "주요 실험 결과는 무엇인가요?",
            "이 연구의 한계점은 무엇인가요?",
            "향후 연구 방향은 무엇인가요?",
            "연구의 기여점은 무엇인가요?",
            "사용된 데이터셋은 무엇인가요?",
            "성능 평가 방법은 무엇인가요?"
        ]

# asyncio import 추가
import asyncio
