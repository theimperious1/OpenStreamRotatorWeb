"""Pydantic schemas for API request/response validation."""

from datetime import datetime
from pydantic import BaseModel
from app.models import TeamRole, InstanceStatus, InviteStatus


# ──────────────────────────────────────────────
# Auth
# ──────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: str
    discord_id: str
    discord_username: str
    discord_avatar: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Teams
# ──────────────────────────────────────────────

class TeamCreate(BaseModel):
    name: str


class TeamOut(BaseModel):
    id: str
    name: str
    created_by: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TeamMemberOut(BaseModel):
    id: str
    user_id: str
    discord_username: str
    discord_avatar: str | None
    role: TeamRole
    joined_at: datetime

    model_config = {"from_attributes": True}


class TeamDetailOut(BaseModel):
    id: str
    name: str
    created_by: str | None = None
    created_at: datetime
    members: list[TeamMemberOut]
    instances: list["InstanceOut"]

    model_config = {"from_attributes": True}


class RoleUpdate(BaseModel):
    role: TeamRole


class InviteCreate(BaseModel):
    discord_id: str
    role: TeamRole = TeamRole.viewer


# ──────────────────────────────────────────────
# Invite links
# ──────────────────────────────────────────────

class InviteLinkCreate(BaseModel):
    role: TeamRole = TeamRole.viewer
    max_uses: int = 0  # 0 = unlimited
    expires_in_hours: int | None = None  # None = never expires


class InviteLinkOut(BaseModel):
    id: str
    team_id: str
    team_name: str
    code: str
    role: TeamRole
    status: InviteStatus
    max_uses: int
    use_count: int
    created_at: datetime
    expires_at: datetime | None
    created_by: str  # discord username

    model_config = {"from_attributes": True}


class InviteInfoOut(BaseModel):
    """Public info shown on the accept page (no sensitive data)."""
    code: str
    team_name: str
    role: TeamRole
    created_by: str
    expires_at: datetime | None
    is_valid: bool


# ──────────────────────────────────────────────
# OSR Instances
# ──────────────────────────────────────────────

class InstanceCreate(BaseModel):
    name: str = "Default Instance"


class InstanceRename(BaseModel):
    name: str


class InstanceUpdate(BaseModel):
    name: str | None = None
    hls_url: str | None = None


class InstanceOut(BaseModel):
    id: str
    team_id: str
    name: str
    api_key: str
    status: InstanceStatus
    last_seen: datetime | None
    created_at: datetime
    current_video: str | None
    current_playlist: str | None
    current_category: str | None
    obs_connected: bool
    uptime_seconds: int
    hls_url: str | None = None

    model_config = {"from_attributes": True}


# ──────────────────────────────────────────────
# Commands (sent from web UI → OSR instance)
# ──────────────────────────────────────────────

class OSRCommand(BaseModel):
    """A command to be relayed to a connected OSR instance."""
    action: str  # e.g. "skip_video", "update_setting", "trigger_rotation"
    payload: dict = {}


# ──────────────────────────────────────────────
# State updates (sent from OSR instance → backend)
# ──────────────────────────────────────────────

class InstanceStateUpdate(BaseModel):
    """Periodic state snapshot from a connected OSR instance."""
    status: InstanceStatus
    current_video: str | None = None
    current_playlist: str | None = None
    current_category: str | None = None
    obs_connected: bool = False
    uptime_seconds: int = 0
