import uuid
from typing import Optional
from sqlalchemy import String, Text, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    profile: Mapped[Optional["UserProfile"]] = relationship("UserProfile", back_populates="user", uselist=False)
    qa_bank: Mapped[list["QABank"]] = relationship("QABank", back_populates="user")


class UserProfile(Base, TimestampMixin):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True)

    # Job preferences
    target_titles: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    target_locations: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    target_industries: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    salary_min: Mapped[Optional[int]] = mapped_column()
    salary_max: Mapped[Optional[int]] = mapped_column()
    remote_only: Mapped[bool] = mapped_column(Boolean, default=False)
    blacklisted_companies: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    blacklisted_keywords: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # Resume / profile content
    base_resume_text: Mapped[Optional[str]] = mapped_column(Text)
    skills: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    years_experience: Mapped[Optional[int]] = mapped_column()
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500))
    github_url: Mapped[Optional[str]] = mapped_column(String(500))

    # Automation thresholds
    auto_approve_score_threshold: Mapped[int] = mapped_column(default=85)
    daily_application_limit: Mapped[int] = mapped_column(default=10)

    # LLM provider preference: "claude" | "gemini" | None (use server default)
    preferred_llm_provider: Mapped[Optional[str]] = mapped_column(String(50))

    # Default job search config (used when running the agent from the Run button)
    default_search_query: Mapped[Optional[str]] = mapped_column(String(255))
    default_search_location: Mapped[Optional[str]] = mapped_column(String(255))
    default_search_sites: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    default_job_type: Mapped[Optional[str]] = mapped_column(String(50))  # full-time | part-time | internship | contract | remote
    default_results_wanted: Mapped[int] = mapped_column(default=20)

    user: Mapped["User"] = relationship("User", back_populates="profile")


class QABank(Base, TimestampMixin):
    __tablename__ = "qa_bank"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    question: Mapped[str] = mapped_column(Text, nullable=False)
    answer: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100))  # salary | visa | experience | etc.

    user: Mapped["User"] = relationship("User", back_populates="qa_bank")
