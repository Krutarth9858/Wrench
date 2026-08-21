/**
 * The single HTTP boundary between the Wrench frontend and the FastAPI backend.
 *
 * Every network call goes through `apiFetch`. Do not call `fetch` directly from
 * components — routing all traffic through here is what makes auth headers,
 * error shape, and the base URL consistent across the app.
 */

const DEFAULT_BASE_URL = 'http://localhost:8000/api/v1';

/** Base URL for the versioned API. Configure with VITE_API_BASE_URL. */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? DEFAULT_BASE_URL;

/**
 * Backend success envelope (app/schemas/response.py::ResponseModel).
 * Errors do not use this shape — FastAPI returns `{ detail: ... }`.
 */
export interface ApiEnvelope<T> {
  status: string;
  message: string | null;
  data: T | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly detail: unknown;

  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

// Bearer token used for authenticated requests. The auth store owns the token's
// lifecycle and registers it here, keeping this module dependency-free so it can
// never form an import cycle with the store.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  /** Serialized as JSON. Use `rawBody` for FormData or other payloads. */
  body?: unknown;
  rawBody?: BodyInit | null;
}

/**
 * Perform a request against the API.
 *
 * @throws {ApiError} on a non-2xx response or unreachable backend.
 */
export async function apiFetch<T = unknown>(
  path: string,
  { body, rawBody, headers, ...init }: ApiRequestOptions = {},
): Promise<T> {
  const requestHeaders = new Headers(headers);
  if (body !== undefined && !requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/json');
  }
  if (authToken) {
    requestHeaders.set('Authorization', `Bearer ${authToken}`);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: requestHeaders,
      body: body !== undefined ? JSON.stringify(body) : rawBody,
    });
  } catch (cause) {
    throw new ApiError(0, cause, `Cannot reach the backend at ${API_BASE_URL}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = (payload as { detail?: unknown } | null)?.detail;
    throw new ApiError(
      response.status,
      detail ?? payload,
      typeof detail === 'string' ? detail : `Request failed with status ${response.status}`,
    );
  }

  return payload as T;
}

/** Unwrap the backend's ResponseModel envelope down to its `data` field. */
export async function apiFetchData<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const envelope = await apiFetch<ApiEnvelope<T>>(path, options);
  return envelope.data as T;
}

export interface HealthResponse {
  status: string;
}

/** Liveness probe. Backed by GET /api/v1/health, which returns `{status:"ok"}`. */
export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health');
}
