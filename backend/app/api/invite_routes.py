"""Invite link management endpoints."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    User, Team, TeamMember, TeamInvite, TeamRole, InviteStatus, _utcnow,
)
from app.schemas import InviteLinkCreate, InviteLinkOut, InviteInfoOut, TeamMemberOut
from app.auth import get_current_user
from app.api.team_routes import _get_membership, _require_role

router = APIRouter(tags=["invites"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _invite_is_valid(invite: TeamInvite) -> bool:
    """Check if an invite is still usable."""
    if invite.status != InviteStatus.pending:
        return False
    if invite.expires_at:
        # SQLite returns naive datetimes; ensure both sides are tz-aware for comparison
        exp = invite.expires_at if invite.expires_at.tzinfo else invite.expires_at.replace(tzinfo=timezone.utc)
        if _utcnow() > exp:
            return False
    if invite.max_uses > 0 and invite.use_count >= invite.max_uses:
        return False
    return True


def _to_invite_out(invite: TeamInvite) -> InviteLinkOut:
    return InviteLinkOut(
        id=invite.id,
        team_id=invite.team_id,
        team_name=invite.team.name,
        code=invite.code,
        role=invite.role,
        status=invite.status,
        max_uses=invite.max_uses,
        use_count=invite.use_count,
        created_at=invite.created_at,
        expires_at=invite.expires_at,
        created_by=invite.creator.discord_username,
    )


# ──────────────────────────────────────────────
# Team-scoped invite management (require membership)
# ──────────────────────────────────────────────

@router.post(
    "/teams/{team_id}/invites",
    response_model=InviteLinkOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_invite(
    team_id: str,
    body: InviteLinkCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an invite link for this team. Owner or content_manager only."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner, TeamRole.content_manager)

    # Cannot create invites granting owner role unless you are the owner
    if body.role == TeamRole.owner and membership.role != TeamRole.owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can create owner-level invites",
        )

    expires_at = None
    if body.expires_in_hours is not None:
        expires_at = _utcnow() + timedelta(hours=body.expires_in_hours)

    invite = TeamInvite(
        team_id=team_id,
        invited_by=user.id,
        role=body.role,
        max_uses=body.max_uses,
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite, attribute_names=["team", "creator"])

    return _to_invite_out(invite)


@router.get("/teams/{team_id}/invites", response_model=list[InviteLinkOut])
async def list_invites(
    team_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all invites for this team. Owner or content_manager only."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner, TeamRole.content_manager)

    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.team_id == team_id)
        .options(selectinload(TeamInvite.team), selectinload(TeamInvite.creator))
        .order_by(TeamInvite.created_at.desc())
    )
    invites = result.scalars().all()
    return [_to_invite_out(inv) for inv in invites]


@router.delete(
    "/teams/{team_id}/invites/{invite_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def revoke_invite(
    team_id: str,
    invite_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke an invite. Owner or content_manager only."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner, TeamRole.content_manager)

    result = await db.execute(
        select(TeamInvite).where(
            TeamInvite.id == invite_id,
            TeamInvite.team_id == team_id,
        )
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    invite.status = InviteStatus.revoked
    await db.commit()


# ──────────────────────────────────────────────
# Public invite endpoints (code-based)
# ──────────────────────────────────────────────

@router.get("/invites/{code}", response_model=InviteInfoOut)
async def get_invite_info(
    code: str,
    db: AsyncSession = Depends(get_db),
):
    """Get public info about an invite link. No auth required."""
    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.code == code)
        .options(selectinload(TeamInvite.team), selectinload(TeamInvite.creator))
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    return InviteInfoOut(
        code=invite.code,
        team_name=invite.team.name,
        role=invite.role,
        created_by=invite.creator.discord_username,
        expires_at=invite.expires_at,
        is_valid=_invite_is_valid(invite),
    )


@router.post("/invites/{code}/accept", response_model=TeamMemberOut)
async def accept_invite(
    code: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Accept an invite link. Requires auth. Creates a new team membership."""
    result = await db.execute(
        select(TeamInvite)
        .where(TeamInvite.code == code)
        .options(selectinload(TeamInvite.team), selectinload(TeamInvite.creator))
    )
    invite = result.scalar_one_or_none()
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite not found")

    if not _invite_is_valid(invite):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="This invite has expired or is no longer valid",
        )

    # Check if user is already a member
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == invite.team_id,
            TeamMember.user_id == user.id,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You are already a member of this team",
        )

    # Create membership
    member = TeamMember(
        user_id=user.id,
        team_id=invite.team_id,
        role=invite.role,
    )
    db.add(member)

    # Increment use count
    invite.use_count += 1
    if invite.max_uses > 0 and invite.use_count >= invite.max_uses:
        invite.status = InviteStatus.accepted

    await db.commit()
    await db.refresh(member, attribute_names=["user"])

    return TeamMemberOut(
        id=member.id,
        user_id=member.user_id,
        discord_username=member.user.discord_username,
        discord_avatar=member.user.discord_avatar,
        role=member.role,
        joined_at=member.joined_at,
    )
