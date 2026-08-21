import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DiagnosticShowcase from './DiagnosticShowcase';

/** Landing-page visual: presentation only, must never touch the network. */
function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('DiagnosticShowcase', () => {
  beforeEach(() => {
    mockReducedMotion(false);
    vi.stubGlobal('fetch', vi.fn());
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders the product-style header, not a logo mark', () => {
    render(<DiagnosticShowcase />);
    expect(screen.getByText('Wrench AI')).toBeInTheDocument();
    expect(screen.getByText('Vehicle Troubleshooter')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();
  });

  it('drops the retired copy', () => {
    render(<DiagnosticShowcase />);
    expect(screen.queryByText(/Generating 12 mechanics/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/System Analysis/i)).not.toBeInTheDocument();
  });

  it('renders every stage of the sequence', () => {
    render(<DiagnosticShowcase />);
    expect(screen.getByTestId('showcase-customer')).toHaveTextContent("My bike won't start.");
    expect(screen.getByTestId('showcase-assistant')).toHaveTextContent('Does the starter motor turn?');
    expect(screen.getByTestId('showcase-result')).toHaveTextContent('Battery / Starter System');
    expect(screen.getByTestId('showcase-result')).toHaveTextContent('Confidence 82%');
  });

  it('advances from searching to a matched mechanic', () => {
    render(<DiagnosticShowcase />);
    expect(screen.getByTestId('showcase-searching')).toHaveTextContent('Finding nearby mechanics');
    // no fixed mechanic count is ever claimed
    expect(screen.queryByText(/\d+ mechanics nearby/)).not.toBeInTheDocument();

    advance(1400 * 4);

    const matched = screen.getByTestId('showcase-matched');
    expect(matched).toHaveTextContent('Mechanic matched');
    expect(matched).toHaveTextContent('Raj Auto Care');
    expect(matched).toHaveTextContent('4.9');
    expect(matched).toHaveTextContent('2.4 km away');
    expect(matched).toHaveTextContent('Available now');
  });

  it('shows the minimal you → mechanic connection', () => {
    render(<DiagnosticShowcase />);
    const route = screen.getByTestId('showcase-route');
    expect(route).toHaveTextContent('You');
    expect(route).toHaveTextContent('Mechanic');
    expect(route).toHaveTextContent('2.4 km');
  });

  it('steps forward over time', () => {
    render(<DiagnosticShowcase />);
    const panel = screen.getByTestId('diagnostic-showcase');
    expect(panel).toHaveAttribute('data-step', '0');
    advance(1400);
    expect(panel).toHaveAttribute('data-step', '1');
    advance(1400 * 3);
    expect(panel).toHaveAttribute('data-step', '4');
  });

  it('skips the animation and shows the end state under reduced motion', () => {
    mockReducedMotion(true);
    render(<DiagnosticShowcase />);
    expect(screen.getByTestId('diagnostic-showcase')).toHaveAttribute('data-step', '4');
    expect(screen.getByTestId('showcase-matched')).toBeInTheDocument();

    advance(1400 * 6); // no timer is running, so nothing moves
    expect(screen.getByTestId('diagnostic-showcase')).toHaveAttribute('data-step', '4');
  });

  it('never calls the network', () => {
    render(<DiagnosticShowcase />);
    advance(1400 * 6);
    expect(fetch).not.toHaveBeenCalled();
  });
});
