import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MechanicSchedule from './MechanicSchedule';
import MechanicEarnings from './MechanicEarnings';
import NotFoundPanel from './NotFoundPanel';
import * as mechanicApi from '../../lib/mechanic';
import * as bookingApi from '../../lib/booking';

vi.mock('../../lib/mechanic', async () => {
  const actual = await vi.importActual<typeof import('../../lib/mechanic')>('../../lib/mechanic');
  return { ...actual, getMechanicProfile: vi.fn() };
});
vi.mock('../../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../../lib/booking')>('../../lib/booking');
  return { ...actual, listBookings: vi.fn() };
});

const PROFILE = {
  id: 'p-1', user_id: 'u-1', garage_name: 'QA Rescue Garage', owner_name: 'QA Owner',
  experience_years: 6, specialization: 'General repair', supported_vehicle_types: ['BIKE', 'CAR'],
  address: 'Ring Road', city: 'Ahmedabad', state: 'GJ', country: 'India',
  latitude: 23.0725, longitude: 72.5714, service_radius_km: 30,
  working_start_time: '08:00', working_end_time: '20:00',
  is_available: true, is_verified: false, average_rating: 0, total_reviews: 0, completed_jobs: 0,
} as mechanicApi.MechanicProfile;

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('mechanic panels that used to render blank', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the real working window rather than an empty page', async () => {
    vi.mocked(mechanicApi.getMechanicProfile).mockResolvedValue(PROFILE);
    wrap(<MechanicSchedule />);
    expect(await screen.findByTestId('working-hours')).toHaveTextContent('08:00 – 20:00');
    expect(screen.getByText('30 km')).toBeInTheDocument();
  });

  it('explains itself when the mechanic has no profile yet', async () => {
    vi.mocked(mechanicApi.getMechanicProfile).mockRejectedValue(new Error('404'));
    wrap(<MechanicSchedule />);
    expect(await screen.findByTestId('schedule-empty')).toHaveTextContent('No schedule yet');
  });

  it('counts real completed bookings and invents no revenue', async () => {
    // `MechanicProfile.completed_jobs` exists but is never incremented by the
    // backend, so the figure has to come from the bookings themselves.
    vi.mocked(bookingApi.listBookings).mockResolvedValue([
      { id: 'b-1' } as bookingApi.Booking,
      { id: 'b-2' } as bookingApi.Booking,
    ]);
    wrap(<MechanicEarnings />);

    expect(await screen.findByTestId('completed-jobs')).toHaveTextContent('2');
    expect(bookingApi.listBookings).toHaveBeenCalledWith(['COMPLETED']);
    expect(screen.getByText(/Payment tracking isn't available yet/)).toBeInTheDocument();
    // Nothing that looks like money may appear while the backend tracks none.
    expect(document.body.textContent).not.toMatch(/[₹$]\s?\d/);
  });

  it('tells a customer nothing about the mechanic surface', () => {
    wrap(<NotFoundPanel />);
    expect(screen.getByTestId('dashboard-not-found')).toHaveTextContent('Page not found');
    expect(document.body.textContent).not.toMatch(/mechanic|request|dispatch/i);
  });
});
