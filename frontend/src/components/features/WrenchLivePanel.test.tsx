import { render, screen, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WrenchLivePanel } from './WrenchLivePanel';

describe('WrenchLivePanel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows the mechanic, the diagnosis and the estimate', () => {
    render(<WrenchLivePanel />);
    expect(screen.getByText('MV Motors')).toBeInTheDocument();
    expect(screen.getByText('ON THE WAY')).toBeInTheDocument();
    expect(screen.getByText('Battery / starter system')).toBeInTheDocument();
    expect(screen.getByText('₹450')).toBeInTheDocument();
  });

  it('settles the confidence reading after mount rather than showing it preset', () => {
    render(<WrenchLivePanel />);
    expect(screen.getByText('0%')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByText('82%')).toBeInTheDocument();
  });

  it('counts the ETA down and wraps back round', () => {
    render(<WrenchLivePanel />);
    expect(screen.getByText('8')).toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(4200));
    expect(screen.getByText('7')).toBeInTheDocument();

    // 8 → 2 takes six ticks; the seventh restarts the journey.
    act(() => void vi.advanceTimersByTime(4200 * 5));
    expect(screen.getByText('2')).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(4200));
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('stops its timers when unmounted', () => {
    const { unmount } = render(<WrenchLivePanel />);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
