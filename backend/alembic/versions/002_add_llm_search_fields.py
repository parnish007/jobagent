"""Add LLM provider and search config fields to user_profiles.

Revision ID: 002
Revises: 001
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add LLM provider preference
    op.add_column("user_profiles", sa.Column("preferred_llm_provider", sa.String(50), nullable=True))

    # Add default job search config
    op.add_column("user_profiles", sa.Column("default_search_query", sa.String(255), nullable=True))
    op.add_column("user_profiles", sa.Column("default_search_location", sa.String(255), nullable=True))
    op.add_column("user_profiles", sa.Column("default_search_sites", sa.JSON, nullable=True))
    op.add_column("user_profiles", sa.Column("default_job_type", sa.String(50), nullable=True))
    op.add_column("user_profiles", sa.Column("default_results_wanted", sa.Integer, nullable=False, server_default="20"))


def downgrade() -> None:
    op.drop_column("user_profiles", "preferred_llm_provider")
    op.drop_column("user_profiles", "default_search_query")
    op.drop_column("user_profiles", "default_search_location")
    op.drop_column("user_profiles", "default_search_sites")
    op.drop_column("user_profiles", "default_job_type")
    op.drop_column("user_profiles", "default_results_wanted")
