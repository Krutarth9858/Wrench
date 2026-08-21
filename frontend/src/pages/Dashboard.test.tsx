/**
 * Regression: dashboard controls became unclickable near the top of the window.
 *
 * The floating navbar is `fixed` and its right-hand cluster (email, logout,
 * Dashboard pill) legitimately owns the top-right pixels. The dashboard used to
 * scroll the whole window underneath it, so any control that scrolled into that
 * band was covered and swallowed the click — the AI chat "Send" button hit this.
 *
 * The fix is structural, not per-button z-index: the shell is a fixed-height
 * column and content scrolls inside its own region below the navbar. These tests
 * lock that shape, since jsdom has no layout engine to hit-test with.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Dashboard from './Dashboard';
import { useAuth } from '../lib/auth';

vi.mock('../components/dashboard/ProfileSettings', () => ({
  default: () => <div data-testid="panel">Profile</div>,
}));
vi.mock('../components/dashboard/Troubleshoot', () => ({ default: () => <div>Troubleshoot</div> }));
vi.mock('../components/dashboard/BookMechanic', () => ({ default: () => <div>Find</div> }));
vi.mock('../components/dashboard/MyBookings', () => ({ default: () => <div>Bookings</div> }));
vi.mock('../components/dashboard/MechanicProfilePanel', () => ({ default: () => <div>MProfile</div> }));
vi.mock('../components/dashboard/MechanicBookings', () => ({ default: () => <div>MBookings</div> }));
vi.mock('../components/dashboard/MechanicOverview', () => ({ default: () => <div>MOverview</div> }));

const renderDashboard = (route = '/dashboard') => {
  useAuth.setState({
    user: { id: 'u-1', email: 'cust@example.com', role: 'CUSTOMER', is_active: true },
  } as never);
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/dashboard/*" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>,
  );
};

const shell = (container: HTMLElement) => container.firstElementChild as HTMLElement;
const scrollRegion = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('.overflow-y-auto');

describe('dashboard shell', () => {
  beforeEach(() => useAuth.setState({ user: null } as never));

  it('scrolls content inside its own region instead of under the fixed navbar', () => {
    const { container } = renderDashboard();

    // The window must not scroll the page body past the navbar...
    expect(shell(container).className).toContain('overflow-hidden');
    expect(shell(container).className).toContain('h-screen');

    // The navbar clearance sits on the clipping parent, not inside the scroller:
    // padding *within* a scroll box scrolls away and stops clearing anything.
    expect(shell(container).className).toMatch(/pt-\d+/);

    const region = scrollRegion(container);
    expect(region).not.toBeNull();
    expect(region!.className).not.toMatch(/pt-\d+/);
    expect(region!.contains(screen.getByTestId('panel'))).toBe(true);
  });

  it('keeps the same shell on every dashboard route', () => {
    for (const route of ['/dashboard', '/dashboard/troubleshoot', '/dashboard/find']) {
      const { container, unmount } = renderDashboard(route);
      expect(shell(container).className).toContain('overflow-hidden');
      expect(scrollRegion(container)).not.toBeNull();
      unmount();
    }
  });

  it('lets clicks through the navbar wrapper everywhere except its own controls', () => {
    const { container } = renderDashboard();
    const navbar = container.querySelector<HTMLElement>('.fixed.top-6');

    expect(navbar!.className).toContain('pointer-events-none');
    // every interactive cluster re-enables events for itself
    navbar!.querySelectorAll(':scope > *').forEach((child) => {
      expect((child as HTMLElement).className).toContain('pointer-events-auto');
    });
  });
});
