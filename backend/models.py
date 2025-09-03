from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

class ProcessingStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    ERROR = "error"

class DocumentChunk(BaseModel):
    chunk_id: str
    content: str
    page_number: int
    section: str = ""
    metadata: Dict[str, Any] = {}

class Document(BaseModel):
    document_id: str
    filename: str
    upload_timestamp: datetime
    total_pages: int
    processing_status: ProcessingStatus
    total_chunks: int = 0
    error_message: Optional[str] = None

class UploadResponse(BaseModel):
    document_id: str
    filename: str
    status: ProcessingStatus
    estimated_processing_time: str = "30s"

class ProcessingStatusResponse(BaseModel):
    document_id: str
    status: ProcessingStatus
    total_pages: int
    total_chunks: int
    error_message: Optional[str] = None

class ChatMessage(BaseModel):
    role: str = Field(..., description="user 또는 assistant")
    content: str
    timestamp: datetime = Field(default_factory=datetime.now)
    sources: Optional[List[Dict[str, Any]]] = None

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None

class Source(BaseModel):
    page_number: int
    section: str
    content_snippet: str
    relevance_score: float

class ChatResponse(BaseModel):
    session_id: str
    response: str
    sources: List[Source]
    processing_time: str

class ChatHistoryResponse(BaseModel):
    session_id: str
    messages: List[ChatMessage]
    document_info: Dict[str, Any]

class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
