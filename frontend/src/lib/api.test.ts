import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL, ApiError, apiFetch, apiFetchData, getHealth, setAuthToken } from './api';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  beforeEach(() => {
    setAuthToken(null);
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefixes requests with the configured base URL', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));
    await getHealth();
    expect(fetch).toHaveBeenCalledWith(`${API_BASE_URL}/health`, expect.anything());
  });

  it('targets the versioned API contract', () => {
    expect(API_BASE_URL).toMatch(/\/api\/v1$/);
  });

  it('omits the Authorization header when no token is set', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));
    await getHealth();
    const { headers } = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((headers as Headers).has('Authorization')).toBe(false);
  });

  it('attaches the bearer token once registered', async () => {
    setAuthToken('token-123');
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));
    await getHealth();
    const { headers } = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect((headers as Headers).get('Authorization')).toBe('Bearer token-123');
  });

  it('sends JSON bodies with the correct content type', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));
    await apiFetch('/thing', { method: 'POST', body: { a: 1 } });
    const init = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(init.body).toBe('{"a":1}');
    expect((init.headers as Headers).get('Content-Type')).toBe('application/json');
  });

  it('unwraps the ResponseModel envelope', async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ status: 'success', message: null, data: { id: 'abc' } }),
    );
    await expect(apiFetchData<{ id: string }>('/thing')).resolves.toEqual({ id: 'abc' });
  });

  it('returns undefined for 204 responses', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch('/thing', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('raises ApiError carrying the FastAPI detail', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ detail: 'Vehicle not found' }, 404));
    await expect(apiFetch('/thing')).rejects.toMatchObject({
      name: 'ApiError',
      status: 404,
      message: 'Vehicle not found',
    });
  });

  it('raises ApiError with status 0 when the backend is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));
    const error = await apiFetch('/health').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
  });
});
