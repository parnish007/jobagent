"""Initial schema

Revision ID: 001
Revises:
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.execute("CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"")

    # users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255)),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("email"),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # user_profiles
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_titles", postgresql.JSON),
        sa.Column("target_locations", postgresql.JSON),
        sa.Column("target_industries", postgresql.JSON),
        sa.Column("salary_min", sa.Integer()),
        sa.Column("salary_max", sa.Integer()),
        sa.Column("remote_only", sa.Boolean(), server_default="false"),
        sa.Column("blacklisted_companies", postgresql.JSON),
        sa.Column("blacklisted_keywords", postgresql.JSON),
        sa.Column("base_resume_text", sa.Text()),
        sa.Column("skills", postgresql.JSON),
        sa.Column("years_experience", sa.Integer()),
        sa.Column("linkedin_url", sa.String(500)),
        sa.Column("github_url", sa.String(500)),
        sa.Column("auto_approve_score_threshold", sa.Integer(), server_default="85"),
        sa.Column("daily_application_limit", sa.Integer(), server_default="10"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id"),
    )

    # qa_bank
    op.create_table(
        "qa_bank",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("question", sa.Text(), nullable=False),
        sa.Column("answer", sa.Text(), nullable=False),
        sa.Column("category", sa.String(100)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # raw_jobs
    op.create_table(
        "raw_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("url", sa.String(2000), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("company", sa.String(500), nullable=False),
        sa.Column("location", sa.String(500)),
        sa.Column("description", sa.Text()),
        sa.Column("salary_min", sa.Float()),
        sa.Column("salary_max", sa.Float()),
        sa.Column("salary_currency", sa.String(10)),
        sa.Column("employment_type", sa.String(100)),
        sa.Column("remote", sa.Boolean()),
        sa.Column("posted_date", sa.String(50)),
        sa.Column("raw_data", postgresql.JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("fingerprint"),
    )
    op.create_index("ix_raw_jobs_fingerprint", "raw_jobs", ["fingerprint"])

    # scored_jobs
    op.create_table(
        "scored_jobs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("raw_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("raw_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("score_reasoning", sa.Text()),
        sa.Column("matched_skills", postgresql.JSON),
        sa.Column("missing_skills", postgresql.JSON),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending_review"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("raw_job_id"),
    )
    op.create_index("ix_scored_jobs_user_status", "scored_jobs", ["user_id", "status"])

    # job_embeddings
    op.create_table(
        "job_embeddings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("raw_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("embedding", sa.Text(), nullable=False),  # stored as JSON array; use pgvector in prod
        sa.UniqueConstraint("job_id"),
    )

    # resume_versions
    op.create_table(
        "resume_versions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scored_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scored_jobs.id", ondelete="SET NULL")),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("rl_score", sa.Float()),
        sa.Column("generation_prompt", sa.Text()),
        sa.Column("user_edited", sa.Boolean(), server_default="false"),
        sa.Column("version_number", sa.Integer(), server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # applications
    op.create_table(
        "applications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("scored_job_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("scored_jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("resume_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("resume_versions.id", ondelete="SET NULL")),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft"),
        sa.Column("submission_method", sa.String(100)),
        sa.Column("submission_url", sa.String(2000)),
        sa.Column("notes", sa.Text()),
        sa.Column("form_answers", postgresql.JSON),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_applications_user_status", "applications", ["user_id", "status"])

    # application_outcomes
    op.create_table(
        "application_outcomes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("application_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("applications.id", ondelete="CASCADE"), nullable=False),
        sa.Column("outcome", sa.String(50), nullable=False),
        sa.Column("response_text", sa.Text()),
        sa.Column("days_to_response", sa.Integer()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("application_id"),
    )

    # resume_preferences
    op.create_table(
        "resume_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chosen_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("resume_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rejected_version_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("resume_versions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("signal_type", sa.String(50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # agent_runs
    op.create_table(
        "agent_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("uuid_generate_v4()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="running"),
        sa.Column("current_step", sa.String(100)),
        sa.Column("jobs_scraped", sa.Integer(), server_default="0"),
        sa.Column("jobs_scored", sa.Integer(), server_default="0"),
        sa.Column("jobs_approved", sa.Integer(), server_default="0"),
        sa.Column("applications_submitted", sa.Integer(), server_default="0"),
        sa.Column("error_message", sa.Text()),
        sa.Column("thread_id", sa.String(100)),
        sa.Column("run_config", postgresql.JSON),
        sa.Column("duration_seconds", sa.Float()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("agent_runs")
    op.drop_table("resume_preferences")
    op.drop_table("application_outcomes")
    op.drop_table("applications")
    op.drop_table("resume_versions")
    op.drop_table("job_embeddings")
    op.drop_table("scored_jobs")
    op.drop_table("raw_jobs")
    op.drop_table("qa_bank")
    op.drop_table("user_profiles")
    op.drop_table("users")
