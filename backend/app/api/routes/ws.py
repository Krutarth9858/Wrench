"""Authenticated WebSocket endpoint for booking events.

Browsers cannot set headers on a WebSocket handshake. Rather than putting the
access token in the query string — where it lands in access logs and history —
the client first POSTs to `/ws/ticket` with normal header auth and connects with
the short-lived, single-use ticket it gets back. See `app.services.ws_tickets`.

The user id comes from the redeemed ticket; nothing identifying is ever read
from the client afterwards.
"""

import logging

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.repositories.user import UserRepository
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.schemas.response import ResponseModel
from app.services import ws_tickets
from app.services.realtime import manager

logger = logging.getLogger(__name__)
router = APIRouter()


async def _authenticate(ticket: str) -> "User | None":  # noqa: F821
    user_id = ws_tickets.redeem(ticket)
    if user_id is None:
        return None
    session: AsyncSession
    async with AsyncSessionLocal() as session:
        user = await UserRepository(session).get_by_id(str(user_id))
    if not user or not user.is_active:
        return None
    return user


class WsTicket(BaseModel):
    ticket: str
    expires_in: int


@router.post("/ticket", response_model=ResponseModel[WsTicket])
async def issue_ws_ticket(current_user: User = Depends(get_current_user)):
    """Exchange header-authenticated credentials for a one-shot socket ticket."""
    return ResponseModel(
        message="Ticket issued",
        data=WsTicket(
            ticket=ws_tickets.issue(current_user.id),
            expires_in=ws_tickets.TICKET_TTL_SECONDS,
        ),
    )


@router.websocket("/bookings")
async def booking_events(websocket: WebSocket, ticket: str = Query(...)):
    user = await _authenticate(ticket)
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
