import uuid
from typing import Optional
from pydantic import BaseModel


class ResumeVersionRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    content: str
    rl_score: Optional[float]
    user_edited: bool
    version_number: int


class ResumeUpdate(BaseModel):
    content: str


class ResumePreferenceCreate(BaseModel):
    chosen_version_id: uuid.UUID
    rejected_version_id: uuid.UUID
    signal_type: str = "explicit_rating"
