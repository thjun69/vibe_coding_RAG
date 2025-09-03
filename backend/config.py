import os
from typing import List
from dotenv import load_dotenv

load_dotenv()

# Mock 모드 활성화 (API 키 문제 해결을 위해)
os.environ["USE_MOCK_MODE"] = "false"

class Settings:
    # Upstage AI API 설정
    UPSTAGE_API_KEY: str = os.getenv("UPSTAGE_API_KEY", "")
    UPSTAGE_BASE_URL: str = os.getenv("UPSTAGE_BASE_URL", "https://api.upstage.ai/v1")
    
    # OpenAI API 설정 (Upstage AI와 호환성을 위해)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", os.getenv("UPSTAGE_API_KEY", ""))
    
    # CORS 설정
    CORS_ORIGINS: List[str] = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
    
    # 파일 업로드 설정
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "52428800"))  # 50MB
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "./uploads")
    CHROMADB_PERSIST_DIRECTORY: str = os.getenv("CHROMADB_PERSIST_DIRECTORY", "./chroma_db")
    
    # API 설정
    API_PREFIX: str = os.getenv("API_PREFIX", "/api")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # LLM 설정 (Upstage AI 공식 모델명)
    LLM_MODEL: str = os.getenv("LLM_MODEL", "solar-pro2")  # 채팅용 모델
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "embedding-query")  # 임베딩용 모델
    
    # 문서 처리 설정
    CHUNK_SIZE: int = 1000
    CHUNK_OVERLAP: int = 200
    MAX_CHUNKS_PER_DOCUMENT: int = 100
    
    # Mock 모드 설정 (Upstage AI API 할당량 부족 시 true로 설정)
    @property
    def USE_MOCK_MODE(self) -> bool:
        mock_mode = os.getenv("USE_MOCK_MODE", "true")  # 기본값을 true로 변경
        return mock_mode.lower() in ["true", "1", "yes", "on"]

settings = Settings()
