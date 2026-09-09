import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMechanicProfile, getAvailability } from './mechanic';
import { useAvailability } from './availability';

vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, apiFetchData: vi.fn() };
});
const { apiFetchData } = await import('./api');

/** Resolves only when `release()` is called, so two callers can overlap. */
function deferred<T>() {
  let release!: (value: T) => void;
  let fail!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { release = res; fail = rej; });
  return { promise, release, fail };
}

describe('shared mechanic requests', () => {
  afterEach(() => vi.clearAllMocks());

  // The navbar and the page both need the profile on the same render. Regression:
  // the navbar fetched it behind a dynamic import(), landing just after the page's
  // request had settled, so `dedupe` never saw them together and the same profile
  // was fetched twice on every load of a page that reads it.
  it('serves concurrent callers one shared profile request', async () => {
    const gate = deferred<{ garage_name: string }>();
    vi.mocked(apiFetchData).mockReturnValue(gate.promise as never);

    const first = getMechanicProfile();
    const second = getMechanicProfile();
    gate.release({ garage_name: 'QA Rescue Garage' });

    expect(await first).toEqual(await second);
    expect(apiFetchData).toHaveBeenCalledTimes(1);
  });

  it('does not serve a later caller from the settled request', async () => {
    // Sharing is limited to overlapping calls: nothing is cached, so a refetch
    // after a save still reaches the network.
    vi.mocked(apiFetchData).mockResolvedValue({ garage_name: 'One' } as never);
    await getMechanicProfile();
    await getMechanicProfile();
    expect(apiFetchData).toHaveBeenCalledTimes(2);
  });

  it('keeps a failed request from poisoning the next one', async () => {
    const gate = deferred<never>();
    vi.mocked(apiFetchData).mockReturnValueOnce(gate.promise as never);
    const failing = getAvailability();
    gate.fail(new Error('network down'));
    await expect(failing).rejects.toThrow('network down');

    // The in-flight entry is dropped on rejection, so the retry is a real request.
    vi.mocked(apiFetchData).mockResolvedValue({ is_available: true } as never);
    await expect(getAvailability()).resolves.toEqual({ is_available: true });
    expect(apiFetchData).toHaveBeenCalledTimes(2);
  });
});

describe('shared availability state', () => {
  afterEach(() => useAvailability.setState({ isAvailable: null }));

  it('starts unknown rather than assuming unavailable', () => {
    expect(useAvailability.getState().isAvailable).toBeNull();
  });

  // The navbar clears this when the authenticated user changes, so a second
  // mechanic signing in on the same tab never sees the first one's pill.
  it('can be reset to unknown when the session changes', () => {
    useAvailability.getState().setKnownAvailability(true);
    expect(useAvailability.getState().isAvailable).toBe(true);

    useAvailability.getState().setKnownAvailability(null);
    expect(useAvailability.getState().isAvailable).toBeNull();
  });
});
