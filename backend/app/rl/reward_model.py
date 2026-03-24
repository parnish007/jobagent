"""
Reward model for resume scoring using sentence-transformers.

How it works:
1. A "good" resume embeds closer to the job description embedding.
2. We compute cosine similarity between [resume embedding] and [job description embedding].
3. After collecting enough preference pairs, this score is used to rank generated resumes.

This is Phase 2 functionality — the reward model only activates after 50+ preference pairs.
Before that, resumes are generated directly from the LLM without RL scoring.
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Lazy-loaded to avoid import cost on every startup
_model = None
_model_name = "all-MiniLM-L6-v2"  # Fast, 384-dim, great for semantic similarity


def _get_model():
    """Lazy-load the sentence-transformers model."""
    global _model
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_model_name)
            logger.info(f"Reward model loaded: {_model_name}")
        except ImportError:
            raise RuntimeError(
                "sentence-transformers not installed. "
                "Run: pip install sentence-transformers"
            )
    return _model


def score_resume(resume_text: str, job_description: str) -> float:
    """
    Compute a semantic similarity score between the resume and job description.

    Returns a float between -1 and 1 (higher = better fit).
    Typical range for good resumes: 0.3 – 0.8.
    """
    model = _get_model()
    import numpy as np
    from sklearn.metrics.pairwise import cosine_similarity

    embeddings = model.encode([resume_text, job_description])
    score = float(cosine_similarity([embeddings[0]], [embeddings[1]])[0][0])
    return score


def score_resumes_batch(resume_texts: list[str], job_description: str) -> list[float]:
    """Score multiple resumes against a single job description. More efficient than calling score_resume in a loop."""
    model = _get_model()
    from sklearn.metrics.pairwise import cosine_similarity
    import numpy as np

    all_texts = resume_texts + [job_description]
    embeddings = model.encode(all_texts)
    job_emb = embeddings[-1:]
    resume_embs = embeddings[:-1]
    scores = cosine_similarity(resume_embs, job_emb).flatten()
    return scores.tolist()


async def score_and_update_resume(
    resume_version_id: str,
    job_description: str,
) -> Optional[float]:
    """
    Score a resume version and persist the rl_score to the database.

    Returns the score, or None if scoring fails.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.resume import ResumeVersion
        import uuid

        async with AsyncSessionLocal() as db:
            resume = await db.get(ResumeVersion, uuid.UUID(resume_version_id))
            if not resume:
                return None

            score = score_resume(resume.content, job_description)
            resume.rl_score = score
            await db.commit()
            return score

    except Exception as e:
        logger.warning(f"Failed to score resume {resume_version_id}: {e}")
        return None
