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

describe('subscribeToBookings', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    setAuthToken('token-1');
    vi.stubGlobal('WebSocket', FakeSocket as unknown as typeof WebSocket);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it('connects to the ws endpoint carrying the access token', () => {
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn() });
    expect(FakeSocket.last().url).toMatch(/^ws/);
    expect(FakeSocket.last().url).toContain('/ws/bookings?token=token-1');
    dispose();
  });

  it('does not connect when signed out', () => {
    setAuthToken(null);
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn() });
    expect(FakeSocket.instances).toHaveLength(0);
    dispose();
  });

  it('resyncs over REST on every connection', () => {
    const onResync = vi.fn();
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync });
    FakeSocket.last().open();
    expect(onResync).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('delivers a valid booking event', () => {
    const onEvent = vi.fn();
    const dispose = subscribeToBookings({ onEvent, onResync: vi.fn() });
    FakeSocket.last().open();
    FakeSocket.last().emit(EVENT);
    expect(onEvent).toHaveBeenCalledWith(EVENT);
    dispose();
  });

  it.each([
    ['not json', 'definitely-not-json'],
    ['unknown type', { type: 'SOMETHING_ELSE', booking_id: 'b', status: 'X' }],
    ['missing fields', { type: 'BOOKING_ACCEPTED' }],
  ])('ignores a malformed frame (%s)', (_label, payload) => {
    const onEvent = vi.fn();
    const dispose = subscribeToBookings({ onEvent, onResync: vi.fn() });
    FakeSocket.last().open();
    expect(() => FakeSocket.last().emit(payload)).not.toThrow();
    expect(onEvent).not.toHaveBeenCalled();
    dispose();
  });

  it('reports connection state transitions', () => {
    const onStateChange = vi.fn();
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn(), onStateChange });
    expect(onStateChange).toHaveBeenCalledWith('connecting');
    FakeSocket.last().open();
    expect(onStateChange).toHaveBeenCalledWith('open');
    FakeSocket.last().close();
    expect(onStateChange).toHaveBeenCalledWith('closed');
    dispose();
  });

  it('reconnects with backoff and resyncs again', () => {
    const onResync = vi.fn();
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync });
    FakeSocket.last().open();
    expect(onResync).toHaveBeenCalledTimes(1);

    FakeSocket.last().close();
    expect(FakeSocket.instances).toHaveLength(1); // waits for backoff
    vi.advanceTimersByTime(1000);
    expect(FakeSocket.instances).toHaveLength(2);

    FakeSocket.last().open();
    // REST recovery after reconnect — state missed while offline is picked up here.
    expect(onResync).toHaveBeenCalledTimes(2);
    dispose();
  });

  it('stops reconnecting once disposed', () => {
    const dispose = subscribeToBookings({ onEvent: vi.fn(), onResync: vi.fn() });
    FakeSocket.last().open();
    dispose();
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
