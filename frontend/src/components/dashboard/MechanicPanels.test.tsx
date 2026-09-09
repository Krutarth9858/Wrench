import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MechanicSchedule from './MechanicSchedule';
import MechanicEarnings from './MechanicEarnings';
import NotFoundPanel from './NotFoundPanel';
import { ApiError } from '../../lib/api';
import { useAvailability } from '../../lib/availability';
import * as mechanicApi from '../../lib/mechanic';
import * as bookingApi from '../../lib/booking';

vi.mock('../../lib/mechanic', async () => {
  const actual = await vi.importActual<typeof import('../../lib/mechanic')>('../../lib/mechanic');
  return { ...actual, getMechanicProfile: vi.fn(), setAvailability: vi.fn() };
});
vi.mock('../../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../../lib/booking')>('../../lib/booking');
  return { ...actual, listBookings: vi.fn() };
});
// The realtime channel is exercised by its own tests; these panels only need to
// mount without opening a socket. The refresh callback is captured so a test can
// fire it the way a socket event would.
const realtime = vi.hoisted(() => ({ refresh: null as null | (() => void | Promise<void>) }));
vi.mock('../../hooks/useBookingRealtime', () => ({
  useBookingRealtime: (_audience: string, refresh: () => void | Promise<void>) => {
    realtime.refresh = refresh;
  },
}));

const PROFILE = {
  id: 'p-1', user_id: 'u-1', garage_name: 'QA Rescue Garage', owner_name: 'QA Owner',
  experience_years: 6, specialization: 'General repair', supported_vehicle_types: ['BIKE', 'CAR'],
  address: 'Ring Road', city: 'Ahmedabad', state: 'GJ', country: 'India',
  latitude: 23.0725, longitude: 72.5714, service_radius_km: 30,
  working_start_time: '08:00', working_end_time: '20:00',
  is_available: true, is_verified: false, average_rating: 0, total_reviews: 0, completed_jobs: 0,
} as mechanicApi.MechanicProfile;

const job = (over: Partial<bookingApi.Booking> = {}): bookingApi.Booking => ({
  id: 'b-1', status: 'COMPLETED', vehicle_type: 'BIKE',
  problem_description: 'Flat or damaged tyre.',
  service_latitude: 23.02, service_longitude: 72.57, service_address: 'NH-48',
  created_at: '2026-08-01T09:00:00Z', updated_at: '2026-08-01T11:00:00Z', vehicle: null,
  customer: { name: 'c@example.com', phone_number: null },
  mechanic: { name: 'QA Rescue Garage', phone_number: null }, ...over,
});

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('mechanic panels that used to render blank', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(bookingApi.listBookings).mockResolvedValue([]);
    vi.mocked(mechanicApi.getMechanicProfile).mockResolvedValue(PROFILE);
    useAvailability.setState({ isAvailable: true });
  });

  // ── Schedule ─────────────────────────────────────────────────────────────

  it('shows the real working window rather than an empty page', async () => {
    wrap(<MechanicSchedule />);
    expect(await screen.findByTestId('working-hours')).toHaveTextContent('08:00 – 20:00');
    expect(screen.getByText('30 km')).toBeInTheDocument();
    expect(screen.getByText('Two-wheeler, Four-wheeler')).toBeInTheDocument();
  });

  it('explains itself when the mechanic has no profile yet', async () => {
    vi.mocked(mechanicApi.getMechanicProfile).mockRejectedValue(
      new ApiError(404, null, 'Mechanic profile not found'));
    wrap(<MechanicSchedule />);
    expect(await screen.findByTestId('schedule-empty')).toHaveTextContent('No schedule yet');
    // A missing profile is not a failure, so no error banner.
    expect(screen.queryByTestId('schedule-error')).not.toBeInTheDocument();
  });

  it('reports a real load failure instead of telling the mechanic to set up a profile', async () => {
    vi.mocked(mechanicApi.getMechanicProfile).mockRejectedValue(
      new ApiError(500, null, 'Server unavailable'));
    wrap(<MechanicSchedule />);
    expect(await screen.findByTestId('schedule-error')).toHaveTextContent('Server unavailable');
    expect(screen.queryByTestId('schedule-empty')).not.toBeInTheDocument();
  });

  it('lets the mechanic change availability and reflects the server answer', async () => {
    vi.mocked(mechanicApi.setAvailability).mockResolvedValue({ is_available: false });
    wrap(<MechanicSchedule />);
    await screen.findByTestId('schedule-content');
    expect(screen.getByTestId('availability-label')).toHaveTextContent('Available');

    await userEvent.click(screen.getByTestId('availability-toggle'));

    await waitFor(() => expect(mechanicApi.setAvailability).toHaveBeenCalledWith(false));
    // Updated from the response, with no refetch and no reload.
    expect(screen.getByTestId('availability-label')).toHaveTextContent('Unavailable');
  });

  // The navbar mounts once outside the dashboard's <Routes>, so it cannot refetch
  // on navigation; it reads this shared value instead. Regression: a toggle used
  // to update only the page's own state, leaving the navbar pill stale until reload.
  it('publishes a successful toggle so the navbar pill updates without a reload', async () => {
    vi.mocked(mechanicApi.setAvailability).mockResolvedValue({ is_available: false });
    wrap(<MechanicSchedule />);
    await screen.findByTestId('schedule-content');

    await userEvent.click(screen.getByTestId('availability-toggle'));

    await waitFor(() => expect(useAvailability.getState().isAvailable).toBe(false));
  });

  it('leaves the navbar pill alone when the toggle fails', async () => {
    vi.mocked(mechanicApi.setAvailability).mockRejectedValue(
      new ApiError(500, null, 'Server unavailable'));
    wrap(<MechanicSchedule />);
    await screen.findByTestId('schedule-content');

    await userEvent.click(screen.getByTestId('availability-toggle'));

    // The failure is surfaced, and no view may claim the change succeeded.
    expect(await screen.findByTestId('schedule-error')).toHaveTextContent('Server unavailable');
    expect(useAvailability.getState().isAvailable).toBe(true);
    expect(screen.getByTestId('availability-label')).toHaveTextContent('Available');
  });

  it('lists committed work and pending requests as scheduled work', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([
      job({ id: 'b-active', status: 'IN_PROGRESS', problem_description: 'Engine overheating' }),
      job({ id: 'b-new', status: 'PENDING', problem_description: 'Battery dead' }),
      job({ id: 'b-old', status: 'COMPLETED' }),
      job({ id: 'b-gone', status: 'REJECTED' }),
    ]);
    wrap(<MechanicSchedule />);

    expect(await screen.findByTestId('scheduled-b-active')).toHaveTextContent('Engine overheating');
    expect(screen.getByTestId('scheduled-b-new')).toHaveTextContent('Battery dead');
    // Finished and declined jobs are not upcoming work.
    expect(screen.queryByTestId('scheduled-b-old')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scheduled-b-gone')).not.toBeInTheDocument();
  });

  // Regression: the realtime refresh re-ran the whole loader, refetching the
  // mechanic profile on the socket's first resync and again on every booking
  // event — a request for data no booking event can change.
  it('refreshes only bookings when a realtime event arrives', async () => {
    wrap(<MechanicSchedule />);
    await screen.findByTestId('schedule-content');
    expect(mechanicApi.getMechanicProfile).toHaveBeenCalledTimes(1);

    vi.mocked(bookingApi.listBookings).mockResolvedValue([
      job({ id: 'b-live', status: 'ACCEPTED', problem_description: 'Towing needed' }),
    ]);
    await realtime.refresh!();

    // The new booking arrived without a second profile request.
    expect(await screen.findByTestId('scheduled-b-live')).toHaveTextContent('Towing needed');
    expect(mechanicApi.getMechanicProfile).toHaveBeenCalledTimes(1);
    expect(bookingApi.listBookings).toHaveBeenCalledTimes(2);
  });

  it('keeps a profile failure on screen when a later booking refresh succeeds', async () => {
    vi.mocked(mechanicApi.getMechanicProfile).mockRejectedValue(
      new ApiError(500, null, 'Server unavailable'));
    wrap(<MechanicSchedule />);
    await screen.findByTestId('schedule-error');

    await realtime.refresh!();

    // Bookings loaded fine, but the profile is still broken and still says so.
    expect(screen.getByTestId('schedule-error')).toHaveTextContent('Server unavailable');
  });

  it('says nothing is scheduled rather than rendering an empty list', async () => {
    wrap(<MechanicSchedule />);
    expect(await screen.findByTestId('scheduled-empty')).toHaveTextContent('Nothing scheduled');
  });

  // ── Earnings ─────────────────────────────────────────────────────────────

  it('counts real completed bookings and invents no revenue', async () => {
    // `MechanicProfile.completed_jobs` exists but is never incremented by the
    // backend, so the figure has to come from the bookings themselves.
    vi.mocked(bookingApi.listBookings).mockResolvedValue([job({ id: 'b-1' }), job({ id: 'b-2' })]);
    wrap(<MechanicEarnings />);

    expect(await screen.findByTestId('completed-jobs')).toHaveTextContent('2');
    expect(bookingApi.listBookings).toHaveBeenCalledWith(['COMPLETED']);
    expect(screen.getByText(/Payment tracking isn't available yet/)).toBeInTheDocument();
    // Nothing that looks like money may appear while the backend tracks none.
    expect(document.body.textContent).not.toMatch(/[₹$]\s?\d/);
  });

  it('lists the completed jobs it counted, grouped by completion month', async () => {
    vi.mocked(bookingApi.listBookings).mockResolvedValue([
      job({ id: 'b-jul', updated_at: '2026-07-04T10:00:00Z', problem_description: 'Clutch cable' }),
      job({ id: 'b-aug', updated_at: '2026-08-09T10:00:00Z', problem_description: 'Punctured tyre' }),
    ]);
    wrap(<MechanicEarnings />);

    expect(await screen.findByTestId('completed-b-aug')).toHaveTextContent('Punctured tyre');
    expect(screen.getByTestId('completed-b-jul')).toHaveTextContent('Clutch cable');
    expect(screen.getByText('August 2026')).toBeInTheDocument();
    expect(screen.getByText('July 2026')).toBeInTheDocument();
  });

  it('shows an empty state when no job has been completed', async () => {
    wrap(<MechanicEarnings />);
    expect(await screen.findByTestId('earnings-empty')).toHaveTextContent('No completed jobs yet');
    expect(screen.getByTestId('completed-jobs')).toHaveTextContent('0');
  });

  it('surfaces a failed load instead of reporting zero completed jobs', async () => {
    vi.mocked(bookingApi.listBookings).mockRejectedValue(new ApiError(500, null, 'Server unavailable'));
    wrap(<MechanicEarnings />);
    expect(await screen.findByTestId('earnings-error')).toHaveTextContent('Server unavailable');
  });

  it('tells a customer nothing about the mechanic surface', () => {
    wrap(<NotFoundPanel />);
    expect(screen.getByTestId('dashboard-not-found')).toHaveTextContent('Page not found');
    expect(document.body.textContent).not.toMatch(/mechanic|request|dispatch/i);
  });
});
