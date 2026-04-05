"""annapod API — Main Application Entry Point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.seed import seed_database
from app.routers import auth_router, simulator_router, knowledge_router, learning_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle: startup & shutdown."""
    # Startup
    await init_db()
    await seed_database()
    yield
    # Shutdown (cleanup if needed)


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="annapod（安娜心训舱，简称安心舱）— AI-powered counselor training platform. "
    "基于 AnnaAgent 研究成果的心理辅导员智能实训平台。",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers under /api/v1
API_V1 = "/api/v1"
app.include_router(auth_router, prefix=API_V1)
app.include_router(simulator_router, prefix=API_V1)
app.include_router(knowledge_router, prefix=API_V1)
app.include_router(learning_router, prefix=API_V1)


@app.get("/")
async def root():
    return {
        "name": "annapod API",
        "version": settings.APP_VERSION,
        "description": "安娜心训舱（安心舱）心理辅导员智能实训平台",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    return {"status": "ok"}
