from fastapi import APIRouter
from app.api.v1 import auth, jobs, applications, resume, agent

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(jobs.router)
api_router.include_router(applications.router)
api_router.include_router(resume.router)
api_router.include_router(agent.router)
