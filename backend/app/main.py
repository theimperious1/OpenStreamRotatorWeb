"""OpenStreamRotator Web — FastAPI application entry point."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import update

from app.config import get_settings
from app.database import async_session
from app.models import OSRInstance, InstanceStatus
from app.api.auth_routes import router as auth_router
from app.api.team_routes import router as team_router
from app.api.invite_routes import router as invite_router
from app.api.ws_routes import router as ws_router
from app.api.bug_report_routes import router as bug_report_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan — Alembic handles schema migrations.

    Run `python -m alembic upgrade head` before starting the server.
    """
    # No OSR instance can be connected at startup — reset stale statuses
    async with async_session() as db:
        await db.execute(
            update(OSRInstance)
            .where(OSRInstance.status != InstanceStatus.offline)
            .values(status=InstanceStatus.offline, obs_connected=False)
        )
        await db.commit()
    yield


app = FastAPI(
    title="OpenStreamRotator Web",
    description="API for the OpenStreamRotator web dashboard",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow frontend origin(s)
settings = get_settings()
_origins: list[str] = []
if settings.allowed_origins:
    _origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
else:
    # Default: allow frontend_url + common local variants
    _origins = [settings.frontend_url]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(auth_router)
app.include_router(team_router)
app.include_router(invite_router)
app.include_router(ws_router)
app.include_router(bug_report_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
