import os
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import aiofiles
import hashlib

from config import settings
from models import (
    UploadResponse, ProcessingStatusResponse, ChatRequest, 
    ChatResponse, ChatHistoryResponse, ErrorResponse
)

# DB 연동 추가
from sqlalchemy.orm import Session
from db import get_db
from db_models import Document, DocumentStatus, IndexJob, IndexJobType, IndexJobStatus

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

# -------------------- Admin: Reconcile --------------------
@app.post(f"{settings.API_PREFIX}/admin/reconcile")
async def reconcile_indexes(db: Session = Depends(get_db)):
    """업로드 폴더, DB, Chroma 상태를 비교하여 인덱싱 작업 계획을 생성합니다.
    - 신규 파일: documents에 pending으로 upsert + index_jobs에 index 생성
    - 변경 파일: documents를 reindexing으로 업데이트 + index_jobs에 reindex 생성
    - 사라진 파일: documents를 deleted로 마킹 + index_jobs에 delete 생성
    - Chroma 누락: DB는 indexed인데 해당 컬렉션이 없으면 reindex 작업 생성
    실제 인덱싱 실행은 /admin/index/run 에서 처리합니다.
    """
    upload_dir = settings.UPLOAD_DIR
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)

    # 로컬 PDF 스캔
    local_files: Dict[str, Dict[str, Any]] = {}
    for name in os.listdir(upload_dir):
        if not name.lower().endswith('.pdf'):
            continue
        path = os.path.join(upload_dir, name)
        stat = os.stat(path)
        # 체크섬 계산
        hasher = hashlib.md5()
        with open(path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        local_files[path] = {
            "source_path": path,
            "file_size": stat.st_size,
            "mtime": datetime.fromtimestamp(stat.st_mtime),
            "checksum": hasher.hexdigest()
        }

    # DB 조회
    db_docs: List[Document] = db.query(Document).all()
    db_by_path = {doc.source_path: doc for doc in db_docs}

    local_paths = set(local_files.keys())
    db_paths = set(db_by_path.keys())

    to_index = []
    to_delete = []
    to_reindex = []

    # 신규/변경 감지
    for path, meta in local_files.items():
        doc = db_by_path.get(path)
        if not doc:
            to_index.append(meta)
        else:
            if doc.file_size != meta["file_size"] or doc.checksum != meta["checksum"]:
                to_reindex.append((doc, meta))

    # 고아 레코드 감지(파일 삭제됨)
    for path in db_paths - local_paths:
        doc = db_by_path[path]
        if doc.status != DocumentStatus.DELETED.value:
            to_delete.append(doc)

    # Chroma 컬렉션 존재 여부 검증
    chroma_missing = []
    try:
        chroma_collections = set()
        if getattr(document_processor, "chroma_client", None):
            for c in document_processor.chroma_client.list_collections():
                # 일부 버전은 객체, 일부는 dict를 반환할 수 있음
                name = getattr(c, "name", None) or (c.get("name") if isinstance(c, dict) else None)
                if name:
                    chroma_collections.add(name)
    except Exception as e:
        logger.warning(f"Chroma list_collections 실패: {e}")
        chroma_collections = set()

    for doc in db_docs:
        if doc.status == DocumentStatus.INDEXED.value:
            expected_uuid = None
            try:
                expected_uuid = uuid.uuid5(uuid.NAMESPACE_URL, doc.source_path)
            except Exception:
                pass
            expected_collection = doc.chroma_collection or (f"document_{expected_uuid}" if expected_uuid else None)
            if expected_collection and expected_collection not in chroma_collections:
                # 컬렉션이 없으므로 재인덱싱 대상으로 추가
                to_reindex.append((doc, {
                    "file_size": doc.file_size,
                    "mtime": doc.mtime,
                    "checksum": doc.checksum,
                }))
                chroma_missing.append(doc.source_path)

    # DB 적용 및 작업 큐 생성
    created = 0
    updated = 0
    enqueued = 0

    for meta in to_index:
        doc = Document(
            source_path=meta["source_path"],
            file_size=meta["file_size"],
            mtime=meta["mtime"],
            checksum=meta["checksum"],
            status=DocumentStatus.PENDING.value,
            chroma_collection=None,
            version=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(doc)
        db.flush()  # doc.id 확보
        job = IndexJob(
            document_id=doc.id,
            job_type=IndexJobType.INDEX.value,
            job_status=IndexJobStatus.QUEUED.value,
            created_at=datetime.utcnow(),
        )
        db.add(job)
        created += 1
        enqueued += 1

    for doc, meta in to_reindex:
        doc.file_size = meta.get("file_size", doc.file_size)
        doc.mtime = meta.get("mtime", doc.mtime)
        doc.checksum = meta.get("checksum", doc.checksum)
        doc.status = DocumentStatus.REINDEXING.value
        doc.updated_at = datetime.utcnow()
        job = IndexJob(
            document_id=doc.id,
            job_type=IndexJobType.REINDEX.value,
            job_status=IndexJobStatus.QUEUED.value,
            created_at=datetime.utcnow(),
        )
        db.add(job)
        updated += 1
        enqueued += 1

    for doc in to_delete:
        doc.status = DocumentStatus.DELETED.value
        doc.updated_at = datetime.utcnow()
        job = IndexJob(
            document_id=doc.id,
            job_type=IndexJobType.DELETE.value,
            job_status=IndexJobStatus.QUEUED.value,
            created_at=datetime.utcnow(),
        )
        db.add(job)
        updated += 1
        enqueued += 1

    db.commit()

    return {
        "summary": {
            "local_files": len(local_files),
            "db_records": len(db_docs),
            "to_index": len(to_index),
            "to_reindex": len(to_reindex),
            "to_delete": len(to_delete),
            "chroma_missing": len(chroma_missing),
            "created": created,
            "updated": updated,
            "enqueued": enqueued,
        },
        "samples": {
            "index": [m["source_path"] for m in to_index][:5],
            "reindex": [d.source_path for d, _ in to_reindex][:5],
            "delete": [d.source_path for d in to_delete][:5],
            "chroma_missing": chroma_missing[:5],
        }
    }

# -------------------- Admin: Index Worker --------------------
@app.post(f"{settings.API_PREFIX}/admin/index/run")
async def run_index_worker(limit: int = Query(10, ge=1, le=100), db: Session = Depends(get_db)):
    """큐에 쌓인 작업을 최대 limit개까지 실행합니다. (동기/단순 워커)
    - index/reindex: 파일 경로에서 문서를 처리하고 Chroma에 반영
    - delete: Chroma 및 파일 정리
    처리 결과에 따라 documents.status 및 jobs 상태를 갱신합니다.
    """
    jobs: List[IndexJob] = (
        db.query(IndexJob)
        .filter(IndexJob.job_status == IndexJobStatus.QUEUED.value)
        .order_by(IndexJob.created_at.asc())
        .limit(limit)
        .all()
    )

    processed = 0
    succeeded = 0
    failed = 0

    for job in jobs:
        doc: Document = db.query(Document).get(job.document_id)
        if not doc:
            job.job_status = IndexJobStatus.FAILED.value
            job.error_message = "Document not found"
            job.finished_at = datetime.utcnow()
            failed += 1
            continue

        try:
            job.job_status = IndexJobStatus.RUNNING.value
            db.commit()

            # 문서 ID는 경로 기반 고정 UUID로 생성
            doc_uuid = uuid.uuid5(uuid.NAMESPACE_URL, doc.source_path)
            file_path = doc.source_path

            if job.job_type == IndexJobType.DELETE.value:
                # 파일이 이미 없는 경우도 고려하여 Chroma만 정리
                document_processor.cleanup_document(str(doc_uuid))
                doc.status = DocumentStatus.DELETED.value
                doc.updated_at = datetime.utcnow()

            else:
                # 파일 존재 확인
                if not os.path.exists(file_path):
                    raise FileNotFoundError(f"file not found: {file_path}")
                # 인덱싱/재인덱싱 수행
                result = await document_processor.process_pdf(file_path, str(doc_uuid))
                doc.status = DocumentStatus.INDEXED.value
                doc.chroma_collection = f"document_{doc_uuid}"
                doc.version = doc.version + 1
                doc.updated_at = datetime.utcnow()

            job.job_status = IndexJobStatus.SUCCEEDED.value
            job.finished_at = datetime.utcnow()
            succeeded += 1
        except Exception as e:
            job.job_status = IndexJobStatus.FAILED.value
            job.error_message = str(e)
            job.finished_at = datetime.utcnow()
            failed += 1
        finally:
            processed += 1
            db.commit()

    return {
        "processed": processed,
        "succeeded": succeeded,
        "failed": failed,
        "remaining": db.query(IndexJob).filter(IndexJob.job_status == IndexJobStatus.QUEUED.value).count(),
    }

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
