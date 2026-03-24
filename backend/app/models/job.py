import uuid
from typing import Optional
from sqlalchemy import String, Text, Float, Integer, ForeignKey, JSON, Index, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector
import enum

from app.models.base import Base, TimestampMixin


class JobStatus(str, enum.Enum):
    pending_review = "pending_review"
    approved = "approved"
    rejected = "rejected"
    applied = "applied"


class JobSource(str, enum.Enum):
    linkedin = "linkedin"
    indeed = "indeed"
    glassdoor = "glassdoor"
    ziprecruiter = "ziprecruiter"
    custom = "custom"


class RawJob(Base, TimestampMixin):
    __tablename__ = "raw_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fingerprint: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)  # SHA256 of url
    source: Mapped[str] = mapped_column(SAEnum(JobSource), nullable=False)
    url: Mapped[str] = mapped_column(String(2000), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    company: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(500))
    description: Mapped[Optional[str]] = mapped_column(Text)
    salary_min: Mapped[Optional[float]] = mapped_column(Float)
    salary_max: Mapped[Optional[float]] = mapped_column(Float)
    salary_currency: Mapped[Optional[str]] = mapped_column(String(10))
    employment_type: Mapped[Optional[str]] = mapped_column(String(100))
    remote: Mapped[Optional[bool]] = mapped_column()
    posted_date: Mapped[Optional[str]] = mapped_column(String(50))
    raw_data: Mapped[Optional[dict]] = mapped_column(JSON)

    scored_job: Mapped[Optional["ScoredJob"]] = relationship("ScoredJob", back_populates="raw_job", uselist=False)
    embedding: Mapped[Optional["JobEmbedding"]] = relationship("JobEmbedding", back_populates="job", uselist=False)


class ScoredJob(Base, TimestampMixin):
    __tablename__ = "scored_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    raw_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("raw_jobs.id", ondelete="CASCADE"), unique=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    score: Mapped[float] = mapped_column(Float, nullable=False)
    score_reasoning: Mapped[Optional[str]] = mapped_column(Text)
    matched_skills: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    missing_skills: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(SAEnum(JobStatus), default=JobStatus.pending_review, nullable=False)

    raw_job: Mapped["RawJob"] = relationship("RawJob", back_populates="scored_job")

    __table_args__ = (
        Index("ix_scored_jobs_user_status", "user_id", "status"),
    )


class JobEmbedding(Base):
    __tablename__ = "job_embeddings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("raw_jobs.id", ondelete="CASCADE"), unique=True)
    embedding: Mapped[list] = mapped_column(Vector(1536), nullable=False)  # text-embedding-3-small dim

    job: Mapped["RawJob"] = relationship("RawJob", back_populates="embedding")
