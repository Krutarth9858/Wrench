import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BookingPage from './BookingPage';
import { ApiError } from '../../lib/api';
import * as discovery from '../../lib/discovery';
import * as bookingApi from '../../lib/booking';
import { saveDraft, type BookingDraft } from '../../lib/bookingDraft';

vi.mock('../../lib/discovery', async () => {
  const actual = await vi.importActual<typeof import('../../lib/discovery')>('../../lib/discovery');
  return { ...actual, getMechanic: vi.fn() };
});
vi.mock('../../lib/booking', async () => {
  const actual = await vi.importActual<typeof import('../../lib/booking')>('../../lib/booking');
  return { ...actual, createBooking: vi.fn(), actOnBooking: vi.fn() };
});

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

// Mock ResizeObserver for JSDOM
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as any;

const MECHANIC: discovery.MechanicSummary = {
  id: 'm-1', garage_name: 'Speedy Auto', specialization: 'Engine', city: 'Ahmedabad',
  latitude: 23.07, longitude: 72.57, supported_vehicle_types: ['BIKE', 'CAR'],
  is_available: true, service_radius_km: 25, experience_years: 10,
  average_rating: 0, total_reviews: 0,
};

const DRAFT: BookingDraft = {
  mechanicId: 'm-1', vehicleType: 'BIKE', problem: 'Flat or damaged tyre.',
  latitude: 23.0225, longitude: 72.5714, address: '', distanceKm: 5.56,
};

const booking = (over = {}): bookingApi.Booking => ({
  id: 'b-1', status: 'PENDING', vehicle_type: 'BIKE',
  problem_description: 'Flat or damaged tyre.',
  service_latitude: 23.0225, service_longitude: 72.5714, service_address: null,
  created_at: null, updated_at: null, vehicle: null,
  customer: { name: 'c@example.com', phone_number: null },
  mechanic: { name: 'Speedy Auto', phone_number: null }, ...over,
});

/** Render at the real route. `withState: false` simulates a hard refresh. */
function renderPage(withState = true) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/booking/m-1', state: withState ? { draft: DRAFT } : null }]}
    >
      <Routes>
        <Route path="/booking/:mechanicId" element={<BookingPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('BookingPage', () => {
  beforeEach(() => {
    vi.mocked(discovery.getMechanic).mockResolvedValue(MECHANIC);
    vi.mocked(bookingApi.createBooking).mockResolvedValue(booking());
    navigate.mockClear();
    sessionStorage.clear();
  });
  afterEach(() => vi.clearAllMocks());

  it('renders only the booking experience — no discovery sidebar or map', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('booking-page')).toBeInTheDocument());
  });

  it('fetches the selected mechanic from the API by id', async () => {
    renderPage();
    await waitFor(() => expect(discovery.getMechanic).toHaveBeenCalledWith('m-1'));
    expect(await screen.findByText('Speedy Auto')).toBeInTheDocument();
  });

  it('shows the mechanic details it actually has', async () => {
    renderPage();
    const card = await screen.findByTestId('selected-mechanic');
    expect(card).toHaveTextContent('Speedy Auto');
    expect(card).toHaveTextContent('5.56 km away');
    expect(card).toHaveTextContent('Available');
    expect(card).toHaveTextContent('Two-wheeler');
    // Rating is hidden while there are no reviews rather than shown as 0.
    expect(card).not.toHaveTextContent('★');
  });

  it('prefills vehicle type, problem and location from the draft', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('vehicle-BIKE')).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByTestId('problem-input')).toHaveValue('Flat or damaged tyre.');
    expect(screen.getByTestId('service-location')).toHaveTextContent('23.0225');
  });

  it('recovers the draft from sessionStorage after a refresh', async () => {
    saveDraft(DRAFT);
    renderPage(false); // no router state, as after a hard reload

    await waitFor(() => expect(screen.getByTestId('selected-mechanic')).toBeInTheDocument());
    expect(screen.getByTestId('vehicle-BIKE')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('problem-input')).toHaveValue('Flat or damaged tyre.');
    expect(screen.getByTestId('confirm-service')).toBeEnabled();
  });

  it('degrades safely when a refresh leaves no draft at all', async () => {
    renderPage(false);
    await waitFor(() => expect(screen.getByTestId('selected-mechanic')).toBeInTheDocument());
    // Mechanic still resolves from the URL; only the location is missing.
    expect(screen.getByTestId('location-missing')).toBeInTheDocument();
    expect(screen.getByTestId('confirm-service')).toBeDisabled();
  });

  it('shows a clear state when the mechanic cannot be loaded', async () => {
    vi.mocked(discovery.getMechanic).mockRejectedValue(new ApiError(404, null, 'Mechanic not found'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('mechanic-missing')).toBeInTheDocument());
    expect(screen.queryByTestId('confirm-service')).not.toBeInTheDocument();
  });

  it('never asks for a saved vehicle', async () => {
    renderPage();
    await waitFor(() => expect(screen.getByTestId('vehicle-BIKE')).toBeInTheDocument());
    expect(screen.getByTestId('vehicle-CAR')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText(/None of your vehicles/i)).not.toBeInTheDocument();
  });

  it('disables a vehicle type the mechanic does not service', async () => {
    vi.mocked(discovery.getMechanic).mockResolvedValue({
      ...MECHANIC, supported_vehicle_types: ['CAR'],
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId('vehicle-BIKE')).toBeDisabled());
    expect(screen.getByTestId('vehicle-CAR')).toBeEnabled();
  });

  it('creates the booking on confirm', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('confirm-service')).toBeEnabled());

    await user.click(screen.getByTestId('confirm-service'));

    await waitFor(() => expect(bookingApi.createBooking).toHaveBeenCalled());
    expect(vi.mocked(bookingApi.createBooking).mock.calls[0][0]).toMatchObject({
      mechanic_profile_id: 'm-1', vehicle_type: 'BIKE',
      problem_description: 'Flat or damaged tyre.',
      service_latitude: 23.0225, service_longitude: 72.5714,
    });
    expect(await screen.findByText('Request sent')).toBeInTheDocument();
  });

  it('lets the customer switch vehicle type before confirming', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('vehicle-CAR')).toBeEnabled());

    await user.click(screen.getByTestId('vehicle-CAR'));
    await user.click(screen.getByTestId('confirm-service'));

    await waitFor(() =>
      expect(vi.mocked(bookingApi.createBooking).mock.calls[0][0].vehicle_type).toBe('CAR'));
  });

  it('requires a described problem', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('problem-input')).toBeInTheDocument());

    await user.clear(screen.getByTestId('problem-input'));

    expect(screen.getByTestId('confirm-service')).toBeDisabled();
  });

  it('surfaces a rejected booking', async () => {
    const user = userEvent.setup();
    vi.mocked(bookingApi.createBooking).mockRejectedValue(
      new ApiError(409, null, 'This mechanic is not accepting requests right now.'));
    renderPage();
    await waitFor(() => expect(screen.getByTestId('confirm-service')).toBeEnabled());

    await user.click(screen.getByTestId('confirm-service'));

    await waitFor(() =>
      expect(screen.getByTestId('booking-error')).toHaveTextContent('not accepting requests'));
  });

  it('goes back to discovery', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByTestId('back-to-discovery')).toBeInTheDocument());

    await user.click(screen.getByTestId('back-to-discovery'));

    expect(navigate).toHaveBeenCalledWith('/dashboard/find');
  });

  // ── Terminal states ──────────────────────────────────────────────────────
  //
  // Regression: the tracker derived its current step with
  // `['PENDING','ACCEPTED','IN_PROGRESS','COMPLETED'].indexOf(status)`, which is
  // -1 for REJECTED and CANCELLED. Every step then rendered as "not reached", so
  // a customer whose request had been declined saw a tracker that looked exactly
  // like one still waiting for a mechanic.

  const reachStatus = async (status: bookingApi.BookingStatus) => {
    vi.mocked(bookingApi.createBooking).mockResolvedValue(booking({ status }));
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId('booking-page');
    await user.click(screen.getByTestId('confirm-service'));
    await screen.findByTestId('booking-heading');
  };

  it('shows a declined booking as ended, not as still waiting', async () => {
    await reachStatus('REJECTED');

    expect(screen.getByTestId('booking-heading')).toHaveTextContent('Booking declined');
    expect(screen.getByTestId('booking-ended-step')).toHaveTextContent('Declined');
    // The steps that never happened must not be shown as pending progress.
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Completed')).not.toBeInTheDocument();
    expect(screen.queryByText('Waiting for mechanic to accept your request.')).not.toBeInTheDocument();
  });

  it('offers a way forward after a decline', async () => {
    await reachStatus('REJECTED');
    await userEvent.click(screen.getByTestId('ended-cta'));
    expect(navigate).toHaveBeenCalledWith('/dashboard/find');
  });

  it('shows a cancelled booking as ended', async () => {
    await reachStatus('CANCELLED');
    expect(screen.getByTestId('booking-heading')).toHaveTextContent('Booking cancelled');
    expect(screen.getByTestId('booking-ended-step')).toHaveTextContent('Cancelled');
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('still walks the happy path through its four steps', async () => {
    await reachStatus('ACCEPTED');
    expect(screen.getByTestId('booking-heading')).toHaveTextContent('Mechanic accepted');
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.queryByTestId('booking-ended-step')).not.toBeInTheDocument();
  });

  // ── Cancelling from the tracker ──────────────────────────────────────────

  it.each(['PENDING', 'ACCEPTED'] as bookingApi.BookingStatus[])(
    'offers cancellation while %s, matching the server transition table',
    async (status) => {
      await reachStatus(status);
      expect(screen.getByTestId('cancel-booking')).toBeInTheDocument();
    },
  );

  it.each(['IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'] as bookingApi.BookingStatus[])(
    'hides cancellation once %s — the server would refuse it',
    async (status) => {
      await reachStatus(status);
      expect(screen.queryByTestId('cancel-booking')).not.toBeInTheDocument();
    },
  );

  it('cancels through the existing intent endpoint', async () => {
    vi.mocked(bookingApi.actOnBooking).mockResolvedValue(booking({ status: 'CANCELLED' }));
    await reachStatus('PENDING');

    await userEvent.click(screen.getByTestId('cancel-booking'));

    await waitFor(() => expect(bookingApi.actOnBooking).toHaveBeenCalledWith('b-1', 'cancel'));
    expect(await screen.findByTestId('booking-ended-step')).toHaveTextContent('Cancelled');
  });

  it('surfaces a refused cancellation instead of failing silently', async () => {
    vi.mocked(bookingApi.actOnBooking).mockRejectedValue(
      new ApiError(409, null, 'Booking is already COMPLETED and cannot be changed.'),
    );
    await reachStatus('PENDING');

    await userEvent.click(screen.getByTestId('cancel-booking'));

    expect(await screen.findByTestId('tracker-error')).toHaveTextContent('already COMPLETED');
  });
});
