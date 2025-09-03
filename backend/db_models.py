from datetime import datetime
from enum import Enum
from sqlalchemy import (
	Column,
	String,
	Text,
	Integer,
	BigInteger,
	DateTime,
	Boolean,
	ForeignKey,
	CheckConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from db import Base


class DocumentStatus(str, Enum):
	PENDING = "pending"
	INDEXING = "indexing"
	INDEXED = "indexed"
	REINDEXING = "reindexing"
	FAILED = "failed"
	DELETED = "deleted"


class IndexJobType(str, Enum):
	INDEX = "index"
	REINDEX = "reindex"
	DELETE = "delete"


class IndexJobStatus(str, Enum):
	QUEUED = "queued"
	RUNNING = "running"
	SUCCEEDED = "succeeded"
	FAILED = "failed"


class Document(Base):
	__tablename__ = "documents"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	source_path = Column(Text, nullable=False, unique=True)
	file_size = Column(BigInteger, nullable=False)
	mtime = Column(DateTime(timezone=True), nullable=False)
	checksum = Column(String(128), nullable=False)
	status = Column(String(20), nullable=False)
	chroma_collection = Column(String(255), nullable=True)
	version = Column(Integer, nullable=False, default=1)
	created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
	updated_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)

	__table_args__ = (
		CheckConstraint(
			"status in ('pending','indexing','indexed','reindexing','failed','deleted')",
			name="ck_documents_status",
		),
	)

	jobs = relationship("IndexJob", back_populates="document", cascade="all, delete-orphan")


class IndexJob(Base):
	__tablename__ = "index_jobs"

	id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
	job_type = Column(String(20), nullable=False)
	job_status = Column(String(20), nullable=False)
	error_message = Column(Text, nullable=True)
	created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
	finished_at = Column(DateTime(timezone=True), nullable=True)

	__table_args__ = (
		CheckConstraint(
			"job_type in ('index','reindex','delete')",
			name="ck_index_jobs_type",
		),
		CheckConstraint(
			"job_status in ('queued','running','succeeded','failed')",
			name="ck_index_jobs_status",
		),
	)

	document = relationship("Document", back_populates="jobs")
