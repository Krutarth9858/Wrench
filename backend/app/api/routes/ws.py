"""Authenticated WebSocket endpoint for booking events.

Browsers cannot set headers on a WebSocket handshake, so the access token is
passed as a query parameter and validated with the same `decode_token` used by
the REST dependencies. The user id comes from the token's `sub` claim; nothing
identifying is read from the client afterwards.
"""

import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token
from app.db.repositories.user import UserRepository
from app.db.session import AsyncSessionLocal
from app.services.realtime import manager

logger = logging.getLogger(__name__)
router = APIRouter()


async def _authenticate(token: str) -> "User | None":  # noqa: F821
    try:
        payload = decode_token(token)
    except Exception:  # noqa: BLE001 - any malformed/expired token is simply unauthorised
        return None
    if payload.get("type") != "access":
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None
    session: AsyncSession
    async with AsyncSessionLocal() as session:
        user = await UserRepository(session).get_by_id(user_id)
    if not user or not user.is_active:
        return None
    return user


@router.websocket("/bookings")
async def booking_events(websocket: WebSocket, token: str = Query(...)):
    user = await _authenticate(token)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(user.id, websocket)
    try:
        # The channel is server -> client only. Reading keeps the connection open
        # and lets us notice a client going away; inbound frames are ignored so a
        # client can never inject an event.
        await websocket.send_json({"type": "CONNECTED"})
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:  # noqa: BLE001
        logger.debug("websocket error for user %s", user.id)
    finally:
        await manager.disconnect(user.id, websocket)
