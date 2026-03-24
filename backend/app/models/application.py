import uuid
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, JSON, Enum as SAEnum, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, TimestampMixin


class ApplicationStatus(str, enum.Enum):
    draft = "draft"
    resume_ready = "resume_ready"
    submitted = "submitted"
    responded = "responded"
    interview = "interview"
    offer = "offer"
    rejected = "rejected"
    closed = "closed"


class OutcomeType(str, enum.Enum):
    interview = "interview"
    rejected = "rejected"
    no_response = "no_response"
    offer = "offer"


class Application(Base, TimestampMixin):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    scored_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("scored_jobs.id", ondelete="CASCADE"))
    resume_version_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("resume_versions.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(SAEnum(ApplicationStatus), default=ApplicationStatus.draft, nullable=False)
    submission_method: Mapped[Optional[str]] = mapped_column(String(100))  # easy_apply, quick_apply, custom
    submission_url: Mapped[Optional[str]] = mapped_column(String(2000))
    notes: Mapped[Optional[str]] = mapped_column(Text)
    form_answers: Mapped[Optional[dict]] = mapped_column(JSON)

    scored_job: Mapped["ScoredJob"] = relationship("ScoredJob")
    resume_version: Mapped[Optional["ResumeVersion"]] = relationship("ResumeVersion")
    outcome: Mapped[Optional["ApplicationOutcome"]] = relationship("ApplicationOutcome", back_populates="application", uselist=False)

    __table_args__ = (
        Index("ix_applications_user_status", "user_id", "status"),
    )


class ApplicationOutcome(Base, TimestampMixin):
    __tablename__ = "application_outcomes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), unique=True)
    outcome: Mapped[str] = mapped_column(SAEnum(OutcomeType), nullable=False)
    response_text: Mapped[Optional[str]] = mapped_column(Text)
    days_to_response: Mapped[Optional[int]] = mapped_column()

    application: Mapped["Application"] = relationship("Application", back_populates="outcome")
