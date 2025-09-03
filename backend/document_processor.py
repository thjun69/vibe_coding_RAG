import os
import uuid
import asyncio
import aiohttp
import logging
from typing import List, Dict, Any
from PyPDF2 import PdfReader
from langchain.text_splitter import RecursiveCharacterTextSplitter
import chromadb
from chromadb.config import Settings as ChromaSettings

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
        
        # ChromaDB 클라이언트 초기화 (telemetry 완전 비활성화)
        try:
            # 환경 변수로 telemetry 비활성화
            os.environ["ANONYMIZED_TELEMETRY"] = "false"
            os.environ["CHROMA_TELEMETRY_ENABLED"] = "false"
            
            self.chroma_client = chromadb.PersistentClient(
                path=settings.CHROMADB_PERSIST_DIRECTORY,
                settings=ChromaSettings(
                    anonymized_telemetry=False,
                    is_persistent=True,
                    persist_directory=settings.CHROMADB_PERSIST_DIRECTORY
                )
            )
            logger.info("ChromaDB client initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing ChromaDB client: {str(e)}")
            # ChromaDB 초기화 실패 시 Mock 클라이언트 사용
            self.chroma_client = None
        
        self.upstage_api_key = settings.UPSTAGE_API_KEY
        self.upstage_base_url = settings.UPSTAGE_BASE_URL
        self.embedding_model = settings.EMBEDDING_MODEL
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

    async def process_pdf(self, file_path: str, document_id: str) -> Dict[str, Any]:
        """PDF 문서를 처리하고 벡터 데이터베이스에 저장합니다."""
        try:
            logger.info(f"Starting PDF processing for document: {document_id}")
            
            # 1. PDF에서 텍스트 추출
            text_chunks = await self._extract_text_with_metadata(file_path)
            if not text_chunks:
                raise Exception("PDF에서 텍스트를 추출할 수 없습니다.")
            
            # 2. 텍스트를 청크로 분할
            chunks = await self._split_text_chunks(text_chunks)
            if not chunks:
                raise Exception("텍스트 청크 생성에 실패했습니다.")
            
            # 3. 벡터 데이터베이스에 저장
            await self._store_in_vectordb(document_id, chunks)
            
            logger.info(f"PDF processing completed for document: {document_id}")
            
            return {
                "document_id": document_id,
                "total_pages": len(text_chunks),
                "total_chunks": len(chunks),
                "status": "completed"
            }
            
        except Exception as e:
            logger.error(f"Error processing PDF for document {document_id}: {str(e)}")
            raise e

    async def _extract_text_with_metadata(self, file_path: str) -> List[Dict[str, Any]]:
        """PDF에서 텍스트를 추출하고 메타데이터를 포함합니다."""
        text_chunks = []
        
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PdfReader(file)
                
                for page_num, page in enumerate(pdf_reader.pages, 1):
                    text = page.extract_text()
                    if text.strip():
                        # 페이지별로 텍스트를 섹션으로 분할
                        sections = self._extract_section(text)
                        text_chunks.append({
                            "page_number": page_num,
                            "text": text,
                            "section": sections
                        })
                        
            logger.info(f"Extracted text from {len(text_chunks)} pages")
            return text_chunks
            
        except Exception as e:
            logger.error(f"Error extracting text from PDF: {str(e)}")
            raise e

    def _extract_section(self, text: str) -> str:
        """텍스트에서 섹션 정보를 추출합니다."""
        # 간단한 섹션 추출 로직
        lines = text.split('\n')
        for line in lines[:10]:  # 처음 10줄에서 섹션 찾기
            line = line.strip()
            if any(keyword in line.lower() for keyword in ['서론', 'introduction', '방법론', 'method', '실험', 'experiment', '결과', 'result', '결론', 'conclusion']):
                return line
        return "본문"

    async def _split_text_chunks(self, text_chunks: List[Dict[str, Any]]) -> List[DocumentChunk]:
        """텍스트를 청크로 분할합니다."""
        chunks = []
        chunk_id_counter = 0
        
        for text_chunk in text_chunks:
            # 페이지별로 텍스트를 청크로 분할
            page_chunks = self.text_splitter.split_text(text_chunk["text"])
            
            for chunk_text in page_chunks:
                if chunk_text.strip():
                    chunk = DocumentChunk(
                        chunk_id=f"{text_chunk['page_number']}_{chunk_id_counter}",
                        content=chunk_text,
                        page_number=text_chunk["page_number"],
                        section=text_chunk["section"],
                        metadata={
                            "document_id": "temp",
                            "chunk_id": f"{text_chunk['page_number']}_{chunk_id_counter}"
                        }
                    )
                    chunks.append(chunk)
                    chunk_id_counter += 1
                    
                    # 최대 청크 수 제한
                    if len(chunks) >= settings.MAX_CHUNKS_PER_DOCUMENT:
                        break
            
            if len(chunks) >= settings.MAX_CHUNKS_PER_DOCUMENT:
                break
        
        logger.info(f"Created {len(chunks)} text chunks")
        return chunks

    async def _store_in_vectordb(self, document_id: str, chunks: List[DocumentChunk]):
        """청크를 벡터 데이터베이스에 저장합니다."""
        try:
            # 컬렉션 생성 또는 가져오기
            collection_name = f"document_{document_id}"
            collection = self.chroma_client.get_or_create_collection(
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
            
            # Upstage AI API를 사용하여 임베딩 생성
            embeddings = await self._get_upstage_embeddings(documents)
            
            collection.add(
                documents=documents,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            
            logger.info(f"Stored {len(chunks)} chunks in vector database for document: {document_id}")
            
        except Exception as e:
            logger.error(f"Error storing chunks in vector database: {str(e)}")
            raise e

    async def _get_upstage_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Upstage AI API를 사용하여 임베딩을 생성합니다."""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    "Authorization": f"Bearer {self.upstage_api_key}",
                    "Content-Type": "application/json"
                }
                
                embeddings = []
                for text in texts:
                    payload = {
                        "model": self.embedding_model,
                        "input": text
                    }
                    
                    async with session.post(
                        f"{self.upstage_base_url}/v1/embeddings",
                        headers=headers,
                        json=payload
                    ) as response:
                        if response.status == 200:
                            result = await response.json()
                            embedding = result["data"][0]["embedding"]
                            embeddings.append(embedding)
                        else:
                            error_text = await response.text()
                            logger.error(f"Upstage AI API error: {response.status} - {error_text}")
                            # 에러 시 Mock 임베딩 생성
                            mock_embedding = [0.0] * 1536
                            embeddings.append(mock_embedding)
                
                return embeddings
                
        except Exception as e:
            logger.error(f"Error getting Upstage AI embeddings: {str(e)}")
            # 에러 시 Mock 임베딩 생성
            mock_embeddings = []
            for text in texts:
                mock_embedding = [0.0] * 1536
                mock_embeddings.append(mock_embedding)
            return mock_embeddings

    async def search_similar_chunks(self, document_id: str, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """쿼리와 유사한 청크를 검색합니다."""
        try:
            collection_name = f"document_{document_id}"
            collection = self.chroma_client.get_collection(name=collection_name)
            
            # 쿼리 임베딩 생성
            query_embedding = await self._get_upstage_embeddings([query])
            
            # 유사도 검색
            results = collection.query(
                query_embeddings=query_embedding,
                n_results=k,
                include=["documents", "metadatas", "distances"]
            )
            
            # 결과 포맷팅
            chunks = []
            if results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    chunks.append({
                        "chunk_id": results["ids"][0][i] if results["ids"] else f"chunk_{i}",
                        "content": doc,
                        "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                        "relevance_score": 1.0 - (results["distances"][0][i] if results["distances"] else 0.0)
                    })
            
            return chunks
            
        except Exception as e:
            logger.error(f"Error searching similar chunks: {str(e)}")
            return []

    def cleanup_document(self, document_id: str):
        """문서 관련 데이터를 정리합니다."""
        try:
            # 벡터 데이터베이스에서 컬렉션 삭제
            collection_name = f"document_{document_id}"
            try:
                self.chroma_client.delete_collection(name=collection_name)
                logger.info(f"Deleted collection: {collection_name}")
            except:
                pass  # 컬렉션이 없을 수 있음
            
            # 업로드된 파일 삭제
            file_path = os.path.join(settings.UPLOAD_DIR, f"{document_id}.pdf")
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"Deleted file: {file_path}")
                
        except Exception as e:
            logger.error(f"Error cleaning up document {document_id}: {str(e)}")
