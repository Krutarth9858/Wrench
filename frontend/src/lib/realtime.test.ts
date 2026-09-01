import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeToBookings, type BookingEvent } from './realtime';
import { setAuthToken } from './api';

class FakeSocket {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  closed = false;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
  open() {
    this.onopen?.();
  }
  emit(data: unknown) {
    this.onmessage?.({ data: typeof data === 'string' ? data : JSON.stringify(data) });
  }
  static last() {
    return FakeSocket.instances[FakeSocket.instances.length - 1];
  }
}

const EVENT: BookingEvent = { type: 'BOOKING_ACCEPTED', booking_id: 'b-1', status: 'ACCEPTED' };

/**
 * The handshake now mints a single-use ticket over REST before opening the
 * socket, so connecting is asynchronous. Let those microtasks run without
 * advancing the fake timers that drive the reconnect backoff.
 */
const flush = () => vi.advanceTimersByTimeAsync(0);

const ticketResponse = () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ status: 'success', message: null, data: { ticket: 'tkt-1', expires_in: 30 } }),
  } as unknown as Response);

describe('subscribeToBookings', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    setAuthToken('token-1');
    vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
    vi.stubGlobal('fetch', vi.fn(ticketResponse));
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it('connects with a single-use ticket and never puts the access token in the URL', async () => {
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn() });
    await flush();
    const { url } = FakeSocket.last();
    expect(url).toMatch(/^ws/);
    expect(url).toContain('/ws/bookings?ticket=tkt-1');
    // Regression: the access token used to be the query parameter, which put a
    // live bearer token into every access log.
    expect(url).not.toContain('token-1');
    dispose();
  });

  it('does not open a socket when the ticket request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn() });
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    dispose();
  });

  it('does not connect when signed out', async () => {
    setAuthToken(null);
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn() });
    await flush();
    expect(FakeSocket.instances).toHaveLength(0);
    dispose();
  });

  it('resyncs over REST on every connection', async () => {
    const onResync = vi.fn();
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync });
    await flush();
    FakeSocket.last().open();
    expect(onResync).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('delivers a valid booking event', async () => {
    const onEvent = vi.fn();
    const dispose = subscribeToBookings({ onEvent, onResync: vi.fn() });
    await flush();
    FakeSocket.last().open();
    FakeSocket.last().emit(EVENT);
    expect(onEvent).toHaveBeenCalledWith(EVENT);
    dispose();
  });

  it.each([
    ['not json', 'definitely-not-json'],
    ['unknown type', { type: 'SOMETHING_ELSE', booking_id: 'b', status: 'X' }],
    ['missing fields', { type: 'BOOKING_ACCEPTED' }],
  ])('ignores a malformed frame (%s)', async (_label, payload) => {
    const onEvent = vi.fn();
    const dispose = subscribeToBookings({ onEvent, onResync: vi.fn() });
    await flush();
    FakeSocket.last().open();
    expect(() => FakeSocket.last().emit(payload)).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
    dispose();
  });

  it('reports connection state transitions', async () => {
    const onStateChange = vi.fn();
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn(), onStateChange });
    expect(onStateChange).toHaveBeenCalledWith('connecting');
    await flush();
    FakeSocket.last().open();
    expect(onStateChange).toHaveBeenCalledWith('open');
    FakeSocket.last().close();
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
  });

  it('reconnects with backoff and resyncs again', async () => {
    const onResync = vi.fn();
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync });
    await flush();
    FakeSocket.last().open();
    expect(onResync).toHaveBeenCalledTimes(1);

    FakeSocket.last().close();
    expect(FakeSocket.instances).toHaveLength(1); // waits for backoff
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSocket.instances).toHaveLength(2);

    FakeSocket.last().open();
    // REST recovery after reconnect — state missed while offline is picked up here.
    expect(onResync).toHaveBeenCalledTimes(2);
    dispose();
  });

  it('stops reconnecting once disposed', async () => {
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn() });
    await flush();
    FakeSocket.last().open();
    dispose();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
