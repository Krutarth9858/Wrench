/** Scheduled Service endpoints. Typed wrappers over `api.ts`.
 *
 *  Emergency roadside assistance lives in `booking.ts` and is a separate flow
 *  with its own statuses; nothing is shared between the two but the API client.
 */
import { apiFetchData } from './api';
import type { VehicleType } from './mechanic';

export const SERVICE_TYPES = ['BASIC', 'FULL', 'ENGINE_CHECKUP', 'CUSTOM'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const APPOINTMENT_STATUSES = [
  'REQUESTED', 'QUOTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'CONFIRMED',
  'IN_SERVICE', 'COMPLETED', 'DECLINED', 'CANCELLED',
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export type PaymentStatus =
  | 'NOT_REQUIRED' | 'PENDING' | 'PAID' | 'FAILED'
  // Refund lifecycle: owed -> accepted by the gateway -> settled. Only
  // REFUNDED means the money is actually back.
  | 'REFUND_PENDING' | 'REFUND_INITIATED' | 'REFUNDED' | 'REFUND_FAILED';

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  REQUESTED: 'Awaiting quotation',
  QUOTED: 'Quotation ready',
  PAYMENT_PENDING: 'Payment pending',
  PAYMENT_CONFIRMED: 'Awaiting mechanic',
  CONFIRMED: 'Confirmed',
  IN_SERVICE: 'Service in progress',
  COMPLETED: 'Completed',
  DECLINED: 'Declined',
  CANCELLED: 'Cancelled',
};

export const STATUS_TONES: Record<AppointmentStatus, string> = {
  REQUESTED: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  QUOTED: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
  PAYMENT_PENDING: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  PAYMENT_CONFIRMED: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
  CONFIRMED: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  IN_SERVICE: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
  COMPLETED: 'bg-white/5 border-white/15 text-zinc-300',
  DECLINED: 'bg-red-500/10 border-red-500/30 text-red-300',
  CANCELLED: 'bg-red-500/10 border-red-500/30 text-red-300',
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  NOT_REQUIRED: 'No payment due yet',
  PENDING: 'Payment pending',
  PAID: 'Paid',
  FAILED: 'Payment failed',
  REFUND_PENDING: 'Refund due',
  REFUND_INITIATED: 'Refund on the way',
  REFUNDED: 'Refunded',
  REFUND_FAILED: 'Refund failed',
};

/** Statuses an appointment can never leave. */
export const TERMINAL_STATUSES: ReadonlySet<AppointmentStatus> = new Set<AppointmentStatus>([
  'COMPLETED', 'DECLINED', 'CANCELLED',
]);

/** Mirrors the customer half of the server transition table. The server remains
 *  the authority — this only decides whether the UI offers the action. */
export const CANCELLABLE_STATUSES: ReadonlySet<AppointmentStatus> =
  new Set<AppointmentStatus>([
    'REQUESTED', 'QUOTED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'CONFIRMED',
  ]);

export interface ServicePackage {
  id: string;
  service_type: ServiceType;
  vehicle_type: VehicleType;
  name: string;
  description: string;
  included_items: string[];
  best_for: string;
  /** null for CUSTOM — the mechanic quotes it. Minor units (paise). */
  price_minor: number | null;
  duration_minutes: number;
}

export interface AppointmentParty {
  name: string;
  phone_number?: string | null;
}

export interface Appointment {
  id: string;
  service_type: ServiceType;
  service_name: string;
  vehicle_type: VehicleType;
  appointment_date: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  description?: string | null;
  service_address?: string | null;
  service_latitude?: number | null;
  service_longitude?: number | null;
  status: AppointmentStatus;
  payment_status: PaymentStatus;
  price_minor?: number | null;
  quoted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  customer: AppointmentParty;
  mechanic: AppointmentParty;
}

export interface PaymentOrder {
  order_id: string;
  amount_minor: number;
  currency: string;
  provider: string;
  public_key: string;
}

/** Money arrives in minor units so no float ever represents a price. */
export function formatPrice(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return 'Quotation';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(minor / 100);
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/** "10:00:00" -> "10:00 AM" */
export function formatTime(value: string): string {
  const [h, m] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(h, m, 0, 0);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function listServicePackages(vehicleType?: VehicleType): Promise<ServicePackage[]> {
  const query = vehicleType ? `?vehicle_type=${vehicleType}` : '';
  return apiFetchData<{ packages: ServicePackage[] }>(
    `/appointments/service-packages${query}`,
  ).then((r) => r.packages);
}

export interface SlotQuery {
  mechanicProfileId: string;
  serviceType: ServiceType;
  vehicleType: VehicleType;
  date: string;
}

export function listSlots(q: SlotQuery): Promise<{ slots: string[]; duration_minutes: number }> {
  const query = new URLSearchParams({
    mechanic_profile_id: q.mechanicProfileId,
    service_type: q.serviceType,
    vehicle_type: q.vehicleType,
    appointment_date: q.date,
  });
  return apiFetchData(`/appointments/slots?${query.toString()}`);
}

export interface CreateAppointmentInput {
  mechanic_profile_id: string;
  service_type: ServiceType;
  vehicle_type: VehicleType;
  appointment_date: string;
  start_time: string;
  description?: string | null;
  service_latitude?: number | null;
  service_longitude?: number | null;
  service_address?: string | null;
}

export function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  return apiFetchData<Appointment>('/appointments/', { method: 'POST', body: input });
}

/** Customers get the appointments they raised; mechanics the ones assigned to them. */
export function listAppointments(): Promise<Appointment[]> {
  return apiFetchData<{ appointments: Appointment[] }>('/appointments/')
    .then((r) => r.appointments);
}

export function getAppointment(id: string): Promise<Appointment> {
  return apiFetchData<Appointment>(`/appointments/${id}`);
}

/** The server owns the state machine; these are intents, not status writes. */
type CustomerAction = 'cancel' | 'accept-quotation';
type MechanicAction = 'accept' | 'decline' | 'start' | 'complete';

export function actOnAppointment(
  id: string, action: CustomerAction | MechanicAction,
): Promise<Appointment> {
  return apiFetchData<Appointment>(`/appointments/${id}/${action}`, { method: 'POST' });
}

export function quoteAppointment(id: string, amount: number): Promise<Appointment> {
  return apiFetchData<Appointment>(`/appointments/${id}/quote`, {
    method: 'POST', body: { amount },
  });
}

/** The amount is decided server-side; nothing about price is sent from here. */
export function createPaymentOrder(id: string): Promise<PaymentOrder> {
  return apiFetchData<PaymentOrder>(`/appointments/${id}/payment-order`, { method: 'POST' });
}

export function confirmPayment(
  id: string, payload: { order_id: string; payment_id: string; signature: string },
): Promise<Appointment> {
  return apiFetchData<Appointment>(`/appointments/${id}/payment-confirm`, {
    method: 'POST', body: payload,
  });
}

/** Sends an owed refund to the gateway. The amount is decided server-side. */
export function refundAppointment(id: string): Promise<Appointment> {
  return apiFetchData<Appointment>(`/appointments/${id}/refund`, { method: 'POST' });
}

export function markPaymentFailed(id: string): Promise<Appointment> {
  return apiFetchData<Appointment>(`/appointments/${id}/payment-failed`, { method: 'POST' });
}
