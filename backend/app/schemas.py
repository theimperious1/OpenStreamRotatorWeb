"""Pydantic schemas for API request/response validation."""

from datetime import datetime
from pydantic import BaseModel
from app.models import TeamRole, InstanceStatus


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
# OSR Instances
# ──────────────────────────────────────────────

class InstanceCreate(BaseModel):
    name: str = "Default Instance"


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
