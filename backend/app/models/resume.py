import uuid
from typing import Optional
from sqlalchemy import String, Text, Float, ForeignKey, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ResumeVersion(Base, TimestampMixin):
    __tablename__ = "resume_versions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    scored_job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("scored_jobs.id", ondelete="SET NULL"))
    content: Mapped[str] = mapped_column(Text, nullable=False)       # Markdown or plain text resume
    rl_score: Mapped[Optional[float]] = mapped_column(Float)         # Reward model score
    generation_prompt: Mapped[Optional[str]] = mapped_column(Text)   # Prompt used to generate
    user_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    version_number: Mapped[int] = mapped_column(default=1)

    scored_job: Mapped[Optional["ScoredJob"]] = relationship("ScoredJob")


class ResumePreference(Base, TimestampMixin):
    __tablename__ = "resume_preferences"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    chosen_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("resume_versions.id", ondelete="CASCADE"))
    rejected_version_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("resume_versions.id", ondelete="CASCADE"))
    signal_type: Mapped[str] = mapped_column(String(50))  # explicit_rating, edit, outcome

    chosen: Mapped["ResumeVersion"] = relationship("ResumeVersion", foreign_keys=[chosen_version_id])
    rejected: Mapped["ResumeVersion"] = relationship("ResumeVersion", foreign_keys=[rejected_version_id])
