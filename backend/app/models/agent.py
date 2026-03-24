import uuid
from typing import Optional
from sqlalchemy import String, Text, ForeignKey, JSON, Enum as SAEnum, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
import enum

from app.models.base import Base, TimestampMixin


class AgentRunStatus(str, enum.Enum):
    running = "running"
    paused = "paused"
    completed = "completed"
    failed = "failed"


class AgentRun(Base, TimestampMixin):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    status: Mapped[str] = mapped_column(SAEnum(AgentRunStatus), default=AgentRunStatus.running, nullable=False)
    current_step: Mapped[Optional[str]] = mapped_column(String(100))
    jobs_scraped: Mapped[int] = mapped_column(default=0)
    jobs_scored: Mapped[int] = mapped_column(default=0)
    jobs_approved: Mapped[int] = mapped_column(default=0)
    applications_submitted: Mapped[int] = mapped_column(default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    thread_id: Mapped[Optional[str]] = mapped_column(String(100))   # LangGraph checkpoint thread
    run_config: Mapped[Optional[dict]] = mapped_column(JSON)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float)
