"""Discord OAuth2 helpers and JWT token management."""

from datetime import datetime, timezone, timedelta
from jose import jwt, JWTError
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx

from app.config import get_settings
from app.database import get_db
from app.models import User

security = HTTPBearer()

DISCORD_API = "https://discord.com/api/v10"
DISCORD_OAUTH_URL = "https://discord.com/api/oauth2/authorize"
DISCORD_TOKEN_URL = "https://discord.com/api/oauth2/token"


# ──────────────────────────────────────────────
# Discord OAuth
# ──────────────────────────────────────────────

def get_discord_login_url() -> str:
    """Build the Discord OAuth2 authorization URL."""
    settings = get_settings()
    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": "identify",
    }
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return f"{DISCORD_OAUTH_URL}?{query}"


async def exchange_code(code: str) -> dict:
    """Exchange an authorization code for Discord access + refresh tokens."""
    settings = get_settings()
    data = {
        "client_id": settings.discord_client_id,
        "client_secret": settings.discord_client_secret,
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": settings.discord_redirect_uri,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(DISCORD_TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


async def fetch_discord_user(access_token: str) -> dict:
    """Fetch the authenticated user's Discord profile."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{DISCORD_API}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp.raise_for_status()
        return resp.json()


# ──────────────────────────────────────────────
# JWT
# ──────────────────────────────────────────────

def create_access_token(user_id: str) -> str:
    """Create a signed JWT for the given user."""
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.jwt_expiry_hours)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> str:
    """Decode and validate a JWT. Returns the user_id (sub claim)."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ──────────────────────────────────────────────
# FastAPI dependency — current user
# ──────────────────────────────────────────────

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Dependency that extracts and validates the JWT, then loads the User."""
    user_id = decode_access_token(credentials.credentials)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user
