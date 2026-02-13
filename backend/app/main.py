"""OpenStreamRotator Web — FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.api.auth_routes import router as auth_router
from app.api.team_routes import router as team_router
from app.api.ws_routes import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — Alembic handles schema migrations.

    Run `python -m alembic upgrade head` before starting the server.
    """
    yield


app = FastAPI(
    title="OpenStreamRotator Web",
    description="API for the OpenStreamRotator web dashboard",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin
settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)
app.include_router(team_router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
