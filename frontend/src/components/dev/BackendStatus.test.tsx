import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BackendStatus from './BackendStatus';

vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/api')>('../../lib/api');
  return { ...actual, getHealth: vi.fn() };
});

const { getHealth } = await import('../../lib/api');

describe('BackendStatus', () => {
  afterEach(() => vi.clearAllMocks());

  it('reports a connected backend after a successful health call', async () => {
    vi.mocked(getHealth).mockResolvedValue({ status: 'ok' });
    render(<BackendStatus />);
    await waitFor(() => expect(screen.getByText('Backend connected')).toBeInTheDocument());
    expect(screen.getByTestId('backend-status')).toHaveAttribute('data-state', 'connected');
  });

  it('reports an unreachable backend when the health call fails', async () => {
    vi.mocked(getHealth).mockRejectedValue(new Error('Cannot reach the backend'));
    render(<BackendStatus />);
    await waitFor(() => expect(screen.getByText('Backend unreachable')).toBeInTheDocument());
    expect(screen.getByTestId('backend-status')).toHaveAttribute('data-state', 'error');
  });
});
