import os
import uuid
import asyncio
from typing import List, Dict, Any
from PyPDF2 import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_openai import OpenAIEmbeddings
import chromadb
from chromadb.config import Settings as ChromaSettings
import logging

from config import settings
from models import DocumentChunk, ProcessingStatus

logger = logging.getLogger(__name__)

class DocumentProcessor:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            separators=["\n\n", "\n", ".", "!", "?", " ", ""]
        )
        
        # ChromaDB 클라이언트 초기화
        self.chroma_client = chromadb.PersistentClient(
            path=settings.CHROMADB_PERSIST_DIRECTORY,
            settings=ChromaSettings(
                anonymized_telemetry=False
            )
        )
        
        # 임베딩 모델 초기화
        self.embedding_model = OpenAIEmbeddings(
            model=settings.EMBEDDING_MODEL,
            openai_api_key=settings.OPENAI_API_KEY
        )
        
        # 업로드 디렉토리 생성
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    async def process_pdf(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """PDF 파일을 처리하고 벡터화합니다."""
        try:
            logger.info(f"Starting PDF processing for document: {document_id}")
            
            # 1. PDF 텍스트 추출
            text_chunks = await self._extract_text_with_metadata(file_path)
            
            if not text_chunks:
                raise ValueError("PDF에서 텍스트를 추출할 수 없습니다.")
            
            # 2. 텍스트 분할
            chunks = await self._split_text_chunks(text_chunks)
            
            # 3. 임베딩 생성 및 저장
            await self._store_in_vectordb(document_id, chunks)
            
            logger.info(f"PDF processing completed for document: {document_id}")
            
            return {
                "document_id": document_id,
                "total_pages": len(text_chunks),
                "total_chunks": len(chunks),
                "status": ProcessingStatus.COMPLETED
            }
            
        except Exception as e:
            logger.error(f"Error processing PDF {document_id}: {str(e)}")
            return {
                "document_id": document_id,
                "status": ProcessingStatus.ERROR,
                "error_message": str(e)
            }
    
    async def _extract_text_with_metadata(self, file_path: str) -> List[Dict[str, Any]]:
        """PDF에서 텍스트를 추출하고 페이지별 메타데이터를 포함합니다."""
        text_chunks = []
        
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PdfReader(file)
                
                for page_num, page in enumerate(pdf_reader.pages, 1):
                    text = page.extract_text()
                    
                    if text.strip():
                        # 섹션 추출 시도 (간단한 방법)
                        section = self._extract_section(text)
                        
                        text_chunks.append({
                            "page_number": page_num,
                            "content": text.strip(),
                            "section": section,
                            "metadata": {
                                "page_number": page_num,
                                "total_pages": len(pdf_reader.pages)
                            }
                        })
                
                logger.info(f"Extracted text from {len(text_chunks)} pages")
                return text_chunks
                
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            raise
    
    def _extract_section(self, text: str) -> str:
        """텍스트에서 섹션을 추출합니다."""
        # 간단한 섹션 추출 로직
        lines = text.split('\n')
        for line in lines[:5]:  # 처음 5줄에서 섹션 찾기
            line = line.strip()
            if line and len(line) < 100 and line.isupper():
                return line
        return "Unknown"
    
    async def _split_text_chunks(self, text_chunks: List[Dict[str, Any]]) -> List[DocumentChunk]:
        """텍스트를 청크로 분할합니다."""
        chunks = []
        
        for text_chunk in text_chunks:
            # 페이지별로 텍스트 분할
            page_chunks = self.text_splitter.split_text(text_chunk["content"])
            
            for i, chunk_content in enumerate(page_chunks):
                if len(chunk_content.strip()) > 50:  # 너무 짧은 청크 제외
                    chunk = DocumentChunk(
                        chunk_id=str(uuid.uuid4()),
                        content=chunk_content.strip(),
                        page_number=text_chunk["page_number"],
                        section=text_chunk["section"],
                        metadata=text_chunk["metadata"]
                    )
                    chunks.append(chunk)
        
        logger.info(f"Created {len(chunks)} text chunks")
        return chunks
    
    async def _store_in_vectordb(self, document_id: str, chunks: List[DocumentChunk]):
        """청크를 벡터 데이터베이스에 저장합니다."""
        try:
            # 컬렉션 생성 또는 가져오기
            collection_name = f"documents_{document_id}"
            
            try:
                collection = self.chroma_client.get_collection(collection_name)
            except:
                collection = self.chroma_client.create_collection(
                    name=collection_name,
                    metadata={"document_id": document_id}
                )
            
            # 청크 데이터 준비
            documents = []
            metadatas = []
            ids = []
            
            for chunk in chunks:
                documents.append(chunk.content)
                metadatas.append({
                    "document_id": document_id,
                    "page_number": chunk.page_number,
                    "section": chunk.section,
                    "chunk_id": chunk.chunk_id
                })
                ids.append(chunk.chunk_id)
            
            # 임베딩 생성 및 저장
            embeddings = await self.embedding_model.aembed_documents(documents)
            
            collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            
            logger.info(f"Stored {len(chunks)} chunks in vector database for document: {document_id}")
            
        except Exception as e:
            logger.error(f"Error storing chunks in vector database: {str(e)}")
            raise
    
    async def search_similar_chunks(self, document_id: str, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """유사한 청크를 검색합니다."""
        try:
            collection_name = f"documents_{document_id}"
            collection = self.chroma_client.get_collection(collection_name)
            
            # 쿼리 임베딩 생성
            query_embedding = await self.embedding_model.aembed_query(query)
            
            # 유사도 검색
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=k,
                include=["documents", "metadatas", "distances"]
            )
            
            # 결과 포맷팅
            chunks = []
            for i in range(len(results["ids"][0])):
                chunks.append({
                    "chunk_id": results["ids"][0][i],
                    "content": results["documents"][0][i],
                    "metadata": results["metadatas"][0][i],
                    "relevance_score": 1.0 - results["distances"][0][i]  # 거리를 유사도 점수로 변환
                })
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error searching similar chunks: {str(e)}")
            return []
    
    def cleanup_document(self, document_id: str):
        """문서 관련 데이터를 정리합니다."""
        try:
            # ChromaDB 컬렉션 삭제
            collection_name = f"documents_{document_id}"
            try:
                self.chroma_client.delete_collection(collection_name)
            except:
                pass
            
            # 업로드된 파일 삭제
            file_path = os.path.join(settings.UPLOAD_DIR, f"{document_id}.pdf")
            if os.path.exists(file_path):
                os.remove(file_path)
            
            logger.info(f"Cleaned up document: {document_id}")
            
        except Exception as e:
            logger.error(f"Error cleaning up document {document_id}: {str(e)}")
