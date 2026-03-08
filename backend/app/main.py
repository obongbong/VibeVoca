"""
VibeVoca — FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.api.v1.router import api_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    yield
    # shutdown


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# ── CORS ──────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API v1 Routes ─────────────────────────────
app.include_router(api_router, prefix="/api/v1")


# ── Health Check ──────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}

