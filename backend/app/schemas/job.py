import uuid
from typing import Optional, Literal
from pydantic import BaseModel


# ─── Job type presets ─────────────────────────────────────────────────────────
# These map user-friendly preset names to search parameters

JOB_PRESETS = {
    "internship": {
        "search_suffix": "internship",
        "job_type": "internship",
        "results_wanted": 30,
    },
    "entry_level": {
        "search_suffix": "entry level",
        "job_type": "full-time",
        "results_wanted": 25,
    },
    "senior": {
        "search_suffix": "senior",
        "job_type": "full-time",
        "results_wanted": 25,
    },
    "remote": {
        "search_suffix": "",
        "job_type": "full-time",
        "location": "Remote",
        "results_wanted": 30,
    },
    "contract": {
        "search_suffix": "",
        "job_type": "contract",
        "results_wanted": 20,
    },
    "part_time": {
        "search_suffix": "",
        "job_type": "part-time",
        "results_wanted": 20,
    },
}


# ─── Read schemas ─────────────────────────────────────────────────────────────

class RawJobRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    source: str
    url: str
    title: str
    company: str
    location: Optional[str]
    description: Optional[str]
    salary_min: Optional[float]
    salary_max: Optional[float]
    salary_currency: Optional[str] = None
    employment_type: Optional[str] = None
    remote: Optional[bool]
    posted_date: Optional[str]


class ScoredJobRead(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    score: float
    score_reasoning: Optional[str]
    matched_skills: Optional[list]
    missing_skills: Optional[list]
    status: str
    raw_job: RawJobRead


# ─── Request schemas ──────────────────────────────────────────────────────────

class ScrapeRequest(BaseModel):
    search_query: str
    location: str = "Remote"
    sites: list[str] = ["linkedin", "indeed", "glassdoor"]
    results_wanted: int = 20
    job_type: Optional[Literal["full-time", "part-time", "internship", "contract", "remote"]] = None
    # Apply a preset which pre-fills job_type and search_suffix
    preset: Optional[Literal["internship", "entry_level", "senior", "remote", "contract", "part_time"]] = None

    def resolved(self) -> dict:
        """Merge preset values into the request, with explicit values taking priority."""
        base = {
            "search_query": self.search_query,
            "location": self.location,
            "sites": self.sites,
            "results_wanted": self.results_wanted,
            "job_type": self.job_type,
        }
        if self.preset and self.preset in JOB_PRESETS:
            preset_vals = JOB_PRESETS[self.preset]
            if preset_vals.get("search_suffix") and preset_vals["search_suffix"] not in base["search_query"]:
                base["search_query"] = f"{base['search_query']} {preset_vals['search_suffix']}".strip()
            if not base["job_type"] and preset_vals.get("job_type"):
                base["job_type"] = preset_vals["job_type"]
            if preset_vals.get("location") and base["location"] == "Remote":
                base["location"] = preset_vals["location"]
            if not self.results_wanted or self.results_wanted == 20:
                base["results_wanted"] = preset_vals.get("results_wanted", 20)
        return base


class JobActionRequest(BaseModel):
    reason: Optional[str] = None
