import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MyBookings from '../components/dashboard/MyBookings';
import MechanicBookings from '../components/dashboard/MechanicBookings';
import * as realtime from '../lib/realtime';
import * as bookingApi from '../lib/booking';
import { toast } from 'sonner';

vi.mock('../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../lib/booking')>('../lib/booking');
  return { ...actual, listBookings: vi.fn(), actOnBooking: vi.fn() };
});
vi.mock('../lib/realtime', async () => {
  const actual = await vi.importActual<typeof import('../lib/realtime')>('../lib/realtime');
  return { ...actual, subscribeToBookings: vi.fn() };
});
vi.mock('sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const booking = (over = {}): bookingApi.Booking => ({
  id: 'b-1', status: 'PENDING', vehicle_type: 'CAR', problem_description: 'Engine will not start',
  service_latitude: 23.02, service_longitude: 72.57, service_address: 'Ring Road',
  created_at: '2026-08-21T10:00:00Z', updated_at: null,
  vehicle: { id: 'v-1', vehicle_type: 'CAR', brand: 'Honda', model: 'City' },
  customer: { name: 'cust@example.com', phone_number: null },
  mechanic: { name: 'Speedy Auto', phone_number: null },
  ...over,
});

let handlers: Parameters<typeof realtime.subscribeToBookings>[0];

describe('booking realtime integration', () => {
  beforeEach(() => {
    vi.mocked(realtime.subscribeToBookings).mockImplementation((h) => {
      handlers = h;
      return vi.fn();
    });
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking()]);
  });
  afterEach(() => vi.clearAllMocks());

  it('updates the customer status without a manual refresh', async () => {
    render(<MyBookings />);
    await waitFor(() => expect(screen.getByTestId('booking-status')).toHaveAttribute('data-status', 'PENDING'));

    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'ACCEPTED' })]);
    handlers.onEvent({ type: 'BOOKING_ACCEPTED', booking_id: 'b-1', status: 'ACCEPTED' });

    await waitFor(() => expect(screen.getByTestId('booking-status')).toHaveAttribute('data-status', 'ACCEPTED'));
    expect(toast).toHaveBeenCalledWith('A mechanic accepted your request');
  });

  it('refetches over REST on reconnect rather than trusting the socket', async () => {
    render(<MyBookings />);
    await waitFor(() => expect(bookingApi.listBookings).toHaveBeenCalledTimes(1));

    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'COMPLETED' })]);
    handlers.onResync();

    await waitFor(() => expect(screen.getByTestId('booking-status')).toHaveAttribute('data-status', 'COMPLETED'));
  });

  it('shows the live/offline indicator', async () => {
    render(<MyBookings />);
    await waitFor(() => expect(screen.getByTestId('realtime-state')).toBeInTheDocument());

    handlers.onStateChange?.('open');
    await waitFor(() => expect(screen.getByTestId('realtime-state')).toHaveAttribute('data-state', 'open'));

    handlers.onStateChange?.('closed');
    await waitFor(() => expect(screen.getByTestId('realtime-state')).toHaveAttribute('data-state', 'closed'));
  });

  it('surfaces a new request to the mechanic without a refresh', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([]);
    render(<MechanicBookings />);
    await waitFor(() => expect(screen.getByTestId('jobs-empty')).toBeInTheDocument());

    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking()]);
    handlers.onEvent({ type: 'BOOKING_CREATED', booking_id: 'b-1', status: 'PENDING' });

    await waitFor(() => expect(screen.getByTestId('jobs-incoming')).toBeInTheDocument());
    expect(toast).toHaveBeenCalledWith('New service request');
  });

  it('does not notify the mechanic about their own accept', async () => {
    render(<MechanicBookings />);
    await waitFor(() => expect(bookingApi.listBookings).toHaveBeenCalled());

    handlers.onEvent({ type: 'BOOKING_ACCEPTED', booking_id: 'b-1', status: 'ACCEPTED' });

    await waitFor(() => expect(bookingApi.listBookings).toHaveBeenCalledTimes(2));
    expect(toast).not.toHaveBeenCalled();
  });
});
