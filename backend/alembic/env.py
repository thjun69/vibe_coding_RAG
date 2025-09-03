import os
import sys
from logging.config import fileConfig
from dotenv import load_dotenv

from alembic import context
from sqlalchemy import create_engine, pool

# Alembic Config 객체 (alembic.ini 설정 접근)
config = context.config

# 로깅 설정
if config.config_file_name is not None:
	fileConfig(config.config_file_name)

# 프로젝트 경로 추가 (…/backend 기준)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # …/backend/alembic
PROJECT_ROOT = os.path.dirname(BASE_DIR)               # …/backend
if PROJECT_ROOT not in sys.path:
	sys.path.append(PROJECT_ROOT)

# .env 로드
load_dotenv()

# SQLAlchemy Base 및 모델 임포트
from db import Base  # noqa: E402
import db_models     # noqa: F401,E402  # 테이블 등록을 위해 임포트만 필요

target_metadata = Base.metadata


def get_url() -> str:
	url = os.getenv("DATABASE_URL")
	if not url:
		raise RuntimeError("DATABASE_URL is not set in environment/.env")
	return url


def run_migrations_offline() -> None:
	"""오프라인 모드: 엔진 없이 URL로 설정하여 실행"""
	url = get_url()
	context.configure(
		url=url,
		target_metadata=target_metadata,
		literal_binds=True,
		compare_type=True,
		compare_server_default=True,
		dialect_opts={"paramstyle": "named"},
	)
	with context.begin_transaction():
		context.run_migrations()


def run_migrations_online() -> None:
	"""온라인 모드: 엔진/커넥션을 생성하여 실행"""
	connectable = create_engine(get_url(), future=True, poolclass=pool.NullPool)
	with connectable.connect() as connection:
		context.configure(
			connection=connection,
			target_metadata=target_metadata,
			compare_type=True,
			compare_server_default=True,
		)
		with context.begin_transaction():
			context.run_migrations()


if context.is_offline_mode():
	run_migrations_offline()
else:
	run_migrations_online()
