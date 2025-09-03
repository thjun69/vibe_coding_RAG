import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

class Settings:
    # OpenAI API 설정
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    
    # CORS 설정
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    
    # 파일 업로드 설정
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "52428800"))  # 50MB
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    CHROMADB_PERSIST_DIRECTORY: str = os.getenv("CHROMADB_PERSIST_DIRECTORY", "./chroma_db")
    
    # API 설정
    API_PREFIX: str = os.getenv("API_PREFIX", "/api")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # LLM 설정
    LLM_MODEL: str = "gpt-3.5-turbo"
    EMBEDDING_MODEL: str = "text-embedding-ada-002"
    
    # 문서 처리 설정
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    MAX_CHUNKS_PER_DOCUMENT: int = 100
    
    # Mock 모드 설정 (OpenAI API 할당량 부족 시 사용)
    USE_MOCK_MODE: bool = os.getenv("USE_MOCK_MODE", "false").lower() == "true"

settings = Settings()
