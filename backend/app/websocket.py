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
from datetime import datetime, timezone
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import OSRInstance, InstanceStatus

logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages active WebSocket connections for both OSR instances and browsers."""

    def __init__(self):
        # instance_id → WebSocket (one OSR instance per connection)
        self.osr_connections: dict[str, WebSocket] = {}
        # instance_id → set of browser WebSockets
        self.browser_connections: dict[str, set[WebSocket]] = {}
        # instance_id → latest state snapshot (for new browser connections)
        self.state_cache: dict[str, dict] = {}

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

    async def connect_browser(self, instance_id: str, websocket: WebSocket):
        await websocket.accept()
        if instance_id not in self.browser_connections:
            self.browser_connections[instance_id] = set()
        self.browser_connections[instance_id].add(websocket)
        logger.info(f"Browser subscribed to instance {instance_id}")

        # Send cached state immediately so the UI populates without waiting
        cached = self.state_cache.get(instance_id)
        if cached:
            await websocket.send_json({"type": "state", "data": cached})

    def disconnect_browser(self, instance_id: str, websocket: WebSocket):
        subs = self.browser_connections.get(instance_id)
        if subs:
            subs.discard(websocket)
            if not subs:
                del self.browser_connections[instance_id]

    async def broadcast_to_browsers(self, instance_id: str, message: dict):
        """Send a message to all browsers watching this instance."""
        subs = self.browser_connections.get(instance_id, set())
        dead = []
        for ws in subs:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            subs.discard(ws)

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
        """Forward a log entry from OSR to subscribed browsers."""
        await self.broadcast_to_browsers(instance_id, {"type": "log", "data": log})


# Singleton
manager = ConnectionManager()
