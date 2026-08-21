import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { createBooking, type Booking } from '../../lib/booking';
import type { NearbyMechanic } from '../../lib/discovery';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';

const FIELD =
  'w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500';

interface Props {
  mechanic: NearbyMechanic;
  /** Where the vehicle is — carried over from discovery. */
  location: { latitude: number; longitude: number };
  /** The type the customer searched with, pre-selected here. */
  vehicleType: VehicleType;
  onCancel: () => void;
  onBooked: (booking: Booking) => void;
}

export default function BookService({
  mechanic, location, vehicleType, onCancel, onBooked,
}: Props) {
  // Only types this mechanic actually services can be chosen. The backend
  // re-checks this; the UI just avoids offering a doomed option.
  const options = mechanic.supported_vehicle_types;
  const [selectedType, setSelectedType] = useState<VehicleType>(
    options.includes(vehicleType) ? vehicleType : options[0],
  );
  const [problem, setProblem] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      onBooked(
        await createBooking({
          mechanic_profile_id: mechanic.id,
          vehicle_type: selectedType,
          problem_description: problem,
          service_latitude: location.latitude,
          service_longitude: location.longitude,
          service_address: address || null,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not request this booking. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      data-testid="book-service"
      className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5"
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
        Request service
      </span>
      <h2 className="text-2xl font-semibold text-white tracking-tight">{mechanic.garage_name}</h2>
      <p className="text-zinc-400 text-sm mt-1 mb-8">
        {mechanic.specialization} · {mechanic.city} · {mechanic.distance_km} km away
      </p>

      {error && (
        <div
          data-testid="booking-error"
          role="alert"
          className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm"
        >
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-2">
          <span className={LABEL}>Vehicle type</span>
          <div className="grid grid-cols-2 gap-3 max-w-md">
            {options.map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={selectedType === type}
                data-testid={`booking-vehicle-${type}`}
                onClick={() => setSelectedType(type)}
                className={`h-11 rounded-2xl border text-sm font-medium transition-colors ${
                  selectedType === type
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                }`}
              >
                {VEHICLE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        <label className="space-y-2 block">
          <span className={LABEL}>What is wrong?</span>
          <textarea
            name="problem_description"
            required
            minLength={5}
            rows={4}
            value={problem}
            onChange={(e) => setProblem(e.target.value)}
            placeholder="Engine will not start after driving through water"
            className={FIELD}
          />
        </label>

        <label className="space-y-2 block">
          <span className={LABEL}>Landmark / address (optional)</span>
          <input
            name="service_address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Near the flyover, Ring Road"
            className={FIELD}
          />
        </label>

        <p className="text-zinc-600 text-xs">
          Sending your location: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
        </p>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            data-testid="confirm-booking"
            className="h-12 px-8 rounded-2xl bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50"
          >
            {submitting ? 'Requesting…' : 'Confirm booking'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            data-testid="cancel-booking-form"
            className="h-12 px-6 rounded-2xl border border-white/10 text-zinc-300 hover:text-white"
          >
            Back
          </button>
        </div>
      </form>
    </div>
  );
}
