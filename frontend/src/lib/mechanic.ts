/**
 * Mechanic profile endpoints (RAD FR-09).
 *
 * Thin typed wrappers over the single HTTP boundary in `api.ts`. Components call
 * these rather than constructing requests themselves.
 */
import { apiFetchData } from './api';

/** Canonical vehicle scope — mirrors backend `app/models/vehicle.py::VehicleType`. */
export const VEHICLE_TYPES = ['BIKE', 'CAR'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];

export const VEHICLE_TYPE_LABELS: Record<VehicleType, string> = {
  BIKE: 'Two-wheeler',
  CAR: 'Four-wheeler',
};

/** Fields a mechanic submits. Mirrors `MechanicProfileCreate`. */
export interface MechanicProfileInput {
  garage_name: string;
  owner_name: string;
  experience_years: number;
  bio?: string | null;
  specialization: string;
  supported_vehicle_types: VehicleType[];
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  service_radius_km: number;
  working_start_time: string;
  working_end_time: string;
}

/** Server-owned fields are read-only here; availability has its own endpoint. */
export interface MechanicProfile extends MechanicProfileInput {
  id: string;
  user_id: string;
  is_available: boolean;
  is_verified: boolean;
  average_rating: number;
  total_reviews: number;
  completed_jobs: number;
}

export interface Availability {
  is_available: boolean;
}

/**
 * Share one in-flight request between concurrent callers.
 *
 * The navbar, the dispatch panel and the profile panel are mounted together and
 * each legitimately needs the mechanic profile, so a single render fired the same
 * GET several times. This collapses only *simultaneous* calls — the entry is
 * dropped as soon as the request settles, so nothing is ever served from a cache
 * and a refetch after a save still hits the network.
 */
const inFlight = new Map<string, Promise<unknown>>();

function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const promise = run().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

export function getMechanicProfile(): Promise<MechanicProfile> {
  return dedupe('profile', () => apiFetchData<MechanicProfile>('/profile/mechanic/'));
}

/** PUT is an upsert server-side; it deliberately leaves availability untouched. */
export function saveMechanicProfile(input: MechanicProfileInput): Promise<MechanicProfile> {
  return apiFetchData<MechanicProfile>('/profile/mechanic/', { method: 'PUT', body: input });
}

export function getAvailability(): Promise<Availability> {
  return dedupe('availability', () => apiFetchData<Availability>('/profile/mechanic/availability'));
}

export function setAvailability(isAvailable: boolean): Promise<Availability> {
  return apiFetchData<Availability>('/profile/mechanic/availability', {
    method: 'PATCH',
    body: { is_available: isAvailable },
  });
}
