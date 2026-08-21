import { useState } from 'react';
import {
  findNearbyMechanics,
  getCurrentPosition,
  type Coordinates,
  type NearbyMechanic,
} from '../../lib/discovery';
import { VEHICLE_TYPES, VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import BookService from './BookService';
import BookingStatusBadge from './BookingStatusBadge';
import type { Booking } from '../../lib/booking';

type Phase = 'idle' | 'locating' | 'searching' | 'done';

export default function FindMechanics() {
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR');
  const [phase, setPhase] = useState<Phase>('idle');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [results, setResults] = useState<NearbyMechanic[]>([]);
  const [selected, setSelected] = useState<NearbyMechanic | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');

  const search = async () => {
    setError('');
    setSelected(null);
    setBooking(null);
    setResults([]);
    try {
      setPhase('locating');
      const position = await getCurrentPosition();
      setCoords(position);

      setPhase('searching');
      setResults(await findNearbyMechanics(position, vehicleType));
      setPhase('done');
    } catch (err) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    }
  };

  const busy = phase === 'locating' || phase === 'searching';

  if (booking) {
    return (
      <div
        data-testid="booking-confirmation"
        className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5"
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          Booking requested
        </span>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white tracking-tight">
              {booking.mechanic.name}
            </h2>
            <p className="text-zinc-400 text-sm mt-1">
              {VEHICLE_TYPE_LABELS[booking.vehicle_type]} · {booking.problem_description}
            </p>
            <p className="text-zinc-600 text-xs mt-2">
              {booking.service_address ||
                `${booking.service_latitude}, ${booking.service_longitude}`}
            </p>
          </div>
          <BookingStatusBadge status={booking.status} />
        </div>
        <p className="text-zinc-500 text-sm mt-6">
          Track this request under <strong className="text-zinc-300">My Bookings</strong>.
        </p>
        <button
          type="button"
          onClick={() => { setBooking(null); setSelected(null); }}
          data-testid="book-another"
          className="mt-6 h-11 px-6 rounded-2xl border border-white/10 text-zinc-300 hover:text-white"
        >
          Find another mechanic
        </button>
      </div>
    );
  }

  if (selected && coords) {
    return (
      <BookService
        mechanic={selected}
        location={coords}
        vehicleType={vehicleType}
        onCancel={() => setSelected(null)}
        onBooked={setBooking}
      />
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
        Roadside Assistance
      </span>
      <h2 className="text-2xl font-semibold text-white tracking-tight">Find mechanics near you</h2>
      <p className="text-zinc-400 text-sm mt-1 mb-8">
        We use your current location to find available mechanics whose service area covers you.
      </p>

      <div className="space-y-2 mb-6">
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">
          Vehicle type
        </span>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {VEHICLE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              aria-pressed={vehicleType === type}
              data-testid={`find-vehicle-${type}`}
              onClick={() => setVehicleType(type)}
              className={`h-11 rounded-2xl border text-sm font-medium transition-colors ${
                vehicleType === type
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
              }`}
            >
              {VEHICLE_TYPE_LABELS[type]}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={search}
        disabled={busy}
        data-testid="find-mechanics"
        className="h-12 px-8 rounded-2xl bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-50 transition-opacity"
      >
        {phase === 'locating'
          ? 'Getting your location…'
          : phase === 'searching'
            ? 'Searching…'
            : 'Find mechanics'}
      </button>

      {busy && (
        <p data-testid="discovery-loading" className="text-zinc-500 text-sm mt-4">
          {phase === 'locating' ? 'Waiting for location permission…' : 'Looking for mechanics…'}
        </p>
      )}

      {error && (
        <div
          data-testid="discovery-error"
          role="alert"
          className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm"
        >
          {error}
        </div>
      )}

      {phase === 'done' && coords && (
        <p className="text-zinc-600 text-xs mt-6">
          Searching from {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
        </p>
      )}

      {phase === 'done' && results.length === 0 && !error && (
        <div
          data-testid="discovery-empty"
          className="mt-4 p-6 rounded-2xl border border-white/10 bg-white/5 text-zinc-400 text-sm"
        >
          No available mechanics cover your location for this vehicle type yet. Try the other
          vehicle type, or check again shortly.
        </div>
      )}

      {results.length > 0 && (
        <ul data-testid="discovery-results" className="mt-6 space-y-3">
          {results.map((mechanic) => {
            const isSelected = selected?.id === mechanic.id;
            return (
              <li key={mechanic.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  data-testid={`mechanic-${mechanic.id}`}
                  onClick={() => setSelected(mechanic)}
                  className={`w-full text-left rounded-2xl border p-5 transition-colors ${
                    isSelected
                      ? 'bg-emerald-500/10 border-emerald-500/40'
                      : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-white font-medium">{mechanic.garage_name}</h3>
                      <p className="text-zinc-500 text-sm font-light">
                        {mechanic.specialization} · {mechanic.city} ·{' '}
                        {mechanic.experience_years} yrs
                      </p>
                      <p className="text-zinc-600 text-xs mt-1">
                        Covers {mechanic.supported_vehicle_types
                          .map((t) => VEHICLE_TYPE_LABELS[t])
                          .join(', ')}
                      </p>
                    </div>
                    <span
                      data-testid={`distance-${mechanic.id}`}
                      className="shrink-0 text-emerald-300 font-semibold"
                    >
                      {mechanic.distance_km} km
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

    </div>
  );
}
