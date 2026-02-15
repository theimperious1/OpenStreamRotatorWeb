"""Team management endpoints."""

import time
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import User, Team, TeamMember, TeamRole, OSRInstance
from app.schemas import (
    TeamCreate, TeamOut, TeamDetailOut, TeamMemberOut,
    RoleUpdate, InviteCreate,
    InstanceCreate, InstanceRename, InstanceUpdate, InstanceOut,
)
from app.auth import get_current_user

router = APIRouter(prefix="/teams", tags=["teams"])


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

async def _get_membership(db: AsyncSession, team_id: str, user_id: str) -> TeamMember:
    """Get the user's membership in a team, or 404."""
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not a member of this team")
    return membership


def _require_role(membership: TeamMember, *allowed_roles: TeamRole) -> None:
    """Raise 403 if the member's role is not in the allowed list."""
    if membership.role not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")


# ──────────────────────────────────────────────
# Team CRUD
# ──────────────────────────────────────────────

@router.post("", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
async def create_team(
    body: TeamCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new team. The creator becomes the owner."""
    team = Team(name=body.name)
    db.add(team)
    await db.flush()

    member = TeamMember(user_id=user.id, team_id=team.id, role=TeamRole.owner)
    db.add(member)
    await db.commit()
    await db.refresh(team)
    return team


@router.get("", response_model=list[TeamOut])
async def list_teams(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all teams the user belongs to."""
    result = await db.execute(
        select(Team)
        .join(TeamMember, TeamMember.team_id == Team.id)
        .where(TeamMember.user_id == user.id)
    )
    return result.scalars().all()


@router.get("/{team_id}", response_model=TeamDetailOut)
async def get_team(
    team_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full team details including members and instances."""
    await _get_membership(db, team_id, user.id)

    result = await db.execute(
        select(Team)
        .where(Team.id == team_id)
        .options(
            selectinload(Team.members).selectinload(TeamMember.user),
            selectinload(Team.instances),
        )
    )
    team = result.scalar_one_or_none()
    if team is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")

    # Build member list with discord info
    members_out = [
        TeamMemberOut(
            id=m.id,
            user_id=m.user_id,
            discord_username=m.user.discord_username,
            discord_avatar=m.user.discord_avatar,
            role=m.role,
            joined_at=m.joined_at,
        )
        for m in team.members
    ]

    return TeamDetailOut(
        id=team.id,
        name=team.name,
        created_at=team.created_at,
        members=members_out,
        instances=[InstanceOut.model_validate(i) for i in team.instances],
    )


# ──────────────────────────────────────────────
# Member management
# ──────────────────────────────────────────────

@router.post("/{team_id}/members", response_model=TeamMemberOut, status_code=status.HTTP_201_CREATED)
async def invite_member(
    team_id: str,
    body: InviteCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invite a user (by Discord ID) to the team. Requires owner or content_manager role."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner, TeamRole.content_manager)

    # Find or create the target user
    result = await db.execute(select(User).where(User.discord_id == body.discord_id))
    target_user = result.scalar_one_or_none()
    if target_user is None:
        # Create a placeholder — they'll fill in their profile on first login
        target_user = User(discord_id=body.discord_id, discord_username=f"user_{body.discord_id}")
        db.add(target_user)
        await db.flush()

    # Check not already a member
    existing = await db.execute(
        select(TeamMember).where(
            TeamMember.team_id == team_id,
            TeamMember.user_id == target_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already a member")

    # Prevent non-owners from granting owner role
    if body.role == TeamRole.owner and membership.role != TeamRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can grant owner role")

    new_member = TeamMember(user_id=target_user.id, team_id=team_id, role=body.role)
    db.add(new_member)
    await db.commit()
    await db.refresh(new_member)

    return TeamMemberOut(
        id=new_member.id,
        user_id=target_user.id,
        discord_username=target_user.discord_username,
        discord_avatar=target_user.discord_avatar,
        role=new_member.role,
        joined_at=new_member.joined_at,
    )


@router.patch("/{team_id}/members/{member_id}", response_model=TeamMemberOut)
async def update_member_role(
    team_id: str,
    member_id: str,
    body: RoleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a team member's role. Owner only."""
    my_membership = await _get_membership(db, team_id, user.id)
    _require_role(my_membership, TeamRole.owner)

    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id, TeamMember.team_id == team_id)
        .options(selectinload(TeamMember.user))
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    target.role = body.role
    await db.commit()
    await db.refresh(target)

    return TeamMemberOut(
        id=target.id,
        user_id=target.user_id,
        discord_username=target.user.discord_username,
        discord_avatar=target.user.discord_avatar,
        role=target.role,
        joined_at=target.joined_at,
    )


@router.delete("/{team_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    team_id: str,
    member_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a team member. Owner only. Cannot remove yourself."""
    my_membership = await _get_membership(db, team_id, user.id)
    _require_role(my_membership, TeamRole.owner)

    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id, TeamMember.team_id == team_id)
    )
    target = result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if target.user_id == user.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself")

    await db.delete(target)
    await db.commit()


# ──────────────────────────────────────────────
# OSR Instance management
# ──────────────────────────────────────────────

@router.post("/{team_id}/instances", response_model=InstanceOut, status_code=status.HTTP_201_CREATED)
async def create_instance(
    team_id: str,
    body: InstanceCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new OSR instance for this team. Returns the API key."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner)

    instance = OSRInstance(team_id=team_id, name=body.name)
    db.add(instance)
    await db.commit()
    await db.refresh(instance)
    return instance


@router.patch("/{team_id}/instances/{instance_id}", response_model=InstanceOut)
async def rename_instance(
    team_id: str,
    instance_id: str,
    body: InstanceRename,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Rename an OSR instance. Owner only."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner)

    result = await db.execute(
        select(OSRInstance).where(OSRInstance.id == instance_id, OSRInstance.team_id == team_id)
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    instance.name = body.name
    await db.commit()
    await db.refresh(instance)
    return instance


@router.put("/{team_id}/instances/{instance_id}/hls", response_model=InstanceOut)
async def update_instance_hls(
    team_id: str,
    instance_id: str,
    body: InstanceUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Set or clear the HLS preview URL for an OSR instance. Owner or content_manager."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner, TeamRole.content_manager)

    result = await db.execute(
        select(OSRInstance).where(OSRInstance.id == instance_id, OSRInstance.team_id == team_id)
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    # Allow clearing with empty string or null
    url = (body.hls_url or "").strip() or None
    instance.hls_url = url
    await db.commit()
    await db.refresh(instance)
    return instance


@router.delete("/{team_id}/instances/{instance_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instance(
    team_id: str,
    instance_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete an OSR instance. Owner only."""
    membership = await _get_membership(db, team_id, user.id)
    _require_role(membership, TeamRole.owner)

    result = await db.execute(
        select(OSRInstance).where(OSRInstance.id == instance_id, OSRInstance.team_id == team_id)
    )
    instance = result.scalar_one_or_none()
    if instance is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    await db.delete(instance)
    await db.commit()


# ──────────────────────────────────────────────
# Preview viewer tracking (heartbeat-based)
# ──────────────────────────────────────────────

# Dict of instance_id → dict of user_id → last_heartbeat_timestamp
_preview_watchers: dict[str, dict[str, float]] = {}
_HEARTBEAT_TTL = 20.0  # seconds — clients heartbeat every 10s, expire after 20s


def _count_active_watchers(instance_id: str) -> int:
    """Count watchers whose heartbeat is within the TTL."""
    watchers = _preview_watchers.get(instance_id)
    if not watchers:
        return 0
    now = time.monotonic()
    # Clean up expired entries while counting
    expired = [uid for uid, ts in watchers.items() if now - ts > _HEARTBEAT_TTL]
    for uid in expired:
        del watchers[uid]
    return len(watchers)


@router.post("/{team_id}/instances/{instance_id}/viewers/heartbeat")
async def preview_heartbeat(
    team_id: str,
    instance_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record that a user is actively watching the preview. Called every ~10s by the frontend."""
    await _get_membership(db, team_id, user.id)

    result = await db.execute(
        select(OSRInstance.id).where(OSRInstance.id == instance_id, OSRInstance.team_id == team_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    if instance_id not in _preview_watchers:
        _preview_watchers[instance_id] = {}
    _preview_watchers[instance_id][user.id] = time.monotonic()

    return {"ok": True}


@router.get("/{team_id}/instances/{instance_id}/viewers")
async def get_instance_viewers(
    team_id: str,
    instance_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return how many users are actively watching the preview stream."""
    await _get_membership(db, team_id, user.id)

    result = await db.execute(
        select(OSRInstance.id).where(OSRInstance.id == instance_id, OSRInstance.team_id == team_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instance not found")

    return {"viewers": _count_active_watchers(instance_id)}
