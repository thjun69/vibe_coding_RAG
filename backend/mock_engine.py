import time
import random
import logging
from typing import List, Dict, Any
from models import Source, ChatResponse

logger = logging.getLogger(__name__)

class MockEmbeddings:
    """Mock 임베딩 생성기"""
    
    def __init__(self):
        self.dimension = 1536  # text-embedding-ada-002와 동일한 차원
        
    async def aembed_documents(self, documents: List[str]) -> List[List[float]]:
        """문서들을 위한 Mock 임베딩 생성"""
        embeddings = []
        for _ in documents:
            embedding = [random.uniform(-1, 1) for _ in range(self.dimension)]
            embeddings.append(embedding)
        return embeddings
    
    async def aembed_query(self, query: str) -> List[float]:
        """쿼리를 위한 Mock 임베딩 생성"""
        return [random.uniform(-1, 1) for _ in range(self.dimension)]

class MockLLM:
    """Mock LLM 응답 생성기"""
    
    def __init__(self):
        self.sample_responses = [
            "이 연구는 머신러닝을 활용한 자연어 처리에 관한 것입니다. 주요 기여점은 새로운 아키텍처를 제안한 것입니다.",
            "논문에서 제시된 방법론은 기존 접근법보다 15% 향상된 성능을 보여줍니다.",
            "실험 결과는 제안된 모델이 다양한 데이터셋에서 일관된 성능을 보임을 확인합니다.",
            "이 연구의 한계점은 계산 복잡도가 높다는 것이며, 향후 연구에서는 이를 개선할 예정입니다.",
            "결론적으로, 제안된 방법은 자연어 처리 분야에서 의미 있는 진전을 이루었습니다."
        ]
    
    async def ainvoke(self, messages):
        """Mock LLM 응답 생성"""
        # 간단한 Mock 응답 클래스
        class MockResponse:
            def __init__(self, content):
                self.content = content
        
        # 사용자 질문에 따라 적절한 응답 선택
        user_message = messages[-1].content if messages else ""
        
        if "목적" in user_message or "목표" in user_message:
            response = "이 연구의 주요 목적은 머신러닝을 활용하여 자연어 처리 성능을 향상시키는 것입니다."
        elif "방법" in user_message or "방법론" in user_message:
            response = "연구에서는 새로운 신경망 아키텍처를 제안하고, 이를 다양한 데이터셋으로 검증했습니다."
        elif "결과" in user_message or "성능" in user_message:
            response = "실험 결과, 제안된 모델은 기존 방법 대비 평균 15% 향상된 성능을 보여주었습니다."
        elif "한계" in user_message or "문제점" in user_message:
            response = "현재 방법의 주요 한계점은 계산 복잡도가 높다는 것이며, 이는 향후 연구에서 개선할 예정입니다."
        else:
            response = random.choice(self.sample_responses)
        
        return MockResponse(response)

class MockDocumentProcessor:
    """Mock 문서 처리기"""
    
    def __init__(self):
        self.mock_chunks = []
        self._generate_mock_chunks()
    
    def _generate_mock_chunks(self):
        """Mock 청크 데이터 생성"""
        sample_contents = [
            "머신러닝은 데이터로부터 패턴을 학습하여 예측을 수행하는 기술입니다.",
            "자연어 처리는 컴퓨터가 인간의 언어를 이해하고 처리하는 분야입니다.",
            "딥러닝은 여러 층의 신경망을 사용하여 복잡한 패턴을 학습합니다.",
            "전이학습은 사전 훈련된 모델을 새로운 작업에 적용하는 기법입니다.",
            "어텐션 메커니즘은 입력의 중요한 부분에 집중하여 성능을 향상시킵니다."
        ]
        
        for i, content in enumerate(sample_contents):
            self.mock_chunks.append({
                "chunk_id": f"mock_chunk_{i}",
                "content": content,
                "metadata": {
                    "document_id": "mock_doc",
                    "page_number": random.randint(1, 10),
                    "section": random.choice(["서론", "방법론", "실험", "결과", "결론"]),
                    "chunk_id": f"mock_chunk_{i}"
                },
                "relevance_score": random.uniform(0.7, 1.0)
            })
    
    async def search_similar_chunks(self, document_id: str, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Mock 유사도 검색"""
        # 쿼리와 관련된 청크들을 랜덤하게 선택
        selected_chunks = random.sample(self.mock_chunks, min(k, len(self.mock_chunks)))
        
        # 관련성 점수 조정
        for chunk in selected_chunks:
            chunk["relevance_score"] = random.uniform(0.8, 1.0)
        
        return selected_chunks

class MockRAGQueryEngine:
    """Mock RAG 쿼리 엔진"""
    
    def __init__(self, document_processor):
        self.document_processor = document_processor
        self.llm = MockLLM()
    
    async def query(self, document_id: str, question: str, session_id: str = None) -> ChatResponse:
        """Mock RAG 쿼리 처리"""
        start_time = time.time()
        
        try:
            # Mock 유사도 검색
            relevant_chunks = await self.document_processor.search_similar_chunks(
                document_id=document_id,
                query=question,
                k=3
            )
            
            if not relevant_chunks:
                return ChatResponse(
                    session_id=session_id or "mock_session",
                    response="죄송합니다. Mock 모드에서는 제한된 정보만 제공할 수 있습니다.",
                    sources=[],
                    processing_time="0s"
                )
            
            # Mock LLM 응답 생성
            response = await self.llm.ainvoke([
                type('MockMessage', (), {'content': question})()
            ])
            
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
            
            # 처리 시간 계산
            processing_time = f"{time.time() - start_time:.1f}s"
            
            logger.info(f"Mock query completed in {processing_time}")
            
            return ChatResponse(
                session_id=session_id or "mock_session",
                response=response.content,
                sources=sources,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error in Mock RAG query: {str(e)}")
            return ChatResponse(
                session_id=session_id or "mock_session",
                response="Mock 모드에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
                sources=[],
                processing_time="0s"
            )
    
    async def get_sample_questions(self, document_id: str) -> List[str]:
        """Mock 샘플 질문 제공"""
        return [
            "이 연구의 주요 목적은 무엇인가요?",
            "연구에서 사용된 방법론은 무엇인가요?",
            "주요 실험 결과는 무엇인가요?",
            "이 연구의 한계점은 무엇인가요?",
            "향후 연구 방향은 무엇인가요?"
        ]
