"""In-memory WebSocket fan-out for booking events (RAD FR-04 / FR-12).

Single connection authority. Sockets are keyed by user id, which is derived from
the bearer token at connect time — never from anything the client sends.

Scaling limitation: state lives in this process, so with more than one backend
worker a client connected to worker A will not see an event emitted on worker B.
Fixing that needs a shared pub/sub backplane (Redis); see brain.md.
"""

import asyncio
import logging
from collections import defaultdict
from typing import Any, Dict, Iterable, Set
from uuid import UUID

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: Dict[UUID, Set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, user_id: UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[user_id].add(websocket)

    async def disconnect(self, user_id: UUID, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.get(user_id, set()).discard(websocket)
            if not self._connections.get(user_id):
                self._connections.pop(user_id, None)

    def connection_count(self, user_id: UUID) -> int:
        return len(self._connections.get(user_id, set()))

    async def send_to_user(self, user_id: UUID, payload: Dict[str, Any]) -> None:
        """Deliver to every live socket for one user.

        Delivery is best effort: a broken socket is dropped, never raised. Booking
        state has already been committed by the time this runs, so a failed send
        must not surface as a failed request.
        """
        for websocket in list(self._connections.get(user_id, set())):
            try:
                await websocket.send_json(payload)
            except Exception:  # noqa: BLE001 - a dead socket must not break the caller
                logger.debug("dropping dead websocket for user %s", user_id)
                await self.disconnect(user_id, websocket)

    async def send_to_users(self, user_ids: Iterable[UUID], payload: Dict[str, Any]) -> None:
        for user_id in user_ids:
            await self.send_to_user(user_id, payload)


# The single shared instance used by the app.
manager = ConnectionManager()
