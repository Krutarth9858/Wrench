import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from './auth';
import { ApiError, getAuthToken, setAuthToken } from './api';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const envelope = (data: unknown) => json({ status: 'success', message: null, data });

const TOKENS = { access_token: 'access-1', refresh_token: 'refresh-1', token_type: 'bearer' };
const USER = {
  id: 'u-1', email: 'c@example.com', phone_number: '+11234567890',
  role: 'CUSTOMER' as const, is_active: true,
};

const reset = () => {
  setAuthToken(null);
  localStorage.clear();
  useAuth.setState({ accessToken: null, refreshToken: null, user: null, status: 'idle' });
};

describe('auth store', () => {
  beforeEach(() => { reset(); vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => vi.unstubAllGlobals());

  it('logs in, stores the user and registers the bearer token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(envelope(TOKENS)).mockResolvedValueOnce(envelope(USER));
    const user = await useAuth.getState().login('c@example.com', 'password123');
    expect(user.email).toBe(USER.email);
    expect(useAuth.getState().user).toEqual(USER);
    expect(getAuthToken()).toBe('access-1');
  });

  it('surfaces the backend error message on a bad login', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(json({ detail: 'Incorrect email or password' }, 401));
    await expect(useAuth.getState().login('c@example.com', 'nope')).rejects.toBeInstanceOf(ApiError);
    expect(useAuth.getState().user).toBeNull();
  });

  it('registers then logs the new user straight in', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(envelope(USER))     // POST /auth/register
      .mockResolvedValueOnce(envelope(TOKENS))   // POST /auth/login
      .mockResolvedValueOnce(envelope(USER));    // GET  /auth/me
    await useAuth.getState().register({
      email: USER.email, phone_number: USER.phone_number, password: 'password123', role: 'CUSTOMER',
    });
    expect(useAuth.getState().user).toEqual(USER);
    const paths = vi.mocked(fetch).mock.calls.map((c) => String(c[0]));
    expect(paths[0]).toContain('/auth/register');
    expect(paths[1]).toContain('/auth/login');
  });

  it('sends the mechanic role through to the backend', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(envelope({ ...USER, role: 'MECHANIC' }))
      .mockResolvedValueOnce(envelope(TOKENS))
      .mockResolvedValueOnce(envelope({ ...USER, role: 'MECHANIC' }));
    await useAuth.getState().register({
      email: 'm@example.com', phone_number: '+11234567891', password: 'password123', role: 'MECHANIC',
    });
    const body = JSON.parse((vi.mocked(fetch).mock.calls[0][1] as RequestInit).body as string);
    expect(body.role).toBe('MECHANIC');
    expect(useAuth.getState().user?.role).toBe('MECHANIC');
  });

  it('clears all auth state on logout', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(envelope(TOKENS)).mockResolvedValueOnce(envelope(USER));
    await useAuth.getState().login('c@example.com', 'password123');
    vi.mocked(fetch).mockResolvedValueOnce(envelope(null));
    await useAuth.getState().logout();
    const s = useAuth.getState();
    expect(s.user).toBeNull();
    expect(s.accessToken).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(getAuthToken()).toBeNull();
  });

  it('never persists the access token, only the refresh token', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(envelope(TOKENS)).mockResolvedValueOnce(envelope(USER));
    await useAuth.getState().login('c@example.com', 'password123');
    const stored = localStorage.getItem('auth-storage') ?? '';
    expect(stored).toContain('refresh-1');
    expect(stored).not.toContain('access-1');
  });

  it('restores a session by exchanging the refresh token on boot', async () => {
    useAuth.setState({ refreshToken: 'refresh-1' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(envelope({ ...TOKENS, access_token: 'access-2' }))
      .mockResolvedValueOnce(envelope(USER));
    await useAuth.getState().loadSession();
    expect(useAuth.getState().user).toEqual(USER);
    expect(getAuthToken()).toBe('access-2');
    expect(useAuth.getState().status).toBe('ready');
  });

  it('treats an expired refresh token as a normal signed-out state', async () => {
    useAuth.setState({ refreshToken: 'stale' });
    vi.mocked(fetch).mockResolvedValueOnce(json({ detail: 'Invalid or expired refresh token' }, 401));
    await useAuth.getState().loadSession();
    const s = useAuth.getState();
    expect(s.user).toBeNull();
    expect(s.refreshToken).toBeNull();
    expect(s.status).toBe('ready');
  });

  it('becomes ready without a network call when there is no refresh token', async () => {
    await useAuth.getState().loadSession();
    expect(useAuth.getState().status).toBe('ready');
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('loadSession concurrency', () => {
  beforeEach(() => { reset(); vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => vi.unstubAllGlobals());

  it('shares one refresh exchange across concurrent callers', async () => {
    // Regression: refresh-token rotation means a second concurrent call would replay
    // an already-revoked token and sign the user out. React StrictMode invokes the
    // boot effect twice, so this must be safe.
    useAuth.setState({ refreshToken: 'refresh-1' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(envelope({ ...TOKENS, refresh_token: 'refresh-2' }))
      .mockResolvedValueOnce(envelope(USER))
      .mockResolvedValue(json({ detail: 'Invalid or expired refresh token' }, 401));

    await Promise.all([
      useAuth.getState().loadSession(),
      useAuth.getState().loadSession(),
      useAuth.getState().loadSession(),
    ]);

    expect(useAuth.getState().user).toEqual(USER);
    expect(useAuth.getState().refreshToken).toBe('refresh-2');
    // exactly one /auth/refresh + one /auth/me — not three of each
    expect(vi.mocked(fetch).mock.calls.length).toBe(2);
  });
});
