"""WebSocket endpoints for OSR instances and browser clients."""

import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models import OSRInstance, TeamMember
from app.auth import decode_access_token
from app.websocket import manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/osr/{api_key}")
async def osr_instance_ws(websocket: WebSocket, api_key: str):
    """WebSocket endpoint for OSR instances.

    The OSR instance connects with its API key. It sends periodic state
    updates and log entries, and receives commands from the web UI.

    Messages from OSR:
        {"type": "state", "data": {...}}   — state snapshot
        {"type": "log", "data": {...}}     — log entry

    Messages to OSR:
        {"action": "skip_video", "payload": {}}
        {"action": "update_setting", "payload": {"key": "...", "value": "..."}}
        {"action": "trigger_rotation", "payload": {}}
    """
    # Authenticate via API key
    async with async_session() as db:
        result = await db.execute(select(OSRInstance).where(OSRInstance.api_key == api_key))
        instance = result.scalar_one_or_none()
        if instance is None:
            logger.warning(f"OSR connection rejected — invalid API key: {api_key[:8]}...")
            await websocket.close(code=4001, reason="Invalid API key")
            return
        instance_id = instance.id

    logger.info(f"OSR instance connected: {instance_id}")
    await manager.connect_osr(instance_id, websocket)

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            async with async_session() as db:
                if msg_type == "state":
                    await manager.handle_state_update(instance_id, data.get("data", {}), db)
                elif msg_type == "log":
                    await manager.handle_log_entry(instance_id, data.get("data", {}))
    except WebSocketDisconnect:
        logger.info(f"OSR instance disconnected: {instance_id}")
        manager.disconnect_osr(instance_id)

        # Mark instance offline
        async with async_session() as db:
            result = await db.execute(select(OSRInstance).where(OSRInstance.id == instance_id))
            instance = result.scalar_one_or_none()
            if instance:
                instance.status = "offline"
                await db.commit()


@router.websocket("/ws/dashboard/{instance_id}")
async def browser_dashboard_ws(websocket: WebSocket, instance_id: str, token: str = Query(...)):
    """WebSocket endpoint for browser dashboard clients.

    Authenticates via JWT in query param. Subscribes to live state updates
    and log entries from the specified OSR instance.

    Also forwards commands from the browser to the OSR instance:
        {"type": "command", "data": {"action": "...", "payload": {...}}}
    """
    # Authenticate via JWT
    try:
        user_id = decode_access_token(token)
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Verify user has access to this instance's team
    async with async_session() as db:
        result = await db.execute(select(OSRInstance).where(OSRInstance.id == instance_id))
        instance = result.scalar_one_or_none()
        if instance is None:
            await websocket.close(code=4004, reason="Instance not found")
            return

        result = await db.execute(
            select(TeamMember).where(
                TeamMember.team_id == instance.team_id,
                TeamMember.user_id == user_id,
            )
        )
        membership = result.scalar_one_or_none()
        if membership is None:
            await websocket.close(code=4003, reason="Not a team member")
            return
        member_role = membership.role

    await manager.connect_browser(instance_id, websocket, role=member_role)
    logger.info(f"Browser connected for instance {instance_id}, role={member_role}, osr_connected={instance_id in manager.osr_connections}")

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            logger.debug(f"Browser message for {instance_id}: type={msg_type}")

            if msg_type == "command":
                # Only owner, content_manager, moderator can send commands
                if member_role in ("owner", "content_manager", "moderator"):
                    command = data.get("data", {})

                    # Extra gating: reload_env requires content_manager or above
                    if command.get("action") == "reload_env" and member_role not in ("owner", "content_manager"):
                        logger.warning(f"reload_env denied for role={member_role}")
                        await websocket.send_json({
                            "type": "error",
                            "data": {"message": "Insufficient permissions for reload_env"},
                        })
                        continue

                    # Extra gating: update_env requires owner only
                    if command.get("action") == "update_env" and member_role != "owner":
                        logger.warning(f"update_env denied for role={member_role}")
                        await websocket.send_json({
                            "type": "error",
                            "data": {"message": "Only the team owner can edit environment variables"},
                        })
                        continue

                    logger.info(f"Browser command for instance {instance_id}: {command}")
                    logger.info(f"OSR connections: {list(manager.osr_connections.keys())}")
                    delivered = await manager.send_command_to_osr(instance_id, command)
                    logger.info(f"Command delivery result for {instance_id}: delivered={delivered}")
                    await websocket.send_json({
                        "type": "command_ack",
                        "data": {"delivered": delivered},
                    })
                else:
                    logger.warning(f"Insufficient permissions: role={member_role}")
                    await websocket.send_json({
                        "type": "error",
                        "data": {"message": "Insufficient permissions"},
                    })
    except WebSocketDisconnect:
        logger.info(f"Browser disconnected from instance {instance_id}")
        manager.disconnect_browser(instance_id, websocket)
