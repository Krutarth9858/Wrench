import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MechanicProfilePanel from './MechanicProfilePanel';
import { ApiError } from '../../lib/api';
import * as mechanic from '../../lib/mechanic';
import * as discovery from '../../lib/discovery';

vi.mock('../../lib/discovery', async () => {
  const actual = await vi.importActual<typeof import('../../lib/discovery')>('../../lib/discovery');
  return { ...actual, getCurrentPosition: vi.fn() };
});

vi.mock('../../lib/mechanic', async () => {
  const actual = await vi.importActual<typeof import('../../lib/mechanic')>('../../lib/mechanic');
  return {
    ...actual,
    getMechanicProfile: vi.fn(),
    getAvailability: vi.fn(),
    saveMechanicProfile: vi.fn(),
    setAvailability: vi.fn(),
  };
});

const PROFILE: mechanic.MechanicProfile = {
  id: 'p-1', user_id: 'u-1',
  garage_name: 'Speedy Auto', owner_name: 'Mike', experience_years: 10, bio: '',
  specialization: 'Engine', supported_vehicle_types: ['CAR'],
  address: '1 St', city: 'Springfield', state: 'IL', country: 'USA',
  latitude: 39.79, longitude: -89.64, service_radius_km: 25.5,
  working_start_time: '08:00', working_end_time: '18:00',
  is_available: true, is_verified: false,
  average_rating: 0, total_reviews: 0, completed_jobs: 0,
};

describe('MechanicProfilePanel', () => {
  beforeEach(() => {
    vi.mocked(mechanic.getMechanicProfile).mockResolvedValue(PROFILE);
    vi.mocked(mechanic.getAvailability).mockResolvedValue({ is_available: true });
    vi.mocked(mechanic.saveMechanicProfile).mockResolvedValue(PROFILE);
    vi.mocked(mechanic.setAvailability).mockImplementation(async (v) => ({ is_available: v }));
  });
  afterEach(() => vi.clearAllMocks());

  it('starts a new profile with no location rather than 0,0', async () => {
    // Regression: 0,0 defaults silently produced mechanics invisible to discovery.
    vi.mocked(mechanic.getMechanicProfile).mockRejectedValue(new ApiError(404, null, 'Not found'));
    vi.mocked(mechanic.getAvailability).mockRejectedValue(new ApiError(404, null, 'Not found'));
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('use-my-location')).toBeInTheDocument());
    const lat = document.querySelector('input[name="latitude"]') as HTMLInputElement;
    const lon = document.querySelector('input[name="longitude"]') as HTMLInputElement;
    expect(lat.value).toBe('');
    expect(lon.value).toBe('');
  });

  it('fills the location from the browser', async () => {
    const user = userEvent.setup();
    vi.mocked(discovery.getCurrentPosition).mockResolvedValue({ latitude: 23.0225, longitude: 72.5714 });
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('use-my-location')).toBeInTheDocument());

    await user.click(screen.getByTestId('use-my-location'));

    await waitFor(() =>
      expect((document.querySelector('input[name="latitude"]') as HTMLInputElement).value).toBe('23.0225'));
    expect((document.querySelector('input[name="longitude"]') as HTMLInputElement).value).toBe('72.5714');
  });

  it('refuses to save a profile pinned at 0,0', async () => {
    const user = userEvent.setup();
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('save-profile')).toBeEnabled());
    const lat = document.querySelector('input[name="latitude"]') as HTMLInputElement;
    const lon = document.querySelector('input[name="longitude"]') as HTMLInputElement;
    await user.clear(lat); await user.type(lat, '0');
    await user.clear(lon); await user.type(lon, '0');

    await user.click(screen.getByTestId('save-profile'));

    await waitFor(() => expect(screen.getByTestId('mechanic-error')).toHaveTextContent('Atlantic'));
    expect(mechanic.saveMechanicProfile).not.toHaveBeenCalled();
  });

  it('shows a loading state before the profile arrives', () => {
    render(<MechanicProfilePanel />);
    expect(screen.getByTestId('mechanic-panel-loading')).toBeInTheDocument();
  });

  it('loads the profile from the backend into the form', async () => {
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByDisplayValue('Speedy Auto')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Mike')).toBeInTheDocument();
    expect(screen.getByDisplayValue('25.5')).toBeInTheDocument();
    expect(screen.getByTestId('vehicle-CAR')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('vehicle-BIKE')).toHaveAttribute('aria-pressed', 'false');
  });

  it('reflects the backend availability value', async () => {
    vi.mocked(mechanic.getAvailability).mockResolvedValue({ is_available: false });
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('availability-label')).toHaveTextContent('Unavailable'));
    expect(screen.getByTestId('availability-toggle')).toHaveAttribute('aria-checked', 'false');
  });

  it('toggles availability through the API and trusts the response', async () => {
    const user = userEvent.setup();
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('availability-label')).toHaveTextContent('Available'));

    await user.click(screen.getByTestId('availability-toggle'));

    await waitFor(() => expect(screen.getByTestId('availability-label')).toHaveTextContent('Unavailable'));
    expect(mechanic.setAvailability).toHaveBeenCalledWith(false);
  });

  it('surfaces an error when the availability update fails', async () => {
    const user = userEvent.setup();
    vi.mocked(mechanic.setAvailability).mockRejectedValue(new ApiError(500, null, 'Server exploded'));
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('availability-toggle')).toBeEnabled());

    await user.click(screen.getByTestId('availability-toggle'));

    await waitFor(() => expect(screen.getByTestId('mechanic-error')).toHaveTextContent('Server exploded'));
    // state must not have optimistically flipped
    expect(screen.getByTestId('availability-label')).toHaveTextContent('Available');
  });

  it('saves the profile and confirms', async () => {
    const user = userEvent.setup();
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByDisplayValue('Speedy Auto')).toBeInTheDocument());

    await user.click(screen.getByTestId('save-profile'));

    await waitFor(() => expect(mechanic.saveMechanicProfile).toHaveBeenCalled());
    const sent = vi.mocked(mechanic.saveMechanicProfile).mock.calls[0][0];
    expect(sent.garage_name).toBe('Speedy Auto');
    expect(sent.supported_vehicle_types).toEqual(['CAR']);
    expect(await screen.findByTestId('mechanic-notice')).toHaveTextContent('Profile saved.');
  });

  it('displays a backend validation error on save', async () => {
    const user = userEvent.setup();
    vi.mocked(mechanic.saveMechanicProfile).mockRejectedValue(
      new ApiError(422, null, 'service_radius_km must be greater than 0'),
    );
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('save-profile')).toBeEnabled());

    await user.click(screen.getByTestId('save-profile'));

    await waitFor(() =>
      expect(screen.getByTestId('mechanic-error')).toHaveTextContent('service_radius_km'),
    );
  });

  it('treats a 404 as "no profile yet" and disables the availability switch', async () => {
    vi.mocked(mechanic.getMechanicProfile).mockRejectedValue(new ApiError(404, null, 'Not found'));
    vi.mocked(mechanic.getAvailability).mockRejectedValue(new ApiError(404, null, 'Not found'));
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByText('Garage settings')).toBeInTheDocument());
    expect(screen.queryByTestId('mechanic-error')).not.toBeInTheDocument();
    expect(screen.getByTestId('availability-toggle')).toBeDisabled();
  });

  it('shows a network failure instead of failing silently', async () => {
    vi.mocked(mechanic.getMechanicProfile).mockRejectedValue(
      new ApiError(0, null, 'Cannot reach the backend'),
    );
    vi.mocked(mechanic.getAvailability).mockRejectedValue(
      new ApiError(0, null, 'Cannot reach the backend'),
    );
    render(<MechanicProfilePanel />);
    await waitFor(() =>
      expect(screen.getByTestId('mechanic-error')).toHaveTextContent('Cannot reach the backend'),
    );
  });

  it('never lets the mechanic clear every vehicle type', async () => {
    const user = userEvent.setup();
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('vehicle-CAR')).toHaveAttribute('aria-pressed', 'true'));

    await user.click(screen.getByTestId('vehicle-CAR')); // only selected type

    expect(screen.getByTestId('vehicle-CAR')).toHaveAttribute('aria-pressed', 'true');
  });

  it('adds a second vehicle type', async () => {
    const user = userEvent.setup();
    render(<MechanicProfilePanel />);
    await waitFor(() => expect(screen.getByTestId('vehicle-BIKE')).toBeInTheDocument());

    await user.click(screen.getByTestId('vehicle-BIKE'));

    expect(screen.getByTestId('vehicle-BIKE')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('vehicle-CAR')).toHaveAttribute('aria-pressed', 'true');
  });
});
