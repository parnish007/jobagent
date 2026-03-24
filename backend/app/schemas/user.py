import uuid
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, field_validator

from app.core.config import settings


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < settings.MIN_PASSWORD_LENGTH:
            raise ValueError(f"Password must be at least {settings.MIN_PASSWORD_LENGTH} characters")
        return v


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    email: str
    full_name: Optional[str]
    is_active: bool


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None


class UserProfileUpdate(BaseModel):
    # Job preferences
    target_titles: Optional[list[str]] = None
    target_locations: Optional[list[str]] = None
    target_industries: Optional[list[str]] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    remote_only: Optional[bool] = None
    blacklisted_companies: Optional[list[str]] = None
    blacklisted_keywords: Optional[list[str]] = None

    # Resume / profile
    base_resume_text: Optional[str] = None
    skills: Optional[list[str]] = None
    years_experience: Optional[int] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None

    # Automation
    auto_approve_score_threshold: Optional[int] = None
    daily_application_limit: Optional[int] = None

    # LLM preference
    preferred_llm_provider: Optional[Literal["claude", "gemini"]] = None

    # Default search config
    default_search_query: Optional[str] = None
    default_search_location: Optional[str] = None
    default_search_sites: Optional[list[str]] = None
    default_job_type: Optional[Literal["full-time", "part-time", "internship", "contract", "remote"]] = None
    default_results_wanted: Optional[int] = None


class UserProfileRead(UserProfileUpdate):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    user_id: uuid.UUID


class QABankItemCreate(BaseModel):
    question: str
    answer: str
    category: Optional[str] = None


class QABankItemRead(QABankItemCreate):
    model_config = {"from_attributes": True}
    id: uuid.UUID
