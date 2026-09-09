/**
 * One place that turns a thrown error into something worth showing a person.
 *
 * Every message answers the three questions an error should: what happened,
 * why it matters when that is not obvious, and what to do next. None of them
 * expose a URL, a stack, a status code or anything else about how Wrench is
 * built — those stay on `ApiError.detail` for the console.
 */
import { ApiError } from './api';

export interface ErrorDescription {
  title: string;
  message: string;
  /** Label for the recovery action, when one exists. */
  action?: string;
  /** True when retrying the same thing is plausibly useful. */
  retryable: boolean;
}

const UNKNOWN: ErrorDescription = {
  title: 'Something went wrong',
  message: 'That did not work, and we are not sure why. Trying again usually helps.',
  action: 'Try again',
  retryable: true,
};

const BY_STATUS: Record<number, ErrorDescription> = {
  // `ApiError(0)` is what `apiFetch` throws when fetch itself failed: offline,
  // DNS, TLS, or the API not running.
  0: {
    title: "Can't reach Wrench",
    message: 'Check your connection. Your work is safe — nothing was sent.',
    action: 'Try again',
    retryable: true,
  },
  401: {
    title: 'Your session has expired',
    message: 'Sign in again to pick up where you left off.',
    action: 'Sign in',
    retryable: false,
  },
  403: {
    title: "You don't have access to this",
    message: 'This belongs to a different account, or to a different kind of account.',
    action: 'Back to dashboard',
    retryable: false,
  },
  404: {
    title: 'Not found',
    message: 'This may have been cancelled or removed, or the link may be wrong.',
    action: 'Back to dashboard',
    retryable: false,
  },
  409: {
    title: 'That is no longer possible',
    message: 'Something changed while you were looking at this. Refresh to see where it stands.',
    action: 'Refresh',
    retryable: true,
  },
  422: {
    title: 'Check the details',
    message: 'Some of what was entered is not valid.',
    retryable: false,
  },
  429: {
    title: 'Too many attempts',
    message: 'Wait a moment before trying that again.',
    retryable: true,
  },
  500: {
    title: 'Wrench had a problem',
    message: 'This is on our side, not yours. Trying again shortly usually works.',
    action: 'Try again',
    retryable: true,
  },
  502: {
    title: 'A service Wrench depends on is unavailable',
    message: 'This is usually brief. Nothing you did caused it.',
    action: 'Try again',
    retryable: true,
  },
  503: {
    title: 'Temporarily unavailable',
    message: 'Wrench is briefly unavailable. Please try again in a moment.',
    action: 'Try again',
    retryable: true,
  },
};

/**
 * Describe an error for display.
 *
 * A server-supplied message is preferred over the generic one when the backend
 * wrote it for a person — validation, conflicts and rate limits all do. Those
 * are deliberate, specific and more useful than anything decided here.
 */
export function describeError(error: unknown): ErrorDescription {
  if (!(error instanceof ApiError)) return UNKNOWN;

  const base = BY_STATUS[error.status] ?? (error.status >= 500 ? BY_STATUS[500] : UNKNOWN);
  const fromServer = typeof error.detail === 'string' ? error.detail : '';

  // 4xx bodies carry copy intended for the customer; 5xx bodies do not.
  const useServerCopy = fromServer && error.status >= 400 && error.status < 500;
  return useServerCopy ? { ...base, message: fromServer } : base;
}

export const isUnauthorized = (error: unknown) =>
  error instanceof ApiError && error.status === 401;

export const isOffline = (error: unknown) =>
  error instanceof ApiError && error.status === 0;
