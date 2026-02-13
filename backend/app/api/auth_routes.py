"""Discord OAuth2 authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User
from app.schemas import TokenResponse, UserOut
from app.auth import (
    get_discord_login_url,
    exchange_code,
    fetch_discord_user,
    create_access_token,
    get_current_user,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/discord/login")
async def discord_login():
    """Redirect the user to Discord's OAuth2 authorization page."""
    return RedirectResponse(get_discord_login_url())


@router.get("/discord/callback", response_model=TokenResponse)
async def discord_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Handle the Discord OAuth2 callback.

    Exchanges the code for tokens, fetches the user profile, upserts the
    user in our database, and returns a JWT.
    """
    settings = get_settings()
    try:
        token_data = await exchange_code(code)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to exchange code")

    try:
        discord_user = await fetch_discord_user(token_data["access_token"])
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to fetch Discord user")

    discord_id = str(discord_user["id"])
    username = discord_user.get("username", "unknown")
    avatar = discord_user.get("avatar")
    avatar_url = f"https://cdn.discordapp.com/avatars/{discord_id}/{avatar}.png" if avatar else None

    # Upsert user
    result = await db.execute(select(User).where(User.discord_id == discord_id))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(discord_id=discord_id, discord_username=username, discord_avatar=avatar_url)
        db.add(user)
    else:
        user.discord_username = username
        user.discord_avatar = avatar_url

    await db.commit()
    await db.refresh(user)

    # In production, redirect to frontend with token in URL fragment
    # For now, return the JWT directly
    access_token = create_access_token(user.id)

    # Redirect to frontend with token
    return RedirectResponse(f"{settings.frontend_url}/auth/callback?token={access_token}")


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return user
