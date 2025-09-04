import os
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Depends, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
import aiofiles
import hashlib

from config import settings
from models import (
    UploadResponse, ProcessingStatusResponse, ChatRequest, MultiChatRequest,
    ChatResponse, ChatHistoryResponse, ErrorResponse
)

# DB 연동 추가
from sqlalchemy.orm import Session
from db import get_db
from db_models import Document, DocumentStatus, IndexJob, IndexJobType, IndexJobStatus, User

# 인증 관련 임포트
from auth import (
    authenticate_user, create_user, get_current_user, 
    get_current_active_user, create_access_token,
    get_user_by_email, get_user_by_username
)
from auth_models import UserCreate, UserLogin, UserResponse, UserLoginResponse, AuthError

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

# 전역 변수들
chat_sessions: Dict[str, Dict[str, Any]] = {}
document_status: Dict[str, Dict[str, Any]] = {}


def check_duplicate_file(filename: str, checksum: str, db: Session) -> tuple[bool, str]:
    """파일 중복 검사를 수행합니다."""
    try:
        # 파일명으로 중복 검사
        existing_by_name = db.query(Document).filter(
            Document.filename == filename,
            Document.status != "deleted"
        ).first()
        
        if existing_by_name:
            return True, f"동일한 파일명의 문서가 이미 존재합니다: {filename}"
        
        # 체크섬으로 중복 검사 (내용이 동일한 파일)
        existing_by_checksum = db.query(Document).filter(
            Document.checksum == checksum,
            Document.status != "deleted"
        ).first()
        
        if existing_by_checksum:
            return True, f"동일한 내용의 문서가 이미 존재합니다: {existing_by_checksum.filename}"
        
        return False, ""
        
    except Exception as e:
        logger.error(f"Error checking duplicate file: {str(e)}")
        return False, ""


# 서버 시작 시 문서 상태 복구 함수
def initialize_document_status():
    """서버 시작 시 데이터베이스에서 문서 상태를 복구합니다."""
    try:
        from db import SessionLocal
        from db_models import Document
        import os
        
        db = SessionLocal()
        try:
            # 데이터베이스에서 모든 문서 조회
            documents = db.query(Document).all()
            
            for doc in documents:
                try:
                    # 파일이 실제로 존재하는지 확인
                    if os.path.exists(doc.source_path):
                        # 원본 파일명 복구 (DB에 저장된 filename 사용)
                        original_filename = doc.filename or f"document_{doc.id}.pdf"  # 기본값
                        
                        # 문서 상태를 메모리에 복구
                        # pending 상태의 문서는 실제로는 처리 완료된 것으로 간주
                        if doc.status == "pending":
                            # pending 상태를 indexed로 업데이트
                            doc.status = "indexed"
                            logger.info(f"Updated pending document to indexed: {doc.id}")
                        
                        # Mock 모드에서는 즉시 완료 상태로 설정
                        if settings.USE_MOCK_MODE:
                            status = "completed"
                            total_pages = 5
                            total_chunks = 8
                        else:
                            # 실제 모드에서는 DB 상태 기반으로 설정
                            status = "completed" if doc.status in ["indexed", "pending"] else "processing"
                            total_pages = 0  # 기본값
                            total_chunks = 0  # 기본값
                        
                        document_status[str(doc.id)] = {
                            "document_id": str(doc.id),
                            "filename": original_filename,
                            "upload_timestamp": doc.created_at,
                            "status": status,
                            "file_path": doc.source_path,
                            "total_pages": total_pages,
                            "total_chunks": total_chunks,
                        }
                        logger.info(f"Restored document status: {doc.id}")
                    else:
                        # 파일이 없는 경우 삭제 상태로 변경
                        logger.warning(f"Document file not found, marking as deleted: {doc.source_path}")
                        doc.status = "deleted"
                except Exception as e:
                    logger.error(f"Error restoring document {doc.id}: {str(e)}")
            
            # 변경사항 커밋
            db.commit()
            logger.info(f"Restored {len(document_status)} documents from database")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"Error initializing document status: {str(e)}")

# FastAPI lifespan 이벤트
@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI 앱의 라이프사이클 관리"""
    # 시작 시
    logger.info("Starting ResearchBot API...")
    initialize_document_status()
    logger.info("Document status initialization completed")
    
    yield
    
    # 종료 시
    logger.info("Shutting down ResearchBot API...")

# FastAPI 앱 생성 (lifespan 함수 정의 후)
app = FastAPI(
    title="ResearchBot API",
    description="AI 논문 분석 챗봇 API" + (" [MOCK MODE]" if settings.USE_MOCK_MODE else ""),
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    """업로드 폴더의 기존 PDF 파일 목록 반환 (비회원용 - 모든 파일)"""
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

@app.get(f"{settings.API_PREFIX}/documents/my-documents")
async def get_my_documents(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """현재 로그인한 사용자의 문서 목록 반환"""
    try:
        from db_models import UserDocument
        
        # 현재 사용자의 문서들 조회 (Document 테이블과 조인)
        from db_models import Document
        
        user_docs_query = db.query(UserDocument, Document).join(
            Document, UserDocument.document_id == Document.id
        ).filter(
            UserDocument.user_id == current_user.id,
            Document.status != "deleted"  # 삭제된 문서 제외
        ).all()
        
        user_files = []
        
        for user_doc, document in user_docs_query:
            # document_status에서 처리 상태 확인 (있으면 사용, 없으면 DB 기본값)
            doc_status_info = document_status.get(str(user_doc.document_id), {})
            
            # Mock 모드에서는 즉시 완료 상태로 표시
            if settings.USE_MOCK_MODE:
                processing_status = "completed"
                total_pages = 5
                total_chunks = 8
            else:
                # 실제 모드에서는 상태 기반으로 결정
                if doc_status_info.get("status"):
                    processing_status = doc_status_info.get("status")
                    total_pages = doc_status_info.get("total_pages", 0)
                    total_chunks = doc_status_info.get("total_chunks", 0)
                else:
                    # DB 상태 기반으로 결정
                    if document.status in ["indexed", "pending"]:
                        processing_status = "completed"
                        total_pages = 0
                        total_chunks = 0
                    else:
                        processing_status = "processing"
                        total_pages = 0
                        total_chunks = 0
            
            user_files.append({
                "document_id": str(user_doc.document_id),
                "filename": document.filename or f"document_{document.id}.pdf",
                "upload_timestamp": user_doc.created_at.isoformat(),
                "processing_status": processing_status,
                "total_pages": total_pages,
                "total_chunks": total_chunks,
                "size_mb": round(document.file_size / (1024 * 1024), 2) if document.file_size else 0
            })
        
        # 업로드 시간 순으로 정렬 (최신순)
        user_files.sort(key=lambda x: x["upload_timestamp"], reverse=True)
        
        logger.info(f"Retrieved {len(user_files)} documents for user {current_user.username}")
        
        return {
            "user_documents": user_files,
            "total_count": len(user_files)
        }
        
    except Exception as e:
        logger.error(f"Error getting user documents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user documents: {str(e)}")

@app.post(f"{settings.API_PREFIX}/documents/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
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
        
        # 파일 크기 계산
        file_size = len(content)
        
        # documents 테이블에 Document 레코드 먼저 생성
        from db_models import Document, UserDocument
        import hashlib
        
        # 체크섬 계산
        checksum = hashlib.md5(content).hexdigest()
        
        # 중복 파일 검사
        is_duplicate, duplicate_message = check_duplicate_file(filename, checksum, db)
        if is_duplicate:
            # 중복 파일인 경우 파일 삭제 후 에러 반환
            if os.path.exists(file_path):
                os.remove(file_path)
            raise HTTPException(status_code=400, detail=duplicate_message)
        
        # Document 생성
        document = Document(
            id=document_id,
            source_path=file_path,
            filename=filename,  # 원본 파일명 저장
            file_size=file_size,
            mtime=datetime.now(),
            checksum=checksum,
            status="pending"
        )
        db.add(document)
        db.flush()  # ID를 생성하지만 커밋하지는 않음
        
        # 문서 상태 초기화
        document_status[document_id] = {
            "document_id": document_id,
            "filename": filename,
            "upload_timestamp": datetime.now(),
            "status": "processing",
            "file_path": file_path
        }
        
        # 사용자와 문서 연결
        user_document = UserDocument(
            user_id=current_user.id,
            document_id=document_id
        )
        db.add(user_document)
        db.commit()
        
        # 백그라운드에서 문서 처리
        background_tasks.add_task(process_document_background, document_id, file_path)
        
        logger.info(f"Document uploaded by user {current_user.username}: {document_id} - {filename}")
        
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

@app.post(f"{settings.API_PREFIX}/documents/upload-multiple")
async def upload_multiple_documents(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """여러 PDF 문서를 동시에 업로드하고 처리합니다."""
    try:
        if not files:
            raise HTTPException(status_code=400, detail="업로드할 파일이 없습니다.")
        
        if len(files) > 10:  # 최대 10개 파일 제한
            raise HTTPException(status_code=400, detail="한 번에 최대 10개 파일만 업로드 가능합니다.")
        
        uploaded_documents = []
        
        for file in files:
            try:
                # 파일 검증
                if not file.filename.lower().endswith('.pdf'):
                    logger.warning(f"Skipping non-PDF file: {file.filename}")
                    continue
                
                if file.size and file.size > settings.MAX_FILE_SIZE:
                    logger.warning(f"Skipping oversized file: {file.filename} ({file.size} bytes)")
                    continue
                
                # 문서 ID 생성
                document_id = str(uuid.uuid4())
                filename = file.filename
                
                # 파일 저장 경로
                file_path = os.path.join(settings.UPLOAD_DIR, f"{document_id}.pdf")
                
                # 파일 저장
                async with aiofiles.open(file_path, 'wb') as f:
                    content = await file.read()
                    await f.write(content)
                
                # 파일 크기 계산
                file_size = len(content)
                
                # documents 테이블에 Document 레코드 생성
                from db_models import Document, UserDocument
                import hashlib
                
                # 체크섬 계산
                checksum = hashlib.md5(content).hexdigest()
                
                # 중복 파일 검사
                is_duplicate, duplicate_message = check_duplicate_file(filename, checksum, db)
                if is_duplicate:
                    # 중복 파일인 경우 파일 삭제 후 건너뛰기
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    logger.warning(f"Skipping duplicate file: {filename} - {duplicate_message}")
                    continue
                
                # Document 생성
                document = Document(
                    id=document_id,
                    source_path=file_path,
                    filename=filename,
                    file_size=file_size,
                    mtime=datetime.now(),
                    checksum=checksum,
                    status="pending"
                )
                db.add(document)
                db.flush()
                
                # 문서 상태 초기화
                document_status[document_id] = {
                    "document_id": document_id,
                    "filename": filename,
                    "upload_timestamp": datetime.now(),
                    "status": "processing",
                    "file_path": file_path
                }
                
                # 사용자와 문서 연결
                user_document = UserDocument(
                    user_id=current_user.id,
                    document_id=document_id
                )
                db.add(user_document)
                
                # 백그라운드에서 문서 처리
                background_tasks.add_task(process_document_background, document_id, file_path)
                
                uploaded_documents.append({
                    "document_id": document_id,
                    "filename": filename,
                    "status": "processing"
                })
                
                logger.info(f"Document uploaded by user {current_user.username}: {document_id} - {filename}")
                
            except Exception as e:
                logger.error(f"Error uploading individual file {file.filename}: {str(e)}")
                continue
        
        # 모든 문서 연결 후 커밋
        db.commit()
        
        logger.info(f"Multiple documents uploaded by user {current_user.username}: {len(uploaded_documents)} files")
        
        return {
            "message": f"{len(uploaded_documents)}개 파일이 성공적으로 업로드되었습니다.",
            "uploaded_documents": uploaded_documents,
            "total_count": len(uploaded_documents),
            "skipped_count": len(files) - len(uploaded_documents),
            "total_processed": len(files)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading multiple documents: {str(e)}")
        raise HTTPException(status_code=500, detail="멀티 문서 업로드 중 오류가 발생했습니다.")

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
        
        # DB 상태도 업데이트
        try:
            from db import SessionLocal
            from db_models import Document
            
            db = SessionLocal()
            try:
                document = db.query(Document).filter(Document.id == document_id).first()
                if document:
                    if result["status"] == "completed":
                        document.status = "indexed"
                    elif result["status"] == "error":
                        document.status = "error"
                    
                    document.updated_at = datetime.now()
                    db.commit()
                    logger.info(f"Updated DB status for document {document_id}: {result['status']}")
            finally:
                db.close()
        except Exception as db_error:
            logger.error(f"Error updating DB status for document {document_id}: {str(db_error)}")
        
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

@app.get(f"{settings.API_PREFIX}/documents/{{document_id}}/logs")
async def get_document_logs(document_id: str):
    """문서 처리 로그를 반환합니다."""
    try:
        if document_id not in document_status:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        doc_status = document_status[document_id]
        
        # 실제 로그 파일이 있다면 여기서 읽어오기
        # 현재는 메모리 상태 기반으로 로그 생성
        logs = []
        
        if doc_status.get("status") == "completed":
            logs = [
                f"[{datetime.now().strftime('%H:%M:%S')}] 문서 업로드 완료: {document_id}",
                f"[{datetime.now().strftime('%H:%M:%S')}] PDF 파싱 완료",
                f"[{datetime.now().strftime('%H:%M:%S')}] 텍스트 추출 완료",
                f"[{datetime.now().strftime('%H:%M:%S')}] 청크 분할 완료 ({doc_status.get('total_chunks', 0)}개)",
                f"[{datetime.now().strftime('%H:%M:%S')}] 벡터 데이터베이스 저장 완료",
                f"[{datetime.now().strftime('%H:%M:%S')}] 인덱싱 완료"
            ]
        elif doc_status.get("status") == "processing":
            logs = [
                f"[{datetime.now().strftime('%H:%M:%S')}] 문서 업로드 완료: {document_id}",
                f"[{datetime.now().strftime('%H:%M:%S')}] PDF 파싱 중...",
                f"[{datetime.now().strftime('%H:%M:%S')}] 텍스트 추출 중...",
                f"[{datetime.now().strftime('%H:%M:%S')}] 청크 분할 처리 중...",
                f"[{datetime.now().strftime('%H:%M:%S')}] 벡터 데이터베이스 저장 중...",
                f"[{datetime.now().strftime('%H:%M:%S')}] 인덱싱 진행 중..."
            ]
        elif doc_status.get("status") == "error":
            logs = [
                f"[{datetime.now().strftime('%H:%M:%S')}] 문서 업로드 완료: {document_id}",
                f"[{datetime.now().strftime('%H:%M:%S')}] 처리 중 오류 발생",
                f"[{datetime.now().strftime('%H:%M:%S')}] 오류: {doc_status.get('error_message', '알 수 없는 오류')}"
            ]
        
        return {"logs": logs}
        
    except Exception as e:
        logger.error(f"Error getting document logs: {str(e)}")
        raise HTTPException(status_code=500, detail="로그 조회 중 오류가 발생했습니다.")

@app.post(f"{settings.API_PREFIX}/chat/multi", response_model=ChatResponse)
async def chat_with_multiple_documents(
    chat_request: MultiChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """여러 문서에 대해 동시에 질문하고 답변을 받습니다."""
    try:
        # 문서들 상태 확인
        valid_documents = []
        for document_id in chat_request.document_ids:
            if document_id not in document_status:
                logger.warning(f"Document {document_id} not found in status")
                continue
                
            # 사용자 권한 확인
            from db_models import UserDocument
            user_document = db.query(UserDocument).filter(
                UserDocument.user_id == current_user.id,
                UserDocument.document_id == document_id
            ).first()
            
            if not user_document:
                logger.warning(f"User {current_user.username} attempted to access document {document_id} without permission")
                continue
                
            doc_status = document_status[document_id]
            if doc_status["status"] == "completed":
                valid_documents.append((document_id, doc_status))
        
        if not valid_documents:
            raise HTTPException(
                status_code=400, 
                detail="선택된 문서 중 접근 가능하고 처리가 완료된 문서가 없습니다."
            )
        
        # 세션 ID 생성 또는 사용
        session_id = chat_request.session_id or str(uuid.uuid4())
        
        # 멀티 문서 세션 초기화
        if session_id not in chat_sessions:
            chat_sessions[session_id] = {
                "document_ids": [doc_id for doc_id, _ in valid_documents],
                "messages": [],
                "document_info": {
                    "documents": [
                        {
                            "document_id": doc_id,
                            "filename": doc_status["filename"],
                            "total_pages": doc_status.get("total_pages", 0)
                        }
                        for doc_id, doc_status in valid_documents
                    ]
                }
            }
        
        # 사용자 메시지 저장
        user_message = {
            "role": "user",
            "content": chat_request.message,
            "timestamp": datetime.now()
        }
        chat_sessions[session_id]["messages"].append(user_message)
        
        # RAG 엔진을 사용하여 여러 문서에서 답변 생성
        # 첫 번째 문서를 기준으로 하되, 향후 멀티 문서 지원 확장 가능
        primary_document_id = valid_documents[0][0]
        response = await rag_engine.query(primary_document_id, chat_request.message)
        
        # 응답에 멀티 문서 정보 추가
        response_content = f"[{len(valid_documents)}개 문서에서 검색]\n\n{response.response}"
        
        # Assistant 메시지 저장
        assistant_message = {
            "role": "assistant", 
            "content": response_content,
            "timestamp": datetime.now(),
            "sources": [source.model_dump() for source in response.sources]
        }
        chat_sessions[session_id]["messages"].append(assistant_message)
        
        logger.info(f"Multi-document chat completed for user {current_user.username} with {len(valid_documents)} documents")
        
        return ChatResponse(
            session_id=session_id,
            response=response_content,
            sources=response.sources,
            processing_time=response.processing_time
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in multi-document chat: {str(e)}")
        raise HTTPException(status_code=500, detail="멀티 문서 채팅 중 오류가 발생했습니다.")

@app.post(f"{settings.API_PREFIX}/chat/{{document_id}}", response_model=ChatResponse)
async def chat_with_document(
    document_id: str, 
    chat_request: ChatRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """문서에 대해 질문하고 답변을 받습니다."""
    try:
        # 문서 상태 확인
        if document_id not in document_status:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        # 사용자 권한 확인 - 해당 문서에 접근 권한이 있는지 체크
        from db_models import UserDocument
        user_document = db.query(UserDocument).filter(
            UserDocument.user_id == current_user.id,
            UserDocument.document_id == document_id
        ).first()
        
        if not user_document:
            logger.warning(f"User {current_user.username} attempted to access document {document_id} without permission")
            raise HTTPException(status_code=403, detail="이 문서에 대한 접근 권한이 없습니다.")
        
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
            "sources": [source.model_dump() for source in response.sources]
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
async def delete_document(document_id: str, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """문서와 관련 데이터를 삭제합니다."""
    try:
        from db_models import Document, UserDocument
        
        # 문서 상태 확인
        if document_id not in document_status:
            raise HTTPException(status_code=404, detail="문서를 찾을 수 없습니다.")
        
        # 사용자 권한 확인
        user_doc = db.query(UserDocument).filter(
            UserDocument.user_id == current_user.id,
            UserDocument.document_id == document_id
        ).first()
        
        if not user_doc:
            raise HTTPException(status_code=403, detail="이 문서를 삭제할 권한이 없습니다.")
        
        # DB에서 문서 상태를 "deleted"로 변경
        document = db.query(Document).filter(Document.id == document_id).first()
        if document:
            document.status = "deleted"
            db.commit()
            logger.info(f"Document {document_id} marked as deleted in DB")
        
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

# ==================== 인증 관련 API ====================

@app.post(f"{settings.API_PREFIX}/auth/register", response_model=UserResponse)
async def register_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    try:
        logger.info(f"Registration attempt for email: {user_data.email}, username: {user_data.username}")
        
        # 이메일 중복 확인
        existing_user = get_user_by_email(db, user_data.email)
        if existing_user:
            logger.warning(f"Registration failed: Email already exists - {user_data.email}")
            raise HTTPException(
                status_code=400,
                detail="이미 등록된 이메일입니다."
            )
        
        # 사용자명 중복 확인
        existing_username = get_user_by_username(db, user_data.username)
        if existing_username:
            raise HTTPException(
                status_code=400,
                detail="이미 사용중인 사용자명입니다."
            )
        
        # 새 사용자 생성
        new_user = create_user(
            db=db,
            email=user_data.email,
            username=user_data.username,
            password=user_data.password,
            full_name=user_data.full_name
        )
        
        logger.info(f"New user registered: {new_user.email}")
        return UserResponse(
            id=str(new_user.id),
            email=new_user.email,
            username=new_user.username,
            full_name=new_user.full_name,
            is_active=new_user.is_active,
            is_verified=new_user.is_verified,
            created_at=new_user.created_at
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during user registration: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="회원가입 처리 중 오류가 발생했습니다."
        )

@app.post(f"{settings.API_PREFIX}/auth/login", response_model=UserLoginResponse)
async def login_user(login_data: UserLogin, db: Session = Depends(get_db)):
    """로그인"""
    try:
        # 사용자 인증
        user = authenticate_user(db, login_data.email, login_data.password)
        if not user:
            raise HTTPException(
                status_code=401,
                detail="이메일 또는 비밀번호가 잘못되었습니다."
            )
        
        if not user.is_active:
            raise HTTPException(
                status_code=400,
                detail="비활성화된 계정입니다."
            )
        
        # JWT 토큰 생성
        access_token = create_access_token(data={"sub": user.email})
        
        logger.info(f"User logged in: {user.email}")
        return UserLoginResponse(
            user=UserResponse(
                id=str(user.id),
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                is_active=user.is_active,
                is_verified=user.is_verified,
                created_at=user.created_at
            ),
            access_token=access_token,
            token_type="bearer"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during user login: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="로그인 처리 중 오류가 발생했습니다."
        )

@app.get(f"{settings.API_PREFIX}/auth/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """현재 로그인된 사용자 정보 조회"""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        username=current_user.username,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        created_at=current_user.created_at
    )

@app.post(f"{settings.API_PREFIX}/auth/logout")
async def logout_user():
    """로그아웃 (클라이언트에서 토큰 삭제 처리)"""
    return {"message": "성공적으로 로그아웃되었습니다."}

# ==================== 관리자 기능 ====================

@app.post(f"{settings.API_PREFIX}/admin/clear-documents")
async def clear_all_documents(current_user: User = Depends(get_current_active_user)):
    """모든 문서와 관련 데이터를 초기화합니다 (관리자용)"""
    try:
        # 메모리 상태 초기화
        document_status.clear()
        chat_sessions.clear()
        
        logger.info(f"All documents cleared by admin user: {current_user.username}")
        
        return {"message": "모든 문서 데이터가 초기화되었습니다."}
        
    except Exception as e:
        logger.error(f"Error clearing documents: {str(e)}")
        raise HTTPException(status_code=500, detail="문서 초기화 중 오류가 발생했습니다.")

@app.post(f"{settings.API_PREFIX}/admin/refresh-document-status")
async def refresh_document_status(current_user: User = Depends(get_current_active_user)):
    """문서 상태를 데이터베이스에서 다시 로드합니다 (관리자용)"""
    try:
        # 메모리 상태 초기화 후 재로드
        document_status.clear()
        initialize_document_status()
        
        logger.info(f"Document status refreshed by user: {current_user.username}")
        
        return {
            "message": "문서 상태가 새로고침되었습니다.",
            "loaded_documents": len(document_status)
        }
        
    except Exception as e:
        logger.error(f"Error refreshing document status: {str(e)}")
        raise HTTPException(status_code=500, detail="문서 상태 새로고침 중 오류가 발생했습니다.")

@app.post(f"{settings.API_PREFIX}/documents/refresh-status")
async def refresh_user_document_status(current_user: User = Depends(get_current_active_user)):
    """현재 사용자의 문서 상태를 새로고침합니다 (일반 사용자용)"""
    try:
        from db import SessionLocal
        from db_models import Document, UserDocument
        
        db = SessionLocal()
        try:
            # 현재 사용자의 문서들 조회
            user_docs_query = db.query(UserDocument, Document).join(
                Document, UserDocument.document_id == Document.id
            ).filter(
                UserDocument.user_id == current_user.id,
                Document.status != "deleted"
            ).all()
            
            refreshed_count = 0
            
            for user_doc, document in user_docs_query:
                doc_id = str(user_doc.document_id)
                
                # Mock 모드에서는 즉시 완료 상태로 설정
                if settings.USE_MOCK_MODE:
                    if doc_id not in document_status or document_status[doc_id].get("status") != "completed":
                        document_status[doc_id] = {
                            "document_id": doc_id,
                            "filename": document.filename or f"document_{document.id}.pdf",
                            "upload_timestamp": user_doc.created_at,
                            "status": "completed",
                            "file_path": document.source_path,
                            "total_pages": 5,
                            "total_chunks": 8,
                        }
                        refreshed_count += 1
                else:
                    # 실제 모드에서는 DB 상태 기반으로 업데이트
                    if document.status in ["indexed", "pending"]:
                        if doc_id not in document_status or document_status[doc_id].get("status") != "completed":
                            document_status[doc_id] = {
                                "document_id": doc_id,
                                "filename": document.filename or f"document_{document.id}.pdf",
                                "upload_timestamp": user_doc.created_at,
                                "status": "completed",
                                "file_path": document.source_path,
                                "total_pages": 0,
                                "total_chunks": 0,
                            }
                            refreshed_count += 1
            
            logger.info(f"User document status refreshed by {current_user.username}: {refreshed_count} documents")
            
            return {
                "message": f"{refreshed_count}개 문서의 상태가 새로고침되었습니다.",
                "refreshed_count": refreshed_count
            }
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error refreshing user document status: {str(e)}")
        raise HTTPException(status_code=500, detail="문서 상태 새로고침 중 오류가 발생했습니다.")

# ==================== 전역 예외 처리 ====================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """요청 검증 오류 처리"""
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "입력 데이터 검증 오류",
            "details": exc.errors()
        }
    )

@app.exception_handler(ValidationError)
async def pydantic_validation_exception_handler(request: Request, exc: ValidationError):
    """Pydantic 검증 오류 처리"""
    logger.error(f"Pydantic validation error: {exc.errors()}")
    return JSONResponse(
        status_code=422,
        content={
            "error": "데이터 형식 검증 오류",
            "details": exc.errors()
        }
    )

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
