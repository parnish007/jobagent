import uuid
from typing import Optional
from pydantic import BaseModel


class ApplicationRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    user_id: uuid.UUID
    scored_job_id: uuid.UUID
    resume_version_id: Optional[uuid.UUID]
    status: str
    submission_method: Optional[str]
    notes: Optional[str]


class ApplicationOutcomeCreate(BaseModel):
    outcome: str  # interview, rejected, no_response, offer
    response_text: Optional[str] = None
    days_to_response: Optional[int] = None
