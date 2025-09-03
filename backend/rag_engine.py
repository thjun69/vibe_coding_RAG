import time
import logging
from typing import List, Dict, Any
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

from config import settings
from models import Source, ChatResponse
from document_processor import DocumentProcessor

logger = logging.getLogger(__name__)

class RAGQueryEngine:
    def __init__(self, document_processor: DocumentProcessor):
        self.document_processor = document_processor
        self.llm = ChatOpenAI(
            model=settings.LLM_MODEL,
            openai_api_key=settings.OPENAI_API_KEY,
            temperature=0.1,
            max_tokens=1000
        )
        
        # 시스템 프롬프트
        self.system_prompt = """당신은 논문을 분석하는 AI 어시스턴트입니다. 
사용자의 질문에 대해 논문 내용을 바탕으로 정확하고 유용한 답변을 제공해야 합니다.

답변 시 다음 규칙을 따라주세요:
1. 논문 내용에 근거한 답변만 제공
2. 추측이나 일반적인 지식으로 답변하지 말 것
3. 답변 후 관련된 출처 정보를 포함
4. 한국어로 질문받으면 한국어로 답변
5. 답변이 논문 내용에 없는 경우 솔직하게 "논문에서 해당 내용을 찾을 수 없습니다"라고 답변

출처 정보는 다음과 같이 제공하세요:
- 페이지 번호
- 섹션 정보 (가능한 경우)
- 관련 내용의 일부"""
    
    async def query(self, document_id: str, question: str, session_id: str = None) -> ChatResponse:
        """사용자 질문에 대해 RAG 기반으로 답변합니다."""
        start_time = time.time()
        
        try:
            logger.info(f"Processing query for document {document_id}: {question}")
            
            # 1. 유사한 청크 검색
            relevant_chunks = await self.document_processor.search_similar_chunks(
                document_id=document_id,
                query=question,
                k=5
            )
            
            if not relevant_chunks:
                return ChatResponse(
                    session_id=session_id or "default",
                    response="죄송합니다. 논문에서 관련 내용을 찾을 수 없습니다. 다른 질문을 해주시거나 질문을 더 구체적으로 작성해주세요.",
                    sources=[],
                    processing_time="0s"
                )
            
            # 2. 컨텍스트 구성
            context = self._build_context(relevant_chunks)
            
            # 3. LLM 답변 생성
            response = await self._generate_response(question, context)
            
            # 4. 출처 정보 구성
            sources = self._extract_sources(relevant_chunks)
            
            # 5. 처리 시간 계산
            processing_time = f"{time.time() - start_time:.1f}s"
            
            logger.info(f"Query completed in {processing_time}")
            
            return ChatResponse(
                session_id=session_id or "default",
                response=response,
                sources=sources,
                processing_time=processing_time
            )
            
        except Exception as e:
            logger.error(f"Error in RAG query: {str(e)}")
            return ChatResponse(
                session_id=session_id or "default",
                response="죄송합니다. 질문 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
                sources=[],
                processing_time="0s"
            )
    
    def _build_context(self, chunks: List[Dict[str, Any]]) -> str:
        """검색된 청크들을 컨텍스트로 구성합니다."""
        context_parts = []
        
        for chunk in chunks:
            page_info = f"[페이지 {chunk['metadata']['page_number']}"
            if chunk['metadata']['section'] and chunk['metadata']['section'] != "Unknown":
                page_info += f", {chunk['metadata']['section']}"
            page_info += "]"
            
            context_parts.append(f"{page_info}\n{chunk['content']}\n")
        
        return "\n".join(context_parts)
    
    async def _generate_response(self, question: str, context: str) -> str:
        """LLM을 사용하여 답변을 생성합니다."""
        try:
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=f"""
다음 논문 내용을 바탕으로 질문에 답변해주세요:

논문 내용:
{context}

질문: {question}

답변을 한국어로 제공하고, 관련된 출처 정보를 포함해주세요.
""")
            ]
            
            response = await self.llm.ainvoke(messages)
            return response.content
            
        except Exception as e:
            logger.error(f"Error generating LLM response: {str(e)}")
            return "죄송합니다. AI 답변 생성 중 오류가 발생했습니다."
    
    def _extract_sources(self, chunks: List[Dict[str, Any]]) -> List[Source]:
        """검색된 청크에서 출처 정보를 추출합니다."""
        sources = []
        
        for chunk in chunks:
            source = Source(
                page_number=chunk['metadata']['page_number'],
                section=chunk['metadata']['section'] or "Unknown",
                content_snippet=chunk['content'][:200] + "..." if len(chunk['content']) > 200 else chunk['content'],
                relevance_score=chunk['relevance_score']
            )
            sources.append(source)
        
        # 관련성 점수로 정렬
        sources.sort(key=lambda x: x.relevance_score, reverse=True)
        
        return sources
    
    async def get_sample_questions(self, document_id: str) -> List[str]:
        """문서 유형에 따른 샘플 질문을 제공합니다."""
        sample_questions = [
            "이 연구의 주요 목적은 무엇인가요?",
            "연구에서 사용된 방법론은 무엇인가요?",
            "주요 실험 결과는 무엇인가요?",
            "이 연구의 한계점은 무엇인가요?",
            "향후 연구 방향은 무엇인가요?",
            "연구의 핵심 기여점은 무엇인가요?",
            "실험 설계는 어떻게 되었나요?",
            "결론은 무엇인가요?"
        ]
        
        return sample_questions
