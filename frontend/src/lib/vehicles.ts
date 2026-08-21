/** Vehicle endpoints. Typed wrappers over `api.ts`. */
import { apiFetchData } from './api';
import type { VehicleType } from './mechanic';

export interface Vehicle {
  id: string;
  user_id: string;
  vehicle_type: VehicleType;
  brand: string;
  model: string;
  fuel_type: string;
  registration_number?: string | null;
  nickname?: string | null;
  is_default: boolean;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const result = await apiFetchData<{ vehicles: Vehicle[] }>('/vehicles/');
  return result.vehicles;
}
