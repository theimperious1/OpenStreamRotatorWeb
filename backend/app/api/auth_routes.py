"""Discord OAuth2 authentication endpoints."""

import json
import base64

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
async def discord_login(request: Request, redirect: str | None = None):
    """Redirect the user to Discord's OAuth2 authorization page.
    
    Automatically detects the caller's origin from the Referer header
    so the callback redirects back to the right host (localhost vs public IP).
    """
    # Try to determine the frontend origin from the Referer header
    referer = request.headers.get("referer", "")
    frontend_origin = None
    if referer:
        from urllib.parse import urlparse
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            frontend_origin = f"{parsed.scheme}://{parsed.netloc}"
    
    return RedirectResponse(get_discord_login_url(frontend_origin, redirect))


@router.get("/discord/callback", response_model=TokenResponse)
async def discord_callback(
    code: str,
    state: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """Handle the Discord OAuth2 callback.

    Exchanges the code for tokens, fetches the user profile, upserts the
    user in our database, and redirects to the frontend with a JWT.
    """
    settings = get_settings()
    
    # Decode state to get frontend origin and optional redirect path
    frontend_origin = settings.frontend_url
    redirect_path = "/auth/callback"
    if state:
        try:
            state_data = json.loads(base64.urlsafe_b64decode(state))
            if "origin" in state_data:
                frontend_origin = state_data["origin"]
            if "redirect" in state_data:
                redirect_path = state_data["redirect"]
        except Exception:
            pass  # Fall back to default frontend_url
    
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

    access_token = create_access_token(user.id)

    # Redirect to the frontend that initiated the login
    # If there's a custom redirect path (e.g. /invite/abc), go there with token in query
    if redirect_path and redirect_path != "/auth/callback":
        return RedirectResponse(
            f"{frontend_origin}/auth/callback?token={access_token}&redirect={redirect_path}"
        )
    return RedirectResponse(f"{frontend_origin}/auth/callback?token={access_token}")


@router.get("/me", response_model=UserOut)
async def get_me(user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return user
