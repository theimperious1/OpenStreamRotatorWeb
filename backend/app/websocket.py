"""WebSocket manager for OSR instance ↔ browser connections.

Two types of WebSocket connections:
1. OSR instances connect with their API key and push state updates.
2. Browser clients connect with a JWT and subscribe to an instance's state.

Commands flow: browser → backend → OSR instance
State flows:   OSR instance → backend → browser(s)
"""

import asyncio
import json
import logging
from collections import deque
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OSRInstance, InstanceStatus

logger = logging.getLogger(__name__)

# Maximum number of log entries cached per instance
LOG_CACHE_SIZE = 2000


class ConnectionManager:
    """Manages active WebSocket connections for both OSR instances and browsers."""

    def __init__(self):
        # instance_id → WebSocket (one OSR instance per connection)
        self.osr_connections: dict[str, WebSocket] = {}
        # instance_id → dict of {WebSocket: {"role": str, "user_id": str}}
        self.browser_connections: dict[str, dict[WebSocket, dict]] = {}
        # instance_id → latest state snapshot (for new browser connections)
        self.state_cache: dict[str, dict] = {}
        # instance_id → ring buffer of recent log entries
        self.log_cache: dict[str, deque] = {}

    # ── OSR Instance connections ──

    async def connect_osr(self, instance_id: str, websocket: WebSocket):
        await websocket.accept()
        self.osr_connections[instance_id] = websocket
        logger.info(f"OSR instance {instance_id} connected")

    def disconnect_osr(self, instance_id: str):
        self.osr_connections.pop(instance_id, None)
        logger.info(f"OSR instance {instance_id} disconnected")

    async def send_command_to_osr(self, instance_id: str, command: dict) -> bool:
        """Send a command to a connected OSR instance. Returns True if delivered."""
        ws = self.osr_connections.get(instance_id)
        if ws is None:
            logger.warning(f"Cannot send command to {instance_id}: no OSR connection")
            return False
        try:
            await ws.send_json(command)
            logger.info(f"Command delivered to OSR {instance_id}: {command.get('action', command)}")
            return True
        except Exception as e:
            logger.error(f"Failed to deliver command to OSR {instance_id}: {e}")
            self.disconnect_osr(instance_id)
            return False

    # ── Browser connections ──

    async def connect_browser(self, instance_id: str, websocket: WebSocket, role: str = "viewer", user_id: str = ""):
        await websocket.accept()
        if instance_id not in self.browser_connections:
            self.browser_connections[instance_id] = {}
        self.browser_connections[instance_id][websocket] = {"role": role, "user_id": user_id}
        logger.info(f"Browser subscribed to instance {instance_id} (role={role}, user={user_id})")

        # Send cached state immediately so the UI populates without waiting
        cached = self.state_cache.get(instance_id)
        if cached:
            await websocket.send_json({"type": "state", "data": cached})

        # Send cached log entries (skip for viewers)
        if role != "viewer":
            cached_logs = self.log_cache.get(instance_id)
            if cached_logs:
                # Send oldest-first as a batch so the frontend can prepend them
                await websocket.send_json({
                    "type": "log_history",
                    "data": list(cached_logs),
                })

    def disconnect_browser(self, instance_id: str, websocket: WebSocket):
        subs = self.browser_connections.get(instance_id)
        if subs:
            subs.pop(websocket, None)
            if not subs:
                del self.browser_connections[instance_id]

    async def kick_user(self, user_id: str, instance_ids: list[str]):
        """Close all WebSocket connections for a user across the given instances.

        Called when a team member is removed so they stop receiving live data.
        """
        for iid in instance_ids:
            subs = self.browser_connections.get(iid)
            if not subs:
                continue
            to_kick = [ws for ws, info in subs.items() if info["user_id"] == user_id]
            for ws in to_kick:
                subs.pop(ws, None)
                try:
                    await ws.close(code=4003, reason="Removed from team")
                except Exception:
                    pass  # already closed
                logger.info(f"Kicked user {user_id} from instance {iid}")
            if not subs:
                del self.browser_connections[iid]

    async def broadcast_to_browsers(self, instance_id: str, message: dict, exclude_roles: set[str] | None = None):
        """Send a message to all browsers watching this instance.
        
        If exclude_roles is provided, skip connections with those roles.
        """
        subs = self.browser_connections.get(instance_id, {})
        dead = []
        for ws, info in subs.items():
            if exclude_roles and info["role"] in exclude_roles:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            subs.pop(ws, None)

    # ── State management ──

    async def handle_state_update(self, instance_id: str, state: dict, db: AsyncSession):
        """Process a state update from an OSR instance.

        Updates the database snapshot and broadcasts to all subscribed browsers.
        """
        self.state_cache[instance_id] = state

        # Update DB
        result = await db.execute(select(OSRInstance).where(OSRInstance.id == instance_id))
        instance = result.scalar_one_or_none()
        if instance:
            instance.status = InstanceStatus(state.get("status", "online"))
            instance.current_video = state.get("current_video")
            instance.current_playlist = state.get("current_playlist")
            instance.current_category = json.dumps(state["current_category"]) if isinstance(state.get("current_category"), dict) else state.get("current_category")
            instance.obs_connected = state.get("obs_connected", False)
            instance.uptime_seconds = state.get("uptime_seconds", 0)
            instance.last_seen = datetime.now(timezone.utc)
            await db.commit()

        # Broadcast to browsers
        await self.broadcast_to_browsers(instance_id, {"type": "state", "data": state})

    async def handle_log_entry(self, instance_id: str, log: dict):
        """Forward a log entry from OSR to subscribed browsers and cache it.
        
        Viewers are excluded — they don't have access to logs.
        """
        # Cache for future browser connections
        if instance_id not in self.log_cache:
            self.log_cache[instance_id] = deque(maxlen=LOG_CACHE_SIZE)
        self.log_cache[instance_id].append(log)

        await self.broadcast_to_browsers(instance_id, {"type": "log", "data": log}, exclude_roles={"viewer"})


# Singleton
manager = ConnectionManager()
