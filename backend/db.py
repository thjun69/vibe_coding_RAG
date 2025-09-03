from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

from config import settings

# Base는 항상 선언 가능해야 Alembic에서 임포트가 안전합니다
Base = declarative_base()

DATABASE_URL = settings.DATABASE_URL

engine = None
SessionLocal = None

if DATABASE_URL:
	# 로컬 개발/단발 요청에 적합한 풀
	engine = create_engine(
		DATABASE_URL,
		poolclass=NullPool,
		future=True,
		echo=False,
	)
	SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db():
	"""FastAPI 의존성: 요청마다 세션을 제공. 설정이 없으면 명확한 오류 안내."""
	if SessionLocal is None:
		raise RuntimeError("DATABASE_URL is not configured. Set it in .env or environment variables.")
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()
