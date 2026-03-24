from celery import Celery
from app.core.config import settings

celery_app = Celery(
    "jobagent",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.agent_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_soft_time_limit=3600,  # 1 hour per agent run
    task_time_limit=7200,
)
