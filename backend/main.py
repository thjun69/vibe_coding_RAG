import os
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import aiofiles

from config import settings
from models import (
    UploadResponse, ProcessingStatusResponse, ChatRequest, 
    ChatResponse, ChatHistoryResponse, ErrorResponse
)

# Mock 모드 확인
if settings.USE_MOCK_MODE:
    from mock_engine import MockDocumentProcessor, MockRAGQueryEngine
    document_processor = MockDocumentProcessor()
    rag_engine = MockRAGQueryEngine(document_processor)
    logging.info("Running in MOCK MODE - Upstage AI API not required")
else:
    from document_processor import DocumentProcessor
    from rag_engine import RAGQueryEngine
    document_processor = DocumentProcessor()
    rag_engine = RAGQueryEngine(document_processor)
    logging.info("Running in NORMAL MODE - Upstage AI API required")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="ResearchBot API",
    description="AI 논문 분석 챗봇 API" + (" [MOCK MODE]" if settings.USE_MOCK_MODE else ""),
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

chat_sessions: Dict[str, Dict[str, Any]] = {}
document_status: Dict[str, Dict[str, Any]] = {}

@app.get("/")
async def root():
    """API 상태 확인"""
    mode_info = "MOCK MODE" if settings.USE_MOCK_MODE else "NORMAL MODE"
    return {
        "message": f"ResearchBot API is running ({mode_info})",
        "version": "1.0.0",
        "status": "healthy",
        "mode": mode_info
    }

@app.get(f"{settings.API_PREFIX}/documents/existing")
async def get_existing_documents():
    """업로드 폴더의 기존 PDF 파일 목록 반환"""
    try:
        existing_files = []
        upload_dir = settings.UPLOAD_DIR
        
        if os.path.exists(upload_dir):
            for filename in os.listdir(upload_dir):
                if filename.lower().endswith('.pdf'):
                    file_path = os.path.join(upload_dir, filename)
                    file_stat = os.stat(file_path)
                    
                    existing_files.append({
                        "filename": filename,
                        "size_bytes": file_stat.st_size,
                        "size_mb": round(file_stat.st_size / (1024 * 1024), 2),
                        "modified_time": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                        "file_path": file_path
                    })
        
        return {
            "existing_files": existing_files,
            "total_count": len(existing_files)
        }
        
    except Exception as e:
        logger.error(f"Error getting existing documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get existing documents: {str(e)}")

@app.post(f"{settings.API_PREFIX}/documents/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """PDF 문서를 업로드하고 처리합니다."""
    try:
        # 파일 검증
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="PDF 파일만 업로드 가능합니다.")
        
        if file.size and file.size > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"파일 크기는 {settings.MAX_FILE_SIZE // (1024*1024)}MB 이하여야 합니다."
            )
        
        # 문서 ID 생성
        document_id = str(uuid.uuid4())
        filename = file.filename
        
        # 파일 저장 경로
        file_path = os.path.join(settings.UPLOAD_DIR, f"{document_id}.pdf")
        
        # 파일 저장
        async with aiofiles.open(file_path, 'wb') as f:
            content = await file.read()
            await f.write(content)
        
        # 문서 상태 초기화
        document_status[document_id] = {
            "document_id": document_id,
            "filename": filename,
            "upload_timestamp": datetime.now(),
            "status": "processing",
            "file_path": file_path
        }
        
        # 백그라운드에서 문서 처리
        background_tasks.add_task(process_document_background, document_id, file_path)
        
        logger.info(f"Document uploaded: {document_id} - {filename}")
        
        return UploadResponse(
            document_id=document_id,
            filename=filename,
            status="processing",
            estimated_processing_time="30s"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {str(e)}")
        raise HTTPException(status_code=500, detail="문서 업로드 중 오류가 발생했습니다.")

async def process_document_background(document_id: str, file_path: str):
    """백그라운드에서 문서를 처리합니다."""
    try:
        logger.info(f"Starting background processing for document: {document_id}")
        
        # Mock 모드에서는 즉시 완료
        if settings.USE_MOCK_MODE:
            await asyncio.sleep(2)  # 2초 대기로 처리 시간 시뮬레이션
            result = {
                "document_id": document_id,
                "total_pages": 5,
                "total_chunks": 8,
                "status": "completed"
            }
        else:
            # 실제 문서 처리
            result = await document_processor.process_pdf(file_path, document_id)
        
        # 상태 업데이트
        if document_id in document_status:
            document_status[document_id].update(result)
            document_status[document_id]["status"] = result["status"]
        
        logger.info(f"Background processing completed for document: {document_id}")
        
    except Exception as e:
        logger.error(f"Error in background processing for document {document_id}: {str(e)}")
        if document_id in document_status:
            document_status[document_id]["status"] = "error"
            document_status[document_id]["error_message"] = str(e)

@app.get(f"{settings.API_PREFIX}/documents/{{document_id}}/status", response_model=ProcessingStatusResponse)
async def get_processing_status(document_id: str):
    """문서 처리 상태를 확인합니다."""
    if document_id not in document_status:
        raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
    
    doc_status = document_status[document_id]
    
    return ProcessingStatusResponse(
        document_id=document_id,
        status=doc_status["status"],
        total_pages=doc_status.get("total_pages", 0),
        total_chunks=doc_status.get("total_chunks", 0),
        error_message=doc_status.get("error_message")
    )

@app.post(f"{settings.API_PREFIX}/chat/{{document_id}}", response_model=ChatResponse)
async def chat_with_document(document_id: str, chat_request: ChatRequest):
    """문서에 대해 질문하고 답변을 받습니다."""
    try:
        # 문서 상태 확인
        if document_id not in document_status:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        doc_status = document_status[document_id]
        if doc_status["status"] != "completed":
            raise HTTPException(
                status_code=400, 
                detail="문서 처리가 완료되지 않았습니다. 잠시 후 다시 시도해주세요."
            )
        
        # 세션 ID 생성 또는 사용
        session_id = chat_request.session_id or str(uuid.uuid4())
        
        # 세션 초기화
        if session_id not in chat_sessions:
            chat_sessions[session_id] = {
                "document_id": document_id,
                "messages": [],
                "document_info": {
                    "filename": doc_status["filename"],
                    "total_pages": doc_status.get("total_pages", 0)
                }
            }
        
        # 사용자 메시지 저장
        user_message = {
            "role": "user",
            "content": chat_request.message,
            "timestamp": datetime.now()
        }
        chat_sessions[session_id]["messages"].append(user_message)
        
        # RAG 엔진으로 답변 생성
        response = await rag_engine.query(document_id, chat_request.message, session_id)
        
        # 어시스턴트 메시지 저장
        assistant_message = {
            "role": "assistant",
            "content": response.response,
            "timestamp": datetime.now(),
            "sources": [source.dict() for source in response.sources]
        }
        chat_sessions[session_id]["messages"].append(assistant_message)
        
        logger.info(f"Chat response generated for document {document_id}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in chat: {str(e)}")
        raise HTTPException(status_code=500, detail="채팅 처리 중 오류가 발생했습니다.")

@app.get(f"{settings.API_PREFIX}/chat/{{session_id}}/history", response_model=ChatHistoryResponse)
async def get_chat_history(session_id: str):
    """채팅 히스토리를 조회합니다."""
    if session_id not in chat_sessions:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    
    session = chat_sessions[session_id]
    
    return ChatHistoryResponse(
        session_id=session_id,
        messages=session["messages"],
        document_info=session["document_info"]
    )

@app.get(f"{settings.API_PREFIX}/chat/{{document_id}}/sample-questions")
async def get_sample_questions(document_id: str):
    """샘플 질문을 제공합니다."""
    try:
        questions = await rag_engine.get_sample_questions(document_id)
        return {"questions": questions}
    except Exception as e:
        logger.error(f"Error getting sample questions: {str(e)}")
        return {"questions": []}

@app.delete(f"{settings.API_PREFIX}/documents/{{document_id}}")
async def delete_document(document_id: str):
    """문서와 관련 데이터를 삭제합니다."""
    try:
        # 문서 상태 확인
        if document_id not in document_status:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        # 문서 정리
        if not settings.USE_MOCK_MODE:
            document_processor.cleanup_document(document_id)
        
        # 상태 및 세션 정리
        if document_id in document_status:
            del document_status[document_id]
        
        # 관련 세션 정리
        sessions_to_remove = []
        for session_id, session in chat_sessions.items():
            if session["document_id"] == document_id:
                sessions_to_remove.append(session_id)
        
        for session_id in sessions_to_remove:
            del chat_sessions[session_id]
        
        logger.info(f"Document deleted: {document_id}")
        
        return {"message": "문서가 성공적으로 삭제되었습니다."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document {document_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="문서 삭제 중 오류가 발생했습니다.")

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """전역 예외 처리"""
    logger.error(f"Global exception: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"error": "내부 서버 오류가 발생했습니다."}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
