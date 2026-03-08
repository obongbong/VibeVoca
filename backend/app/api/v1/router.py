"""
VibeVoca — API v1 Router Aggregator
모든 v1 엔드포인트를 하나의 api_router에 집결합니다.
"""
from fastapi import APIRouter

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.voca import router as sets_router
from app.api.v1.endpoints.voca import review_router

api_router = APIRouter()

# /api/v1/auth
api_router.include_router(auth_router)

# /api/v1/sets  (GET /sets, GET /sets/{id}/today, GET /sets/{id}/progress)
api_router.include_router(sets_router)

# /api/v1/review  (POST /review)
api_router.include_router(review_router)
