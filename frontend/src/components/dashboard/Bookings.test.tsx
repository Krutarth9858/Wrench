import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MyBookings from './MyBookings';
import MechanicBookings from './MechanicBookings';
import { ApiError } from '../../lib/api';
import * as bookingApi from '../../lib/booking';

vi.mock('../../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../../lib/booking')>('../../lib/booking');
  return { ...actual, listBookings: vi.fn(), actOnBooking: vi.fn() };
});

const booking = (over: Partial<bookingApi.Booking> = {}): bookingApi.Booking => ({
  id: 'b-1', status: 'PENDING', vehicle_type: 'CAR', problem_description: 'Engine will not start',
  service_latitude: 23.02, service_longitude: 72.57, service_address: 'Ring Road',
  created_at: '2026-08-21T10:00:00Z', updated_at: null,
  vehicle: { id: 'v-1', vehicle_type: 'CAR', brand: 'Honda', model: 'City' },
  customer: { name: 'cust@example.com', phone_number: '+911234567890' },
  mechanic: { name: 'Speedy Auto', phone_number: '+919876543210' },
  ...over,
});

describe('MyBookings (customer)', () => {
  afterEach(() => vi.clearAllMocks());

  it('renders the backend status, never a locally derived one', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'IN_PROGRESS' })]);
    render(<MyBookings />);
    await waitFor(() => expect(screen.getByTestId('booking-status')).toHaveAttribute('data-status', 'IN_PROGRESS'));
    expect(screen.getByTestId('booking-status')).toHaveTextContent('Service in progress');
  });

  it('shows an empty state', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([]);
    render(<MyBookings />);
    await waitFor(() => expect(screen.getByTestId('bookings-empty')).toBeInTheDocument());
  });

  it('cancels a pending booking and reflects the new status', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking()]);
    vi.mocked(bookingApi.actOnBooking).mockResolvedValue(booking({ status: 'CANCELLED' }));
    render(<MyBookings />);
    await waitFor(() => expect(screen.getByTestId('cancel-b-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('cancel-b-1'));

    await waitFor(() => expect(screen.getByTestId('booking-status')).toHaveAttribute('data-status', 'CANCELLED'));
    expect(bookingApi.actOnBooking).toHaveBeenCalledWith('b-1', 'cancel');
  });

  it('hides cancel once work is in progress', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'IN_PROGRESS' })]);
    render(<MyBookings />);
    await waitFor(() => expect(screen.getByTestId('booking-b-1')).toBeInTheDocument());
    expect(screen.queryByTestId('cancel-b-1')).not.toBeInTheDocument();
  });

  it('surfaces a load failure', async () => {
    vi.mocked(bookingApi.listBookings).mockRejectedValue(new ApiError(0, null, 'Cannot reach the backend'));
    render(<MyBookings />);
    await waitFor(() => expect(screen.getByTestId('bookings-error')).toHaveTextContent('Cannot reach'));
  });
});

describe('MechanicBookings', () => {
  afterEach(() => vi.clearAllMocks());

  it('lists incoming requests with customer, vehicle type, problem and location', async () => {
    // The mechanic sees the vehicle TYPE; no Vehicle record is required.
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ vehicle: null })]);
    render(<MechanicBookings />);
    await waitFor(() => expect(screen.getByTestId('jobs-incoming')).toBeInTheDocument());
    expect(screen.getByText('Four-wheeler')).toBeInTheDocument();
    expect(screen.getByText(/cust@example.com/)).toBeInTheDocument();
    expect(screen.getByText('Engine will not start')).toBeInTheDocument();
    expect(screen.getByText(/Ring Road/)).toBeInTheDocument();
  });

  it.each([
    ['accept', 'ACCEPTED'],
    ['reject', 'REJECTED'],
  ] as const)('handles %s on a pending request', async (action, expected) => {
    const user = userEvent.setup();
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking()]);
    vi.mocked(bookingApi.actOnBooking).mockResolvedValue(booking({ status: expected }));
    render(<MechanicBookings />);
    await waitFor(() => expect(screen.getByTestId(`${action}-b-1`)).toBeInTheDocument());

    await user.click(screen.getByTestId(`${action}-b-1`));

    await waitFor(() => expect(bookingApi.actOnBooking).toHaveBeenCalledWith('b-1', action));
    expect(screen.getByTestId('booking-status')).toHaveAttribute('data-status', expected);
  });

  it('starts an accepted job', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'ACCEPTED' })]);
    vi.mocked(bookingApi.actOnBooking).mockResolvedValue(booking({ status: 'IN_PROGRESS' }));
    render(<MechanicBookings />);
    await waitFor(() => expect(screen.getByTestId('start-b-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('start-b-1'));

    await waitFor(() => expect(bookingApi.actOnBooking).toHaveBeenCalledWith('b-1', 'start'));
  });

  it('completes an in-progress job', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'IN_PROGRESS' })]);
    vi.mocked(bookingApi.actOnBooking).mockResolvedValue(booking({ status: 'COMPLETED' }));
    render(<MechanicBookings />);
    await waitFor(() => expect(screen.getByTestId('complete-b-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('complete-b-1'));

    await waitFor(() => expect(bookingApi.actOnBooking).toHaveBeenCalledWith('b-1', 'complete'));
  });

  it('offers no actions on a terminal booking', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'COMPLETED' })]);
    render(<MechanicBookings />);
    await waitFor(() => expect(screen.getByTestId('jobs-past')).toBeInTheDocument());
    for (const a of ['accept', 'reject', 'start', 'complete']) {
      expect(screen.queryByTestId(`${a}-b-1`)).not.toBeInTheDocument();
    }
  });

  it('surfaces a rejected transition from the backend', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking()]);
    vi.mocked(bookingApi.actOnBooking).mockRejectedValue(
      new ApiError(409, null, 'Booking is already CANCELLED and cannot be changed.'),
    );
    render(<MechanicBookings />);
    await waitFor(() => expect(screen.getByTestId('accept-b-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('accept-b-1'));

    await waitFor(() => expect(screen.getByTestId('jobs-error')).toHaveTextContent('already CANCELLED'));
  });
});
