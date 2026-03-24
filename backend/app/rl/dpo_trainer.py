"""
DPO (Direct Preference Optimization) fine-tuning pipeline.

DPO is a simpler alternative to PPO-based RLHF:
- No separate reward model training needed
- Works directly on (chosen, rejected) pairs
- Uses HuggingFace TRL's DPOTrainer

When to run:
- After collecting 50+ preference pairs (use get_preference_count() to check)
- Preferably after 100+ pairs for meaningful improvement

The fine-tuned model improves future resume generation by learning the user's
preferences from their approve/reject/edit signals.

Requirements:
  pip install trl transformers datasets torch

Note: Full DPO fine-tuning requires a GPU. For CPU-only environments, we use
sentence-transformer reward scoring (reward_model.py) as a lighter alternative.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# Path where fine-tuned model is saved
MODEL_OUTPUT_DIR = Path(__file__).parent.parent.parent / "models" / "dpo_resume"

# Base model to fine-tune (small enough to run on consumer GPUs)
BASE_MODEL = "google/flan-t5-base"  # ~250MB, CPU-runnable for inference


def check_training_requirements() -> tuple[bool, str]:
    """Check if training requirements are met."""
    try:
        import torch
        import transformers
        import trl
        import datasets
    except ImportError as e:
        return False, f"Missing dependency: {e}. Run: pip install trl transformers datasets torch"

    try:
        import torch
        if not (torch.cuda.is_available() or torch.backends.mps.is_available()):
            return False, "No GPU detected. DPO training is slow on CPU (hours). Continuing anyway..."
    except Exception:
        pass

    return True, "OK"


async def train_dpo(user_id: str, min_pairs: int = 50) -> dict:
    """
    Run DPO fine-tuning with the user's collected preference pairs.

    Returns a result dict with:
    - success: bool
    - message: str
    - pairs_used: int
    - model_path: str | None
    """
    from app.rl.preference_collector import get_training_pairs

    # Check requirements
    ok, msg = check_training_requirements()
    if not ok:
        logger.warning(f"DPO training skipped: {msg}")
        return {"success": False, "message": msg, "pairs_used": 0, "model_path": None}

    # Get training data
    pairs = await get_training_pairs(user_id, min_pairs=min_pairs)
    if pairs is None:
        return {
            "success": False,
            "message": f"Not enough preference pairs (need {min_pairs}). Keep approving/rejecting resumes!",
            "pairs_used": 0,
            "model_path": None,
        }

    logger.info(f"Starting DPO training with {len(pairs)} pairs for user {user_id}")

    try:
        result = await _run_dpo_training(pairs, user_id)
        return result
    except Exception as e:
        logger.error(f"DPO training failed: {e}", exc_info=True)
        return {"success": False, "message": str(e), "pairs_used": len(pairs), "model_path": None}


async def _run_dpo_training(pairs: list[dict], user_id: str) -> dict:
    """Execute the actual DPO training loop (runs in a thread pool)."""
    import asyncio
    return await asyncio.get_event_loop().run_in_executor(None, _train_sync, pairs, user_id)


def _train_sync(pairs: list[dict], user_id: str) -> dict:
    """Synchronous DPO training — runs in a thread pool executor."""
    import torch
    from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
    from trl import DPOTrainer, DPOConfig
    from datasets import Dataset

    # Prepare dataset
    dataset = Dataset.from_list([
        {
            "prompt": "Write a tailored resume for this job application.",
            "chosen": p["chosen"],
            "rejected": p["rejected"],
        }
        for p in pairs
    ])

    # Load base model + tokenizer
    logger.info(f"Loading base model: {BASE_MODEL}")
    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSeq2SeqLM.from_pretrained(BASE_MODEL)

    output_dir = MODEL_OUTPUT_DIR / user_id
    output_dir.mkdir(parents=True, exist_ok=True)

    # DPO training config
    training_args = DPOConfig(
        output_dir=str(output_dir),
        num_train_epochs=3,
        per_device_train_batch_size=2,
        gradient_accumulation_steps=4,
        learning_rate=1e-5,
        beta=0.1,          # KL penalty coefficient (lower = more aggressive)
        max_length=1024,
        max_prompt_length=128,
        logging_steps=10,
        save_strategy="epoch",
        report_to=[],      # Disable wandb/tensorboard for simplicity
        remove_unused_columns=False,
    )

    trainer = DPOTrainer(
        model=model,
        args=training_args,
        train_dataset=dataset,
        tokenizer=tokenizer,
    )

    logger.info("Starting DPO training...")
    trainer.train()

    # Save the fine-tuned model
    trainer.save_model(str(output_dir / "final"))
    tokenizer.save_pretrained(str(output_dir / "final"))

    logger.info(f"DPO training complete. Model saved to {output_dir}/final")
    return {
        "success": True,
        "message": f"DPO fine-tuning complete with {len(pairs)} preference pairs",
        "pairs_used": len(pairs),
        "model_path": str(output_dir / "final"),
    }


def get_fine_tuned_model_path(user_id: str) -> Optional[Path]:
    """Return the path to the user's fine-tuned model if it exists."""
    path = MODEL_OUTPUT_DIR / user_id / "final"
    return path if path.exists() else None
