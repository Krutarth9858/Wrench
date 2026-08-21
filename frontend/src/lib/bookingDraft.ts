/**
 * The in-progress booking carried from discovery to the booking page.
 *
 * Router state covers the normal click-through. This mirror in `sessionStorage`
 * exists so a refresh on the booking page does not lose what the customer already
 * chose; the mechanic itself is always re-fetched from the API, never restored
 * from here.
 */
import type { VehicleType } from './mechanic';

export interface BookingDraft {
  mechanicId: string;
  vehicleType: VehicleType;
  problem: string;
  latitude: number;
  longitude: number;
  address: string;
  /** Distance is relative to the search origin, so it only exists post-search. */
  distanceKm?: number;
}

const KEY = 'wrench.booking-draft';

export function saveDraft(draft: BookingDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    /* storage unavailable (private mode); router state still carries the draft */
  }
}

export function loadDraft(mechanicId: string): BookingDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as BookingDraft;
    // Only accept a draft that belongs to the mechanic in the URL.
    return draft?.mechanicId === mechanicId ? draft : null;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
