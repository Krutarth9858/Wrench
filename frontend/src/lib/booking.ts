/** Booking endpoints (RAD FR-03 / FR-05). Typed wrappers over `api.ts`. */
import { apiFetchData } from './api';
import type { VehicleType } from './mechanic';

export const BOOKING_STATUSES = [
  'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING: 'Awaiting mechanic',
  ACCEPTED: 'Accepted',
  IN_PROGRESS: 'Service in progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Declined',
};

export const STATUS_TONES: Record<BookingStatus, string> = {
  PENDING: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  ACCEPTED: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  IN_PROGRESS: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
  COMPLETED: 'bg-white/5 border-white/15 text-zinc-300',
  CANCELLED: 'bg-red-500/10 border-red-500/30 text-red-300',
  REJECTED: 'bg-red-500/10 border-red-500/30 text-red-300',
};

export interface BookingVehicle {
  id: string;
  vehicle_type: VehicleType;
  brand: string;
  model: string;
  registration_number?: string | null;
  nickname?: string | null;
}

export interface BookingParty {
  name: string;
  phone_number?: string | null;
}

export interface Booking {
  id: string;
  status: BookingStatus;
  vehicle_type: VehicleType;
  problem_description: string;
  service_latitude: number;
  service_longitude: number;
  service_address?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Present only when the booking was linked to a saved vehicle. */
  vehicle?: BookingVehicle | null;
  customer: BookingParty;
  mechanic: BookingParty;
}

export interface CreateBookingInput {
  mechanic_profile_id: string;
  /** Chosen during booking. No saved vehicle is required. */
  vehicle_type: VehicleType;
  problem_description: string;
  service_latitude: number;
  service_longitude: number;
  service_address?: string | null;
}

export function createBooking(input: CreateBookingInput): Promise<Booking> {
  return apiFetchData<Booking>('/bookings/', { method: 'POST', body: input });
}

/** Customers get the bookings they raised; mechanics get the ones assigned to them. */
export async function listBookings(statuses?: BookingStatus[]): Promise<Booking[]> {
  const query = statuses?.length
    ? `?${statuses.map((s) => `status=${s}`).join('&')}`
    : '';
  const result = await apiFetchData<{ bookings: Booking[] }>(`/bookings/${query}`);
  return result.bookings;
}

export function getBooking(id: string): Promise<Booking> {
  return apiFetchData<Booking>(`/bookings/${id}`);
}

/** The server owns the state machine; these are intents, not status writes. */
type BookingAction = 'accept' | 'reject' | 'start' | 'complete' | 'cancel';

export function actOnBooking(id: string, action: BookingAction): Promise<Booking> {
  return apiFetchData<Booking>(`/bookings/${id}/${action}`, { method: 'POST' });
}
