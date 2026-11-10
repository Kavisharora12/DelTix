"""Route registration for the Memory Service."""

from fastapi import APIRouter

from api.handlers import router as memory_router

api_router = APIRouter()
api_router.include_router(memory_router)
