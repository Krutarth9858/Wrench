import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import GoogleButton from './GoogleButton';
import OtpVerification from './OtpVerification';
import Login from '../../pages/Login';
import { ApiError } from '../../lib/api';
import * as authExtras from '../../lib/authExtras';
import { useAuth } from '../../lib/auth';

vi.mock('../../lib/authExtras', async () => {
  const actual = await vi.importActual<typeof import('../../lib/authExtras')>(
    '../../lib/authExtras');
  return { ...actual, googleAuthorizationUrl: vi.fn(), requestEmailCode: vi.fn() };
});

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

/** window.location is not assignable in jsdom; capture the redirect instead. */
let redirected = '';
beforeEach(() => {
  vi.clearAllMocks();
  redirected = '';
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { get href() { return redirected; }, set href(v: string) { redirected = v; } },
  });
});
afterEach(() => vi.restoreAllMocks());

describe('Continue with Google', () => {
  it('renders with a real Google mark and an accessible label', () => {
    wrap(<GoogleButton />);
    const button = screen.getByTestId('google-signin');
    expect(button).toHaveAccessibleName('Continue with Google');
    // The mark is an SVG, not text standing in for a logo.
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('sends the browser to the URL the server chose', async () => {
    vi.mocked(authExtras.googleAuthorizationUrl).mockResolvedValue(
      'https://accounts.google.com/o/oauth2/v2/auth?state=signed');
    wrap(<GoogleButton />);

    await userEvent.click(screen.getByTestId('google-signin'));

    await waitFor(() => expect(redirected).toContain('accounts.google.com'));
    // The destination is never constructed in the browser.
    expect(authExtras.googleAuthorizationUrl).toHaveBeenCalledWith('CUSTOMER');
  });

  it('carries the role chosen at registration', async () => {
    vi.mocked(authExtras.googleAuthorizationUrl).mockResolvedValue('https://accounts.google.com/x');
    wrap(<GoogleButton role="MECHANIC" />);
    await userEvent.click(screen.getByTestId('google-signin'));
    await waitFor(() => expect(authExtras.googleAuthorizationUrl).toHaveBeenCalledWith('MECHANIC'));
  });

  it('shows a loading state while connecting', async () => {
    let release: (v: string) => void = () => {};
    vi.mocked(authExtras.googleAuthorizationUrl).mockReturnValue(
      new Promise((res) => { release = res; }));
    wrap(<GoogleButton />);

    await userEvent.click(screen.getByTestId('google-signin'));
    expect(screen.getByTestId('google-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('google-signin')).toBeDisabled();
    release('https://accounts.google.com/x');
  });

  it('explains itself when Google is not configured on the server', async () => {
    vi.mocked(authExtras.googleAuthorizationUrl).mockRejectedValue(
      new ApiError(503, null, 'not configured'));
    const onError = vi.fn();
    wrap(<GoogleButton onError={onError} />);

    await userEvent.click(screen.getByTestId('google-signin'));

    await waitFor(() => expect(onError).toHaveBeenCalledWith(
      'Google Sign-In is not available right now.'));
    expect(redirected).toBe('');
  });

  it('is disabled while the surrounding form is busy', () => {
    wrap(<GoogleButton disabled />);
    expect(screen.getByTestId('google-signin')).toBeDisabled();
  });
});

describe('email verification', () => {
  const verifyEmailCode = vi.fn();

  beforeEach(() => {
    verifyEmailCode.mockReset();
    useAuth.setState({ verifyEmailCode } as never);
    vi.mocked(authExtras.requestEmailCode).mockResolvedValue({
      email: 'user@gmail.com', expires_in_minutes: 10, resend_after_seconds: 60 });
  });

  const type = async (code: string) => {
    await userEvent.type(screen.getByTestId('otp-digit-0'), code);
  };

  it('masks the address the code went to', () => {
    wrap(<OtpVerification email="someone@gmail.com" onVerified={() => {}} />);
    expect(screen.getByTestId('otp-email')).toHaveTextContent('s******@gmail.com');
    expect(screen.getByTestId('otp-email')).not.toHaveTextContent('someone@gmail.com');
  });

  it('verifies a complete code and continues', async () => {
    verifyEmailCode.mockResolvedValue({ id: 'u-1' });
    const onVerified = vi.fn();
    wrap(<OtpVerification email="user@gmail.com" onVerified={onVerified} />);

    await type('123456');

    await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledWith('user@gmail.com', '123456'));
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
  });

  it('spreads a pasted code across the boxes', async () => {
    verifyEmailCode.mockResolvedValue({ id: 'u-1' });
    wrap(<OtpVerification email="user@gmail.com" onVerified={() => {}} />);

    await userEvent.click(screen.getByTestId('otp-digit-0'));
    await userEvent.paste('654321');

    await waitFor(() => expect(verifyEmailCode).toHaveBeenCalledWith('user@gmail.com', '654321'));
  });

  it('shows the server message for a wrong code and clears the boxes', async () => {
    verifyEmailCode.mockRejectedValue(
      new ApiError(400, null, 'That code is incorrect. 4 attempts remaining.'));
    wrap(<OtpVerification email="user@gmail.com" onVerified={() => {}} />);

    await type('000000');

    expect(await screen.findByTestId('otp-error')).toHaveTextContent('4 attempts remaining');
    expect(screen.getByTestId('otp-digit-0')).toHaveValue('');
  });

  it('surfaces an expired code', async () => {
    verifyEmailCode.mockRejectedValue(
      new ApiError(400, null, 'That code has expired. Request a new one.'));
    wrap(<OtpVerification email="user@gmail.com" onVerified={() => {}} />);
    await type('123456');
    expect(await screen.findByTestId('otp-error')).toHaveTextContent('expired');
  });

  it('surfaces the attempt cap', async () => {
    verifyEmailCode.mockRejectedValue(
      new ApiError(400, null, 'Too many incorrect attempts. Request a new code.'));
    wrap(<OtpVerification email="user@gmail.com" onVerified={() => {}} />);
    await type('123456');
    expect(await screen.findByTestId('otp-error')).toHaveTextContent('Too many incorrect attempts');
  });

  it('counts down before offering a resend', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    wrap(<OtpVerification email="user@gmail.com" resendAfterSeconds={3} onVerified={() => {}} />);

    expect(screen.getByTestId('otp-cooldown')).toHaveTextContent('Resend in 3s');
    expect(screen.queryByTestId('otp-resend')).not.toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(3000);

    await waitFor(() => expect(screen.getByTestId('otp-resend')).toBeInTheDocument());
    vi.useRealTimers();
  });

  it('resends and says the old code is dead', async () => {
    wrap(<OtpVerification email="user@gmail.com" resendAfterSeconds={0} onVerified={() => {}} />);

    await userEvent.click(screen.getByTestId('otp-resend'));

    await waitFor(() => expect(authExtras.requestEmailCode).toHaveBeenCalledWith('user@gmail.com'));
    expect(await screen.findByTestId('otp-notice')).toHaveTextContent('no longer works');
  });

  it('surfaces a rate-limited resend', async () => {
    vi.mocked(authExtras.requestEmailCode).mockRejectedValue(
      new ApiError(429, null, 'Please wait 42s before requesting another code.'));
    wrap(<OtpVerification email="user@gmail.com" resendAfterSeconds={0} onVerified={() => {}} />);

    await userEvent.click(screen.getByTestId('otp-resend'));

    expect(await screen.findByTestId('otp-error')).toHaveTextContent('Please wait 42s');
  });

  it('will not submit an incomplete code', async () => {
    wrap(<OtpVerification email="user@gmail.com" onVerified={() => {}} />);
    await type('123');
    expect(screen.getByTestId('otp-verify')).toBeDisabled();
    expect(verifyEmailCode).not.toHaveBeenCalled();
  });
});

describe('the login page keeps working', () => {
  it('still offers password sign-in alongside Google', () => {
    wrap(<Login />);
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByTestId('google-signin')).toBeInTheDocument();
  });
});
