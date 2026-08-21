"""Phase 5 — authenticated WebSocket booking events (RAD FR-04 / FR-12).

The WebSocket handler is driven directly with a fake socket on the same event
loop as the httpx client, so realtime delivery is exercised end to end against
the real REST endpoints without a second event loop fighting the asyncpg pool.
"""

import asyncio
import json
from uuid import uuid4

import pytest
from starlette.websockets import WebSocketDisconnect

from app.api.routes.ws import booking_events as ws_endpoint
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.db.session import AsyncSessionLocal
from app.models.booking import BookingStatus
from app.models.profile import MechanicProfile
from app.models.user import User, UserRole
from app.models.vehicle import FuelType, Vehicle, VehicleType
from app.services import booking_events as events_module
from app.services.booking_events import STATUS_EVENTS, build_event
from app.services.realtime import ConnectionManager, manager


class FakeWebSocket:
    """Minimal WebSocket double: records sends, blocks on receive until closed."""

    def __init__(self):
        self.sent: list = []
        self.accepted = False
        self.close_code = None
        self._closed = asyncio.Event()

    async def accept(self):
        self.accepted = True

    async def send_json(self, payload):
        self.sent.append(payload)

    async def receive_text(self):
        await self._closed.wait()
        raise WebSocketDisconnect(1000)

    async def close(self, code=1000):
        self.close_code = code
        self._closed.set()

    def hang_up(self):
        self._closed.set()

    def events(self, of_type=None):
        return [e for e in self.sent if of_type is None or e.get("type") == of_type]


async def _user(email, role, phone):
    async with AsyncSessionLocal() as s:
        u = User(email=email, phone_number=phone,
                 hashed_password=get_password_hash("password"), role=role)
        s.add(u); await s.commit(); await s.refresh(u)
        return u


async def open_socket(token) -> tuple:
    """Run the endpoint as a background task and wait for the CONNECTED frame."""
    ws = FakeWebSocket()
    task = asyncio.create_task(ws_endpoint(ws, token=token))
    for _ in range(50):
        if ws.sent or ws.close_code is not None or task.done():
            break
        await asyncio.sleep(0.01)
    return ws, task


async def close_socket(ws, task):
    ws.hang_up()
    try:
        await asyncio.wait_for(task, timeout=1)
    except (asyncio.TimeoutError, WebSocketDisconnect):
        task.cancel()


@pytest.fixture
async def parties():
    customer = await _user("rt-cust@e.com", UserRole.CUSTOMER, "+15551110001")
    mechanic = await _user("rt-mech@e.com", UserRole.MECHANIC, "+15551110002")
    async with AsyncSessionLocal() as s:
        profile = MechanicProfile(
            user_id=mechanic.id, garage_name="RT Garage", owner_name="O", experience_years=3,
            specialization="General", supported_vehicle_types=[VehicleType.CAR], address="1 Rd",
            city="Ahmedabad", state="GJ", country="India", latitude=23.02, longitude=72.57,
            service_radius_km=25.0, working_start_time="09:00", working_end_time="18:00")
        vehicle = Vehicle(user_id=customer.id, vehicle_type=VehicleType.CAR, brand="Honda",
                          model="City", fuel_type=FuelType.PETROL)
        s.add_all([profile, vehicle])
        await s.commit()
        await s.refresh(profile); await s.refresh(vehicle)
    return {
        "customer": customer, "mechanic": mechanic,
        "customer_token": create_access_token(subject=str(customer.id)),
        "mechanic_token": create_access_token(subject=str(mechanic.id)),
        "profile_id": str(profile.id), "vehicle_id": str(vehicle.id),
    }


def auth(token):
    return {"Authorization": f"Bearer {token}"}


async def create_booking(client, parties):
    res = await client.post("/api/v1/bookings/", headers=auth(parties["customer_token"]), json={
        "mechanic_profile_id": parties["profile_id"], "vehicle_type": "CAR",
        "problem_description": "Engine will not start",
        "service_latitude": 23.0225, "service_longitude": 72.5714})
    assert res.status_code == 201, res.text
    return res.json()["data"]["id"]


# ------------------------------------------------------------------ authentication

@pytest.mark.asyncio
@pytest.mark.parametrize("token", ["nonsense", "", "a.b.c"])
async def test_an_invalid_token_is_refused(token):
    ws, task = await open_socket(token)
    await close_socket(ws, task)
    assert ws.accepted is False
    assert ws.close_code == 1008
    assert ws.sent == []


@pytest.mark.asyncio
async def test_a_refresh_token_cannot_open_a_socket(parties):
    ws, task = await open_socket(create_refresh_token(subject=str(parties["customer"].id)))
    await close_socket(ws, task)
    assert ws.accepted is False
    assert ws.close_code == 1008


@pytest.mark.asyncio
async def test_a_token_for_an_unknown_user_is_refused():
    ws, task = await open_socket(create_access_token(subject=str(uuid4())))
    await close_socket(ws, task)
    assert ws.accepted is False
    assert ws.close_code == 1008


@pytest.mark.asyncio
async def test_an_authenticated_user_connects_and_disconnects(parties):
    ws, task = await open_socket(parties["customer_token"])
    assert ws.accepted is True
    assert ws.sent == [{"type": "CONNECTED"}]
    assert manager.connection_count(parties["customer"].id) == 1

    await close_socket(ws, task)
    assert manager.connection_count(parties["customer"].id) == 0


# ------------------------------------------------------------------ delivery

@pytest.mark.asyncio
async def test_both_parties_receive_booking_created(client, parties):
    cust_ws, cust_task = await open_socket(parties["customer_token"])
    mech_ws, mech_task = await open_socket(parties["mechanic_token"])

    booking_id = await create_booking(client, parties)

    for ws in (cust_ws, mech_ws):
        created = ws.events("BOOKING_CREATED")
        assert created, ws.sent
        assert created[0] == {"type": "BOOKING_CREATED", "booking_id": booking_id,
                              "status": "PENDING"}

    await close_socket(cust_ws, cust_task)
    await close_socket(mech_ws, mech_task)


@pytest.mark.asyncio
async def test_every_transition_reaches_the_customer(client, parties):
    cust_ws, cust_task = await open_socket(parties["customer_token"])
    booking_id = await create_booking(client, parties)

    for action, event_type in (("accept", "BOOKING_ACCEPTED"),
                               ("start", "BOOKING_STARTED"),
                               ("complete", "BOOKING_COMPLETED")):
        res = await client.post(f"/api/v1/bookings/{booking_id}/{action}",
                                headers=auth(parties["mechanic_token"]))
        assert res.status_code == 200, res.text
        assert cust_ws.events(event_type), (action, cust_ws.sent)

    assert [e["type"] for e in cust_ws.sent] == [
        "CONNECTED", "BOOKING_CREATED", "BOOKING_ACCEPTED",
        "BOOKING_STARTED", "BOOKING_COMPLETED",
    ]
    await close_socket(cust_ws, cust_task)


@pytest.mark.asyncio
@pytest.mark.parametrize("action,event_type", [("reject", "BOOKING_REJECTED"),
                                               ("cancel", "BOOKING_CANCELLED")])
async def test_terminal_transitions_emit_their_event(client, parties, action, event_type):
    cust_ws, cust_task = await open_socket(parties["customer_token"])
    booking_id = await create_booking(client, parties)
    token = parties["mechanic_token"] if action == "reject" else parties["customer_token"]

    assert (await client.post(f"/api/v1/bookings/{booking_id}/{action}",
                              headers=auth(token))).status_code == 200
    assert cust_ws.events(event_type)
    await close_socket(cust_ws, cust_task)


@pytest.mark.asyncio
async def test_a_failed_transition_emits_no_event(client, parties):
    cust_ws, cust_task = await open_socket(parties["customer_token"])
    booking_id = await create_booking(client, parties)

    # start before accept -> 409
    bad = await client.post(f"/api/v1/bookings/{booking_id}/start",
                            headers=auth(parties["mechanic_token"]))
    assert bad.status_code == 409
    assert cust_ws.events("BOOKING_STARTED") == []
    assert [e["type"] for e in cust_ws.sent] == ["CONNECTED", "BOOKING_CREATED"]

    await close_socket(cust_ws, cust_task)


# ------------------------------------------------------------------ authorization

@pytest.mark.asyncio
async def test_an_uninvolved_user_receives_nothing(client, parties):
    outsider = await _user("rt-outsider@e.com", UserRole.CUSTOMER, "+15551110003")
    out_ws, out_task = await open_socket(create_access_token(subject=str(outsider.id)))
    cust_ws, cust_task = await open_socket(parties["customer_token"])

    booking_id = await create_booking(client, parties)
    await client.post(f"/api/v1/bookings/{booking_id}/accept",
                      headers=auth(parties["mechanic_token"]))

    assert cust_ws.events("BOOKING_ACCEPTED")
    assert out_ws.sent == [{"type": "CONNECTED"}]  # nothing but the handshake

    await close_socket(out_ws, out_task)
    await close_socket(cust_ws, cust_task)


@pytest.mark.asyncio
async def test_another_mechanic_receives_nothing(client, parties):
    rival = await _user("rt-rival@e.com", UserRole.MECHANIC, "+15551110004")
    rival_ws, rival_task = await open_socket(create_access_token(subject=str(rival.id)))

    await create_booking(client, parties)

    assert rival_ws.sent == [{"type": "CONNECTED"}]
    await close_socket(rival_ws, rival_task)


@pytest.mark.asyncio
async def test_events_target_exactly_the_two_parties(client, parties, monkeypatch):
    recipients = []

    class Recorder:
        async def send_to_users(self, user_ids, payload):
            recipients.append(set(user_ids))

    monkeypatch.setattr(events_module, "manager", Recorder())
    booking_id = await create_booking(client, parties)
    await client.post(f"/api/v1/bookings/{booking_id}/accept",
                      headers=auth(parties["mechanic_token"]))

    expected = {parties["customer"].id, parties["mechanic"].id}
    assert recipients and all(r == expected for r in recipients), recipients


# ------------------------------------------------------------------ manager unit

@pytest.mark.asyncio
async def test_manager_tracks_and_evicts_broken_sockets():
    class Socket:
        def __init__(self, broken=False):
            self.sent, self.broken = [], broken

        async def accept(self):
            return None

        async def send_json(self, payload):
            if self.broken:
                raise RuntimeError("socket closed")
            self.sent.append(payload)

    m = ConnectionManager()
    user = uuid4()
    good, bad = Socket(), Socket(broken=True)
    await m.connect(user, good)
    await m.connect(user, bad)
    assert m.connection_count(user) == 2

    await m.send_to_user(user, {"type": "PING"})

    assert good.sent == [{"type": "PING"}]
    assert m.connection_count(user) == 1  # broken socket evicted, no exception
    await m.disconnect(user, good)
    assert m.connection_count(user) == 0


def test_event_payload_carries_no_private_details():
    class FakeBooking:
        id = "b-1"
        status = BookingStatus.ACCEPTED

    payload = build_event(FakeBooking(), STATUS_EVENTS[BookingStatus.ACCEPTED])
    assert payload == {"type": "BOOKING_ACCEPTED", "booking_id": "b-1", "status": "ACCEPTED"}
    body = json.dumps(payload)
    for leaked in ("problem", "phone", "address", "email", "customer_id", "mechanic_id"):
        assert leaked not in body
