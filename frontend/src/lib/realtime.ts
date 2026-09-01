/**
 * Realtime booking channel (RAD FR-04 / FR-12).
 *
 * WebSocket is an accelerator, never the source of truth: every event triggers a
 * REST refetch by the consumer, and every (re)connection does the same. If the
 * socket never connects the UI still works, just without live updates.
 */
import { API_BASE_URL, apiFetchData, getAuthToken } from './api';

export const BOOKING_EVENTS = [
  'BOOKING_CREATED', 'BOOKING_ACCEPTED', 'BOOKING_REJECTED',
  'BOOKING_STARTED', 'BOOKING_COMPLETED', 'BOOKING_CANCELLED',
] as const;
export type BookingEventType = (typeof BOOKING_EVENTS)[number];

export interface BookingEvent {
  type: BookingEventType;
  booking_id: string;
  status: string;
}

export type ConnectionState = 'connecting' | 'open' | 'closed';

interface Handlers {
  onEvent: (event: BookingEvent) => void;
  /** Fired on every successful (re)connection so the caller can resync via REST. */
  onResync: () => void;
  onStateChange?: (state: ConnectionState) => void;
}

const isBookingEvent = (value: unknown): value is BookingEvent => {
  const candidate = value as Partial<BookingEvent> | null;
  return (
    !!candidate &&
    typeof candidate.booking_id === 'string' &&
    typeof candidate.status === 'string' &&
    BOOKING_EVENTS.includes(candidate.type as BookingEventType)
  );
};

/**
 * The handshake cannot carry an Authorization header, so we trade the access
 * token for a single-use ticket over an ordinary authenticated POST. Only the
 * ticket reaches the URL, and it is dead the moment it is redeemed — the access
 * token itself never appears in a query string, log or history entry.
 */
async function socketUrl(): Promise<string> {
  const { ticket } = await apiFetchData<{ ticket: string }>('/ws/ticket', { method: 'POST' });
  const base = API_BASE_URL.replace(/^http/, 'ws');
  return `${base}/ws/bookings?ticket=${encodeURIComponent(ticket)}`;
}

/**
 * Open the booking channel, reconnecting with backoff until `close()` is called.
 * Returns a disposer.
 */
export function subscribeToBookings({ onEvent, onResync, onStateChange }: Handlers): () => void {
  let socket: WebSocket | null = null;
  let retry = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const setState = (state: ConnectionState) => onStateChange?.(state);

  const connect = async () => {
    if (disposed) return;
    if (!getAuthToken()) return; // signed out; nothing to subscribe to

    setState('connecting');
    let ws: WebSocket;
    try {
      const url = await socketUrl();
      if (disposed) return; // signed out or unmounted while minting the ticket
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    socket = ws;

    ws.onopen = () => {
      retry = 0;
      setState('open');
      // REST is authoritative: pull current state rather than trusting that no
      // event was missed while we were disconnected.
      onResync();
    };

    ws.onmessage = (message) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(message.data as string);
      } catch {
        return; // malformed frame: ignore rather than crash the UI
      }
      if (isBookingEvent(parsed)) onEvent(parsed);
    };

    ws.onclose = () => {
      setState('closed');
      scheduleReconnect();
    };

    ws.onerror = () => ws.close();
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    retry += 1;
    const delay = Math.min(1000 * 2 ** (retry - 1), 15_000);
    timer = setTimeout(() => void connect(), delay);
  };

  void connect();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
  };
}
