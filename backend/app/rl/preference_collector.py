"""
Preference pair collector for DPO training.

Preference pairs are collected from three signal types:
1. explicit_rating — user explicitly clicks thumbs up/down
2. edit           — user edits a resume (edited = preferred over unedited version)
3. outcome        — application got an interview response (positive outcome)

Each pair is stored in the resume_preferences table as:
  { chosen_version_id, rejected_version_id, signal_type }

Once 50+ pairs are collected, the DPO trainer can be run.
"""
from __future__ import annotations

import uuid
import logging
from typing import Literal

logger = logging.getLogger(__name__)

SignalType = Literal["explicit_rating", "edit", "outcome"]


async def collect_preference_pair(
    user_id: str,
    chosen_version_id: str,
    rejected_version_id: str,
    signal_type: SignalType,
) -> bool:
    """
    Save a (chosen, rejected) preference pair for DPO training.

    Returns True if saved successfully.
    """
    try:
        from app.core.database import AsyncSessionLocal
        from app.models.resume import ResumePreference

        async with AsyncSessionLocal() as db:
            pref = ResumePreference(
                id=uuid.uuid4(),
                user_id=uuid.UUID(user_id),
                chosen_version_id=uuid.UUID(chosen_version_id),
                rejected_version_id=uuid.UUID(rejected_version_id),
                signal_type=signal_type,
            )
            db.add(pref)
            await db.commit()
        return True
    except Exception as e:
        logger.warning(f"Failed to save preference pair: {e}")
        return False


async def get_preference_count(user_id: str) -> int:
    """Return the total number of preference pairs collected for a user."""
    from app.core.database import AsyncSessionLocal
    from app.models.resume import ResumePreference
    from sqlalchemy import select, func

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(func.count()).where(ResumePreference.user_id == uuid.UUID(user_id))
        )
        return result.scalar_one() or 0


async def get_training_pairs(user_id: str, min_pairs: int = 50) -> list[dict] | None:
    """
    Return training pairs if enough have been collected, else None.

    Each pair is:
    {
        "chosen": "<resume markdown>",
        "rejected": "<resume markdown>",
        "signal_type": "explicit_rating"
    }
    """
    count = await get_preference_count(user_id)
    if count < min_pairs:
        logger.info(f"Not enough preference pairs for user {user_id}: {count}/{min_pairs}")
        return None

    from app.core.database import AsyncSessionLocal
    from app.models.resume import ResumePreference, ResumeVersion
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ResumePreference)
            .options(
                selectinload(ResumePreference.chosen),
                selectinload(ResumePreference.rejected),
            )
            .where(ResumePreference.user_id == uuid.UUID(user_id))
        )
        pairs = result.scalars().all()

    return [
        {
            "chosen": p.chosen.content,
            "rejected": p.rejected.content,
            "signal_type": p.signal_type,
        }
        for p in pairs
        if p.chosen and p.rejected
    ]
