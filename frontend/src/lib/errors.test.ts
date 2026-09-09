import { describe, expect, it } from 'vitest';
import { ApiError } from './api';
import { describeError, isOffline, isUnauthorized } from './errors';

describe('error descriptions', () => {
  it('names the offline case without exposing the API URL', () => {
    const offline = new ApiError(0, { baseUrl: 'http://localhost:8000/api/v1' },
      'Cannot reach Wrench');
    const described = describeError(offline);
    expect(described.title).toMatch(/reach Wrench/i);
    expect(described.retryable).toBe(true);
    // Internal topology must not reach a customer-facing string.
    expect(`${described.title} ${described.message}`).not.toMatch(/localhost|http|api\/v1/);
    expect(isOffline(offline)).toBe(true);
  });

  it('treats an expired session as a sign-in, not a retry', () => {
    const described = describeError(new ApiError(401, null, 'Not authenticated'));
    expect(described.title).toMatch(/session has expired/i);
    expect(described.retryable).toBe(false);
    expect(isUnauthorized(new ApiError(401, null, 'x'))).toBe(true);
  });

  it('distinguishes forbidden from not found', () => {
    expect(describeError(new ApiError(403, null, 'x')).title).toMatch(/access/i);
    expect(describeError(new ApiError(404, null, 'x')).title).toMatch(/not found/i);
  });

  it('prefers the server message on 4xx, where it was written for a person', () => {
    const conflict = new ApiError(409, 'That slot has just been taken.', 'ignored');
    expect(describeError(conflict).message).toBe('That slot has just been taken.');
  });

  it('never repeats a 5xx body back to the customer', () => {
    // A 500 detail can carry internals; the generic copy is used instead.
    const server = new ApiError(500, 'psycopg: relation "users" does not exist', 'boom');
    const described = describeError(server);
    expect(described.message).not.toMatch(/psycopg|relation/);
    expect(described.title).toMatch(/problem/i);
  });

  it('maps gateway and unavailable separately from a plain 500', () => {
    expect(describeError(new ApiError(502, null, 'x')).title).toMatch(/depends on/i);
    expect(describeError(new ApiError(503, null, 'x')).title).toMatch(/unavailable/i);
  });

  it('falls back safely for a non-API error', () => {
    const described = describeError(new TypeError('undefined is not a function'));
    expect(described.title).toBe('Something went wrong');
    expect(described.message).not.toMatch(/undefined is not a function/);
  });

  it('covers every status the app can surface', () => {
    for (const status of [0, 401, 403, 404, 409, 422, 429, 500, 502, 503]) {
      const d = describeError(new ApiError(status, null, 'x'));
      expect(d.title.length).toBeGreaterThan(0);
      expect(d.message.length).toBeGreaterThan(0);
    }
  });
});
