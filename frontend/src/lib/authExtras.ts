/** Google Sign-In and email OTP endpoints, outside the session store.
 *
 *  These start a flow; the store finishes it (`signInWithGoogle`,
 *  `verifyEmailCode`) so there is only ever one place a session is created.
 */
import { apiFetchData } from './api';

export type OtpPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export interface OtpRequestResult {
  email: string;
  expires_in_minutes: number;
  resend_after_seconds: number;
}

/** Where to send the browser to authenticate with Google. */
export function googleAuthorizationUrl(role: 'CUSTOMER' | 'MECHANIC' = 'CUSTOMER') {
  return apiFetchData<{ authorization_url: string }>(
    `/auth/google/url?role=${role}`,
  ).then((r) => r.authorization_url);
}

/** Ask for a verification code. Succeeds whether or not the account exists. */
export function requestEmailCode(
  email: string, purpose: OtpPurpose = 'EMAIL_VERIFICATION',
): Promise<OtpRequestResult> {
  return apiFetchData<OtpRequestResult>('/auth/otp/request', {
    method: 'POST', body: { email, purpose },
  });
}

/** `someone@example.com` -> `s***@example.com`, for display only. */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(local.length - 1, 1))}@${domain}`;
}
