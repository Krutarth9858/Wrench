import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MechanicOverview from './MechanicOverview';
import MechanicBookings from './MechanicBookings';
import { ApiError } from '../../lib/api';
import * as bookingApi from '../../lib/booking';
import * as mechanicApi from '../../lib/mechanic';

vi.mock('../../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../../lib/booking')>('../../lib/booking');
  return { ...actual, listBookings: vi.fn(), actOnBooking: vi.fn() };
});
vi.mock('../../lib/mechanic', async () => {
  const actual = await vi.importActual<typeof import('../../lib/mechanic')>('../../lib/mechanic');
  return { ...actual, getAvailability: vi.fn(), setAvailability: vi.fn() };
});

const booking = (over: Partial<bookingApi.Booking> = {}): bookingApi.Booking => ({
  id: 'b-1', status: 'PENDING', vehicle_type: 'BIKE',
  problem_description: 'Flat or damaged tyre.',
  service_latitude: 23.02, service_longitude: 72.57, service_address: 'Ring Road',
  created_at: '2026-08-21T10:00:00Z', updated_at: null, vehicle: null,
  customer: { name: 'cust@example.com', phone_number: null },
  mechanic: { name: 'Dev Garage', phone_number: null }, ...over,
});

const ALL = [
  booking({ id: 'b-1', status: 'PENDING' }),
  booking({ id: 'b-2', status: 'ACCEPTED' }),
  booking({ id: 'b-3', status: 'IN_PROGRESS' }),
  booking({ id: 'b-4', status: 'COMPLETED' }),
  booking({ id: 'b-5', status: 'REJECTED' }),
];

const renderOverview = () => render(<MemoryRouter><MechanicOverview /></MemoryRouter>);

describe('MechanicOverview', () => {
  beforeEach(() => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue(ALL);
    vi.mocked(mechanicApi.getAvailability).mockResolvedValue({ is_available: true });
    vi.mocked(mechanicApi.setAvailability).mockImplementation(async (v) => ({ is_available: v }));
  });
  afterEach(() => vi.clearAllMocks());

  it('counts pending, active and completed from real bookings', async () => {
    renderOverview();
    await waitFor(() => expect(screen.getByTestId('mechanic-overview')).toBeInTheDocument());
    expect(screen.getByTestId('tile-pending')).toHaveTextContent('1');
    expect(screen.getByTestId('tile-active')).toHaveTextContent('2');   // ACCEPTED + IN_PROGRESS
    expect(screen.getByTestId('tile-completed')).toHaveTextContent('1');
  });

  it('shows availability from the backend and toggles it', async () => {
    const user = userEvent.setup();
    renderOverview();
    await waitFor(() => expect(screen.getByTestId('availability-label')).toHaveTextContent('Available'));

    await user.click(screen.getByTestId('availability-toggle'));

    await waitFor(() => expect(screen.getByTestId('availability-label')).toHaveTextContent('Unavailable'));
    expect(mechanicApi.setAvailability).toHaveBeenCalledWith(false);
  });

  it('surfaces the newest pending request', async () => {
    renderOverview();
    await waitFor(() => expect(screen.getByTestId('overview-newest')).toBeInTheDocument());
    expect(screen.getByTestId('overview-newest')).toHaveTextContent('Flat or damaged tyre.');
  });

  it('prompts for a profile and disables the switch when none exists', async () => {
    vi.mocked(mechanicApi.getAvailability).mockRejectedValue(new ApiError(404, null, 'Not found'));
    renderOverview();
    await waitFor(() => expect(screen.getByTestId('profile-prompt')).toBeInTheDocument());
    expect(screen.getByTestId('availability-toggle')).toBeDisabled();
    expect(screen.queryByTestId('overview-error')).not.toBeInTheDocument();
  });

  it('surfaces a booking load failure', async () => {
    vi.mocked(bookingApi.listBookings).mockRejectedValue(new ApiError(0, null, 'Cannot reach the backend'));
    renderOverview();
    await waitFor(() => expect(screen.getByTestId('overview-error')).toHaveTextContent('Cannot reach'));
  });

  it('shows a loading state first', () => {
    renderOverview();
    expect(screen.getByTestId('overview-loading')).toBeInTheDocument();
  });
});

describe('MechanicBookings filtered views', () => {
  beforeEach(() => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue(ALL);
  });
  afterEach(() => vi.clearAllMocks());

  it('Requests shows only pending', async () => {
    render(<MechanicBookings view="requests" />);
    await waitFor(() => expect(screen.getByTestId('jobs-incoming')).toBeInTheDocument());
    expect(screen.queryByTestId('jobs-active')).not.toBeInTheDocument();
    expect(screen.queryByTestId('jobs-past')).not.toBeInTheDocument();
  });

  it('Active Services shows only accepted and in-progress', async () => {
    render(<MechanicBookings view="active" />);
    await waitFor(() => expect(screen.getByTestId('jobs-active')).toBeInTheDocument());
    expect(screen.queryByTestId('jobs-incoming')).not.toBeInTheDocument();
    expect(screen.queryByTestId('jobs-past')).not.toBeInTheDocument();
  });

  it('History shows only closed bookings', async () => {
    render(<MechanicBookings view="history" />);
    await waitFor(() => expect(screen.getByTestId('jobs-past')).toBeInTheDocument());
    expect(screen.queryByTestId('jobs-incoming')).not.toBeInTheDocument();
  });

  it('shows a view-specific empty state', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([booking({ status: 'PENDING' })]);
    render(<MechanicBookings view="active" />);
    await waitFor(() => expect(screen.getByTestId('jobs-empty')).toHaveTextContent('No active services'));
  });
});
