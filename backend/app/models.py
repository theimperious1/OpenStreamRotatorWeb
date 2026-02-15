"""SQLAlchemy ORM models for users, teams, memberships, and OSR instances."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
import enum


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class TeamRole(str, enum.Enum):
    owner = "owner"
    content_manager = "content_manager"
    moderator = "moderator"
    viewer = "viewer"


class InstanceStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    paused = "paused"  # streamer is live


class InviteStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    revoked = "revoked"


import secrets


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


def _invite_code() -> str:
    return secrets.token_urlsafe(16)


# ──────────────────────────────────────────────
# Models
# ──────────────────────────────────────────────

class User(Base):
    """A user authenticated via Discord OAuth."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    discord_id: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    discord_username: Mapped[str] = mapped_column(String(128))
    discord_avatar: Mapped[str | None] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    memberships: Mapped[list["TeamMember"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Team(Base):
    """A team that manages one 24/7 stream."""

    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(128))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    members: Mapped[list["TeamMember"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    instances: Mapped[list["OSRInstance"]] = relationship(back_populates="team", cascade="all, delete-orphan")
    invites: Mapped[list["TeamInvite"]] = relationship(back_populates="team", cascade="all, delete-orphan")


class TeamMember(Base):
    """Membership linking a user to a team with a role."""

    __tablename__ = "team_members"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"))
    role: Mapped[TeamRole] = mapped_column(SAEnum(TeamRole), default=TeamRole.viewer)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Relationships
    user: Mapped["User"] = relationship(back_populates="memberships")
    team: Mapped["Team"] = relationship(back_populates="members")


class TeamInvite(Base):
    """An invite link that grants access to a team with a specific role."""

    __tablename__ = "team_invites"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"))
    invited_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"))
    code: Mapped[str] = mapped_column(String(32), unique=True, index=True, default=_invite_code)
    role: Mapped[TeamRole] = mapped_column(SAEnum(TeamRole), default=TeamRole.viewer)
    status: Mapped[InviteStatus] = mapped_column(SAEnum(InviteStatus), default=InviteStatus.pending)
    max_uses: Mapped[int] = mapped_column(Integer, default=0)  # 0 = unlimited
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship(back_populates="invites")
    creator: Mapped["User"] = relationship()


class OSRInstance(Base):
    """A connected OSR instance (the Python program running on someone's machine)."""

    __tablename__ = "osr_instances"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    team_id: Mapped[str] = mapped_column(String(36), ForeignKey("teams.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128), default="Default Instance")
    api_key: Mapped[str] = mapped_column(String(64), unique=True, index=True, default=_uuid)
    status: Mapped[InstanceStatus] = mapped_column(SAEnum(InstanceStatus), default=InstanceStatus.offline)
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    # Snapshot of latest state reported by the instance
    current_video: Mapped[str | None] = mapped_column(Text, nullable=True)
    current_playlist: Mapped[str | None] = mapped_column(String(256), nullable=True)
    current_category: Mapped[str | None] = mapped_column(String(256), nullable=True)
    obs_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    uptime_seconds: Mapped[int] = mapped_column(Integer, default=0)
    hls_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    team: Mapped["Team"] = relationship(back_populates="instances")
