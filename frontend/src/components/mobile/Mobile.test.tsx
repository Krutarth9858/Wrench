import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomSheet from './MobileBottomSheet';
import MobileMechanicCard from './MobileMechanicCard';
import MobileBottomNav from './MobileBottomNav';
import { estimateMinutes } from '../../lib/eta';
import type { NearbyMechanic } from '../../lib/discovery';

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

const mechanic = (over: Partial<NearbyMechanic> = {}): NearbyMechanic => ({
  id: 'm-1', garage_name: 'MV Motors', specialization: 'Engine', city: 'Ahmedabad',
  latitude: 23.07, longitude: 72.57, supported_vehicle_types: ['BIKE', 'CAR'],
  is_available: true, service_radius_km: 25, experience_years: 10,
  average_rating: 4.9, total_reviews: 120, distance_km: 2.4, ...over,
});

describe('arrival estimate', () => {
  it('grows with distance and never promises the impossible', () => {
    expect(estimateMinutes(2.4)).toBeGreaterThan(estimateMinutes(0.5));
    // A garage next door still takes a few minutes to set off.
    expect(estimateMinutes(0)).toBeGreaterThanOrEqual(3);
  });
});

describe('mobile mechanic card', () => {
  it('shows everything needed to choose, at a glance', () => {
    wrap(<MobileMechanicCard mechanic={mechanic()} onSelect={() => {}} onRequest={() => {}} />);
    expect(screen.getByText('MV Motors')).toBeInTheDocument();
    expect(screen.getByText('4.9')).toBeInTheDocument();
    expect(screen.getByText('2.4 km')).toBeInTheDocument();
    expect(screen.getByText(/~\d+ min/)).toBeInTheDocument();
    expect(screen.getByText('2W + 4W')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('separates choosing a mechanic from requesting one', async () => {
    const onSelect = vi.fn();
    const onRequest = vi.fn();
    wrap(<MobileMechanicCard mechanic={mechanic()} onSelect={onSelect} onRequest={onRequest} />);

    // Tapping the body focuses it on the map; only the CTA books.
    await userEvent.click(screen.getByText('MV Motors'));
    expect(onSelect).toHaveBeenCalled();
    expect(onRequest).not.toHaveBeenCalled();

    await userEvent.click(screen.getByTestId('m-request-m-1'));
    expect(onRequest).toHaveBeenCalled();
  });

  it('cannot request an unavailable mechanic', () => {
    wrap(<MobileMechanicCard mechanic={mechanic({ is_available: false })}
      onSelect={() => {}} onRequest={() => {}} />);
    expect(screen.getByTestId('m-request-m-1')).toBeDisabled();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('hides a rating nobody has given yet', () => {
    wrap(<MobileMechanicCard mechanic={mechanic({ total_reviews: 0, average_rating: 0 })}
      onSelect={() => {}} onRequest={() => {}} />);
    expect(screen.queryByText('0.0')).not.toBeInTheDocument();
  });
});

describe('bottom sheet', () => {
  it('reports its state and toggles on tap', async () => {
    const onStateChange = vi.fn();
    wrap(
      <MobileBottomSheet state="collapsed" onStateChange={onStateChange} peek={<p>3 nearby</p>}>
        <p>list</p>
      </MobileBottomSheet>,
    );
    const sheet = screen.getByTestId('mobile-sheet');
    expect(sheet).toHaveAttribute('data-state', 'collapsed');

    await userEvent.click(screen.getByTestId('mobile-sheet-handle'));
    expect(onStateChange).toHaveBeenCalledWith('expanded');
  });

  it('keeps the peek visible in both states', () => {
    const { rerender } = wrap(
      <MobileBottomSheet state="collapsed" onStateChange={() => {}} peek={<p>3 nearby</p>}>
        <p>list</p>
      </MobileBottomSheet>,
    );
    expect(screen.getByText('3 nearby')).toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <MobileBottomSheet state="expanded" onStateChange={() => {}} peek={<p>3 nearby</p>}>
          <p>list</p>
        </MobileBottomSheet>
      </MemoryRouter>,
    );
    expect(screen.getByText('3 nearby')).toBeInTheDocument();
  });

  it('exposes its state to assistive technology', () => {
    wrap(
      <MobileBottomSheet state="expanded" onStateChange={() => {}} peek={<p>peek</p>}>
        <p>list</p>
      </MobileBottomSheet>,
    );
    expect(screen.getByTestId('mobile-sheet-handle')).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('bottom navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('gives customers their five destinations', () => {
    wrap(<MobileBottomNav isMechanic={false} />);
    ['home', 'find', 'bookings', 'service', 'profile'].forEach((tab) =>
      expect(screen.getByTestId(`mobile-nav-${tab}`)).toBeInTheDocument());
  });

  it('gives mechanics a different set — never the customer one', () => {
    wrap(<MobileBottomNav isMechanic />);
    expect(screen.getByTestId('mobile-nav-requests')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav-status')).toBeInTheDocument();
    // "Find a mechanic" makes no sense for a mechanic.
    expect(screen.queryByTestId('mobile-nav-find')).not.toBeInTheDocument();
  });
});
