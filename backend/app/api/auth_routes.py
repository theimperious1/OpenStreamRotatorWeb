"""Discord OAuth2 authentication endpoints."""

import json
import base64
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User, TeamInvite, InviteStatus
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
async def discord_login(request: Request, redirect: str | None = None, origin: str | None = None):
    """Redirect the user to Discord's OAuth2 authorization page.
    
    Detects the caller's origin from the explicit `origin` query param,
    falling back to the Referer header. This ensures the callback redirects
    back to the correct host (e.g. domain name vs IP vs localhost).
    """
    frontend_origin = None

    # Prefer explicit origin query param (set by the frontend login button)
    if origin:
        frontend_origin = origin
    else:
        # Fall back to Referer header
        referer = request.headers.get("referer", "")
        if referer:
            from urllib.parse import urlparse
            parsed = urlparse(referer)
            if parsed.scheme and parsed.netloc:
                frontend_origin = f"{parsed.scheme}://{parsed.netloc}"
    
    return RedirectResponse(get_discord_login_url(frontend_origin, redirect))


@router.get("/discord/callback", response_model=TokenResponse)
async def discord_callback(
    code: str | None = None,
    error: str | None = None,
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

    # Handle OAuth denial (user clicked Cancel on Discord)
    if error or not code:
        return RedirectResponse(
            f"{frontend_origin}/auth/callback?error={error or 'access_denied'}"
        )
    
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
        # -- Closed-registration gate --
        if not settings.allow_public_registration:
            # Always allow the very first user (initial setup)
            user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0

            # Validate the invite code from the redirect path (e.g. /invite/abc123)
            has_valid_invite = False
            if redirect_path:
                match = re.match(r"^/invite/([A-Za-z0-9_-]+)$", redirect_path)
                if match:
                    invite_code = match.group(1)
                    invite_result = await db.execute(
                        select(TeamInvite).where(
                            TeamInvite.code == invite_code,
                            TeamInvite.status == InviteStatus.pending,
                        )
                    )
                    invite = invite_result.scalar_one_or_none()
                    if invite is not None:
                        now = datetime.now(timezone.utc)
                        not_expired = invite.expires_at is None or invite.expires_at > now
                        not_maxed = invite.max_uses == 0 or invite.use_count < invite.max_uses
                        has_valid_invite = not_expired and not_maxed

            if user_count > 0 and not has_valid_invite:
                # Block new registration — redirect to frontend with error
                return RedirectResponse(
                    f"{frontend_origin}/auth/callback?error=registration_closed"
                )

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


@router.get("/registration-info")
async def registration_info():
    """Return public registration settings so the frontend can adapt its UI."""
    settings = get_settings()
    return {"public_registration": settings.allow_public_registration}
