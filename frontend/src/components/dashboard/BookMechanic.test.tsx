import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BookMechanic from './BookMechanic';
import { ApiError } from '../../lib/api';
import * as discovery from '../../lib/discovery';
import * as bookingApi from '../../lib/booking';
import { loadDraft } from '../../lib/bookingDraft';

vi.mock('../../lib/discovery', async () => {
  const actual = await vi.importActual<typeof import('../../lib/discovery')>('../../lib/discovery');
  return { ...actual, findNearbyMechanics: vi.fn(), getCurrentPosition: vi.fn() };
});
vi.mock('../../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../../lib/booking')>('../../lib/booking');
  return { ...actual, createBooking: vi.fn() };
});

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});
// Leaflet needs real layout/canvas; the map is covered by browser verification.
vi.mock('./MechanicMap', () => ({
  default: ({ mechanics, selectedId, onSelect }: any) => (
    <div data-testid="mechanic-map" data-selected={selectedId ?? ''}>
      {mechanics.map((m: any) => (
        <button key={m.id} data-testid={`marker-${m.id}`} onClick={() => onSelect(m.id)}>
          {m.garage_name}
        </button>
      ))}
    </div>
  ),
}));

const COORDS = { latitude: 23.0225, longitude: 72.5714 };

const mech = (over: Partial<discovery.NearbyMechanic> = {}): discovery.NearbyMechanic => ({
  id: 'm-1', garage_name: 'Speedy Auto', specialization: 'Engine', city: 'Ahmedabad',
  latitude: 23.07, longitude: 72.57, distance_km: 5.56, supported_vehicle_types: ['BIKE'],
  is_available: true, service_radius_km: 25, experience_years: 10,
  average_rating: 0, total_reviews: 0, ...over,
});

const booking = (over = {}): bookingApi.Booking => ({
  id: 'b-1', status: 'PENDING', vehicle_type: 'BIKE',
  problem_description: 'Flat or damaged tyre.',
  service_latitude: 23.0225, service_longitude: 72.5714, service_address: null,
  created_at: '2026-08-21T10:00:00Z', updated_at: null, vehicle: null,
  customer: { name: 'c@example.com', phone_number: null },
  mechanic: { name: 'Speedy Auto', phone_number: null }, ...over,
});

/** Walk the progressive flow up to (but not including) Find Mechanics. */
async function fillForm(user: ReturnType<typeof userEvent.setup>, type: 'BIKE' | 'CAR' = 'BIKE') {
  await user.click(screen.getByTestId('use-location'));
  await waitFor(() => expect(screen.getByTestId('step-vehicle')).toBeInTheDocument());
  await user.click(screen.getByTestId(`vehicle-${type}`));
  await waitFor(() => expect(screen.getByTestId('step-problem')).toBeInTheDocument());
  await user.click(screen.getByTestId('preset-Tyre'));
}

describe('BookMechanic', () => {
  beforeEach(() => {
    vi.mocked(discovery.getCurrentPosition).mockResolvedValue(COORDS);
    vi.mocked(discovery.findNearbyMechanics).mockResolvedValue([mech()]);
    vi.mocked(bookingApi.createBooking).mockResolvedValue(booking());
    navigate.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => vi.clearAllMocks());

  it('discloses steps progressively rather than showing one big form', () => {
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    expect(screen.getByTestId('use-location')).toBeInTheDocument();
    expect(screen.queryByTestId('step-vehicle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('step-problem')).not.toBeInTheDocument();
    expect(screen.queryByTestId('find-mechanics')).not.toBeInTheDocument();
  });

  it('shows the map from the start', () => {
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    expect(screen.getByTestId('mechanic-map')).toBeInTheDocument();
  });

  it('uses real browser geolocation and reveals the next step', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await user.click(screen.getByTestId('use-location'));
    await waitFor(() => expect(screen.getByTestId('coords')).toHaveTextContent('23.0225'));
    expect(discovery.getCurrentPosition).toHaveBeenCalled();
    expect(screen.getByTestId('step-vehicle')).toBeInTheDocument();
  });

  it('explains a denied location permission and does not advance', async () => {
    const user = userEvent.setup();
    vi.mocked(discovery.getCurrentPosition).mockRejectedValue(
      new Error('Location permission denied. Allow location access to find mechanics near you.'),
    );
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await user.click(screen.getByTestId('use-location'));
    await waitFor(() =>
      expect(screen.getByTestId('booking-error')).toHaveTextContent('permission denied'));
    expect(screen.queryByTestId('step-vehicle')).not.toBeInTheDocument();
  });

  it('never asks for a saved vehicle', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    expect(screen.getByTestId('vehicle-BIKE')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-CAR')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(/None of your vehicles/i)).not.toBeInTheDocument();
  });

  it('requires a described problem before searching', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await user.click(screen.getByTestId('use-location'));
    await waitFor(() => expect(screen.getByTestId('step-vehicle')).toBeInTheDocument());
    await user.click(screen.getByTestId('vehicle-CAR'));
    expect(screen.getByTestId('find-mechanics')).toBeDisabled();

    await user.click(screen.getByTestId('preset-Battery'));
    await waitFor(() => expect(screen.getByTestId('find-mechanics')).toBeEnabled());
  });

  it('sends location and vehicle type to discovery', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user, 'CAR');
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() =>
      expect(discovery.findNearbyMechanics).toHaveBeenCalledWith(COORDS, 'CAR'));
  });

  it('lists results with distance and puts them on the map', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('results-list')).toBeInTheDocument());
    expect(screen.getByTestId('distance-m-1')).toHaveTextContent('5.56 km');
    expect(screen.getByTestId('marker-m-1')).toBeInTheDocument();
  });

  it('shows an empty state when nothing covers the location', async () => {
    const user = userEvent.setup();
    vi.mocked(discovery.findNearbyMechanics).mockResolvedValue([]);
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('results-empty')).toBeInTheDocument());
  });

  it('surfaces a discovery failure', async () => {
    const user = userEvent.setup();
    vi.mocked(discovery.findNearbyMechanics).mockRejectedValue(
      new ApiError(500, null, 'Server exploded'));
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() =>
      expect(screen.getByTestId('booking-error')).toHaveTextContent('Server exploded'));
  });

  it('syncs selection from a map marker to the result card', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('marker-m-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('marker-m-1'));

    expect(screen.getByTestId('mechanic-m-1')).toHaveAttribute('aria-pressed', 'true');
  });

  it('syncs selection from a result card to the map', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('mechanic-m-1')).toBeInTheDocument());

    await user.click(screen.getByTestId('mechanic-m-1'));

    expect(screen.getByTestId('mechanic-map')).toHaveAttribute('data-selected', 'm-1');
  });

  it('navigates to the dedicated booking page instead of booking inline', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('mechanic-m-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('mechanic-m-1'));

    await user.click(screen.getByTestId('book-m-1'));

    expect(navigate).toHaveBeenCalledWith('/booking/m-1', expect.anything());
    // Discovery must never create the booking itself.
    expect(bookingApi.createBooking).not.toHaveBeenCalled();
  });

  it('carries the draft through router state and sessionStorage', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('mechanic-m-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('mechanic-m-1'));
    await user.click(screen.getByTestId('book-m-1'));

    const state = navigate.mock.calls[0][1] as { state: { draft: any } };
    expect(state.state.draft).toMatchObject({
      mechanicId: 'm-1', vehicleType: 'BIKE',
      problem: 'Flat or damaged tyre.',
      latitude: COORDS.latitude, longitude: COORDS.longitude, distanceKm: 5.56,
    });
    // The mirror lets a refresh on the booking page recover the same draft.
    expect(loadDraft('m-1')).toMatchObject({ mechanicId: 'm-1', vehicleType: 'BIKE' });
  });

  it('shows no confirmation panel on the discovery page', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><BookMechanic /></MemoryRouter>);
    await fillForm(user);
    await user.click(screen.getByTestId('find-mechanics'));
    await waitFor(() => expect(screen.getByTestId('mechanic-m-1')).toBeInTheDocument());
    await user.click(screen.getByTestId('mechanic-m-1'));

    expect(screen.queryByTestId('confirm-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('booking-confirmation')).not.toBeInTheDocument();
  });
});
