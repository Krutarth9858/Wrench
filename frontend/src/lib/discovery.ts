/** Mechanic discovery endpoints (RAD FR-02). Typed wrappers over `api.ts`. */
import { apiFetchData } from './api';
import type { VehicleType } from './mechanic';

export interface NearbyMechanic {
  id: string;
  garage_name: string;
  specialization: string;
  city: string;
  latitude: number;
  longitude: number;
  distance_km: number;
  supported_vehicle_types: VehicleType[];
  is_available: boolean;
  service_radius_km: number;
  experience_years: number;
  average_rating: number;
  total_reviews: number;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export async function findNearbyMechanics(
  { latitude, longitude }: Coordinates,
  vehicleType: VehicleType,
): Promise<NearbyMechanic[]> {
  const query = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    vehicle_type: vehicleType,
  });
  const result = await apiFetchData<{ mechanics: NearbyMechanic[] }>(
    `/mechanics/nearby?${query.toString()}`,
  );
  return result.mechanics;
}

/** Wraps the callback-based Geolocation API and maps its errors to messages. */
export function getCurrentPosition(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser does not support location services.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
      (error) => {
        const messages: Record<number, string> = {
          1: 'Location permission denied. Allow location access to find mechanics near you.',
          2: 'Your location is unavailable right now. Check your device settings and try again.',
          3: 'Timed out while getting your location. Try again.',
        };
        reject(new Error(messages[error.code] ?? 'Could not determine your location.'));
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
