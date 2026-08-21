import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FindMechanics from './FindMechanics';
import { ApiError } from '../../lib/api';
import * as discovery from '../../lib/discovery';
import * as vehicles from '../../lib/vehicles';
import * as booking from '../../lib/booking';

vi.mock('../../lib/discovery', async () => {
  const actual = await vi.importActual<typeof import('../../lib/discovery')>('../../lib/discovery');
  return { ...actual, findNearbyMechanics: vi.fn(), getCurrentPosition: vi.fn() };
});

vi.mock('../../lib/vehicles', () => ({ listVehicles: vi.fn() }));
vi.mock('../../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../../lib/booking')>('../../lib/booking');
  return { ...actual, createBooking: vi.fn() };
});

const COORDS = { latitude: 23.0225, longitude: 72.5714 };

const mechanic = (over: Partial<discovery.NearbyMechanic> = {}): discovery.NearbyMechanic => ({
  id: 'm-1', garage_name: 'Speedy Auto', specialization: 'Engine', city: 'Ahmedabad',
  latitude: 23.07, longitude: 72.57, distance_km: 5.56,
  supported_vehicle_types: ['CAR'], is_available: true, service_radius_km: 25,
  experience_years: 10, average_rating: 0, total_reviews: 0, ...over,
});

describe('FindMechanics', () => {
  beforeEach(() => {
    vi.mocked(discovery.getCurrentPosition).mockResolvedValue(COORDS);
    vi.mocked(discovery.findNearbyMechanics).mockResolvedValue([mechanic()]);
    vi.mocked(vehicles.listVehicles).mockResolvedValue([]);
  });
  afterEach(() => vi.clearAllMocks());

  it('uses the browser location and the chosen vehicle type', async () => {
    const user = userEvent.setup();
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-vehicle-BIKE'));
    await user.click(screen.getByTestId('find-mechanics'));

    await waitFor(() => expect(discovery.findNearbyMechanics).toHaveBeenCalledWith(COORDS, 'BIKE'));
  });

  it('shows a loading state while locating and searching', async () => {
    const user = userEvent.setup();
    let release: (v: discovery.Coordinates) => void = () => {};
    vi.mocked(discovery.getCurrentPosition).mockReturnValue(
      new Promise((resolve) => { release = resolve; }),
    );
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-mechanics'));

    expect(screen.getByTestId('discovery-loading')).toBeInTheDocument();
    expect(screen.getByTestId('find-mechanics')).toBeDisabled();

    release(COORDS);
    await waitFor(() => expect(screen.queryByTestId('discovery-loading')).not.toBeInTheDocument());
  });

  it('renders results with their distance', async () => {
    const user = userEvent.setup();
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-mechanics'));

    await waitFor(() => expect(screen.getByTestId('discovery-results')).toBeInTheDocument());
    expect(screen.getByText('Speedy Auto')).toBeInTheDocument();
    expect(screen.getByTestId('distance-m-1')).toHaveTextContent('5.56 km');
  });

  it('shows a no-results state instead of an empty screen', async () => {
    const user = userEvent.setup();
    vi.mocked(discovery.findNearbyMechanics).mockResolvedValue([]);
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-mechanics'));

    await waitFor(() => expect(screen.getByTestId('discovery-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('discovery-results')).not.toBeInTheDocument();
  });

  it('explains a denied location permission', async () => {
    const user = userEvent.setup();
    vi.mocked(discovery.getCurrentPosition).mockRejectedValue(
      new Error('Location permission denied. Allow location access to find mechanics near you.'),
    );
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-mechanics'));

    await waitFor(() =>
      expect(screen.getByTestId('discovery-error')).toHaveTextContent('permission denied'),
    );
    expect(discovery.findNearbyMechanics).not.toHaveBeenCalled();
  });

  it('surfaces an API failure', async () => {
    const user = userEvent.setup();
    vi.mocked(discovery.findNearbyMechanics).mockRejectedValue(
      new ApiError(500, null, 'Server exploded'),
    );
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-mechanics'));

    await waitFor(() =>
      expect(screen.getByTestId('discovery-error')).toHaveTextContent('Server exploded'),
    );
  });

  it('opens the booking form on selection without creating a booking', async () => {
    const user = userEvent.setup();
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('mechanic-m-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('mechanic-m-1'));

    // Selection reveals the request form; it must not itself create a booking.
    await waitFor(() => expect(screen.getByTestId('book-service')).toBeInTheDocument());
    expect(booking.createBooking).not.toHaveBeenCalled();
    expect(discovery.findNearbyMechanics).toHaveBeenCalledTimes(1);
  });

  it('clears previous results when a new search starts', async () => {
    const user = userEvent.setup();
    render(<FindMechanics />);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('mechanic-m-1')).toBeInTheDocument());

    vi.mocked(discovery.findNearbyMechanics).mockResolvedValue([]);
    await user.click(screen.getByTestId('find-mechanics'));

    await waitFor(() => expect(screen.getByTestId('discovery-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('book-service')).not.toBeInTheDocument();
  });
});
