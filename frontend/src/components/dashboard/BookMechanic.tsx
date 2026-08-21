import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { saveDraft } from '../../lib/bookingDraft';
import {
  findNearbyMechanics,
  getCurrentPosition,
  type Coordinates,
  type NearbyMechanic,
} from '../../lib/discovery';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import MechanicMap from './MechanicMap';

/** Shortcuts that prefill the description. Plain text — no AI, no backend field. */
const PROBLEM_PRESETS = [
  { label: 'Battery', text: 'Battery appears dead — the vehicle will not start.' },
  { label: 'Tyre', text: 'Flat or damaged tyre.' },
  { label: 'Engine', text: 'Engine trouble — it will not start or is running badly.' },
  { label: 'Fuel', text: 'Out of fuel.' },
  { label: 'Electrical', text: 'Electrical fault — lights or wiring problem.' },
  { label: 'Other', text: '' },
];

const VEHICLE_ICONS: Record<VehicleType, string> = { BIKE: '🛵', CAR: '🚗' };

type Phase = 'locating' | 'searching' | 'idle';

const SECTION = 'border-t border-white/5 pt-6 mt-6';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500';
const FIELD =
  'w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all';

export default function BookMechanic() {
  const navigate = useNavigate();
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [problem, setProblem] = useState('');
  const [address, setAddress] = useState('');
  const [results, setResults] = useState<NearbyMechanic[]>([]);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState('');

  const canSearch = !!coords && !!vehicleType && problem.trim().length >= 5;
  const busy = phase !== 'idle';

  const locate = async () => {
    setError('');
    setPhase('locating');
    try {
      setCoords(await getCurrentPosition());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not determine your location.');
    } finally {
      setPhase('idle');
    }
  };

  const search = async () => {
    if (!coords || !vehicleType) return;
    setError('');
    setPhase('searching');
    setSelectedId(null);
    setResults([]);
    try {
      // Backend decides eligibility: availability, vehicle type, radius, distance.
      setResults(await findNearbyMechanics(coords, vehicleType));
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search for mechanics.');
    } finally {
      setPhase('idle');
    }
  };

  /** Hand off to the dedicated booking page. No booking is created here. */
  const bookMechanic = (mechanic: NearbyMechanic) => {
    if (!coords || !vehicleType) return;
    const draft = {
      mechanicId: mechanic.id,
      vehicleType,
      problem,
      latitude: coords.latitude,
      longitude: coords.longitude,
      address,
      distanceKm: mechanic.distance_km,
    };
    // Router state covers the click-through; the mirror survives a refresh.
    saveDraft(draft);
    navigate(`/booking/${mechanic.id}`, { state: { draft } });
  };

  /* ------------------------------------------------------------------ panel */

  const panel = (
    <div className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
        Roadside assistance
      </span>
      <h2 className="text-2xl font-semibold text-white tracking-tight">Book a mechanic</h2>

      {/* 1 — location */}
      <div className={SECTION}>
        <p className="text-white font-medium mb-1">Where do you need help?</p>
        <p className="text-zinc-500 text-sm font-light mb-4">
          We use your live position to find mechanics whose service area covers you.
        </p>
        <button type="button" onClick={locate} disabled={busy} data-testid="use-location"
          className="h-11 px-5 rounded-2xl bg-white/[0.06] border border-white/10 text-white text-sm font-medium disabled:opacity-50 hover:border-white/25">
          {phase === 'locating' ? 'Getting your location…' : coords ? 'Update location' : '📍 Use my current location'}
        </button>
        {coords && (
          <>
            <p data-testid="coords" className="text-emerald-400/80 text-xs mt-3">
              Located at {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
            </p>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              name="service_address" data-testid="address-input" placeholder="Landmark (optional)"
              className={`${FIELD} mt-3`} />
          </>
        )}
      </div>

      {/* 2 — vehicle type */}
      {coords && (
        <div className={SECTION} data-testid="step-vehicle">
          <p className="text-white font-medium mb-4">What are you driving?</p>
          <div className="grid grid-cols-2 gap-3">
            {(['BIKE', 'CAR'] as VehicleType[]).map((type) => (
              <button key={type} type="button" onClick={() => setVehicleType(type)}
                aria-pressed={vehicleType === type} data-testid={`vehicle-${type}`}
                className={`h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-colors ${
                  vehicleType === type
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                }`}>
                <span className="text-2xl">{VEHICLE_ICONS[type]}</span>
                <span className="text-sm font-medium">{VEHICLE_TYPE_LABELS[type]}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 3 — problem */}
      {coords && vehicleType && (
        <div className={SECTION} data-testid="step-problem">
          <p className="text-white font-medium mb-4">What's wrong with your vehicle?</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {PROBLEM_PRESETS.map((preset) => (
              <button key={preset.label} type="button" data-testid={`preset-${preset.label}`}
                onClick={() => setProblem(preset.text)}
                className="h-9 px-4 rounded-full border border-white/10 bg-white/[0.03] text-zinc-300 text-sm hover:border-white/25">
                {preset.label}
              </button>
            ))}
          </div>
          <textarea name="problem_description" rows={3} value={problem} minLength={5}
            onChange={(e) => setProblem(e.target.value)} data-testid="problem-input"
            placeholder="Describe the problem in a sentence or two" className={FIELD} />
        </div>
      )}

      {/* 4 — search */}
      {coords && vehicleType && (
        <div className={SECTION}>
          <button type="button" onClick={search} disabled={!canSearch || busy}
            data-testid="find-mechanics"
            className="h-12 w-full rounded-2xl bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-40">
            {phase === 'searching' ? 'Searching…' : 'Find mechanics'}
          </button>
          {!canSearch && (
            <p className="text-zinc-600 text-xs mt-2">
              Describe the problem (at least a few words) to continue.
            </p>
          )}
        </div>
      )}

      {/* 5 — results */}
      {searched && (
        <div className={SECTION} data-testid="step-results">
          {results.length === 0 ? (
            <div data-testid="results-empty"
              className="p-5 rounded-2xl border border-white/10 bg-white/5 text-zinc-400 text-sm">
              No available mechanics cover your location for this vehicle type. Try the other
              vehicle type or search again shortly.
            </div>
          ) : (
            <>
              <p className={`${LABEL} mb-3`}>{results.length} mechanic{results.length > 1 ? 's' : ''} nearby</p>
              <ul data-testid="results-list" className="space-y-3">
                {results.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setSelectedId(m.id)}
                      aria-pressed={selectedId === m.id} data-testid={`mechanic-${m.id}`}
                      className={`w-full text-left rounded-2xl border p-4 transition-colors ${
                        selectedId === m.id
                          ? 'bg-emerald-500/10 border-emerald-500/40'
                          : 'bg-white/[0.03] border-white/10 hover:border-white/25'
                      }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-white font-medium">{m.garage_name}</h3>
                          <p className="text-zinc-500 text-sm font-light">
                            {m.specialization} · {m.city}
                          </p>
                          <p className="text-zinc-600 text-xs mt-1">
                            {m.supported_vehicle_types.map((t) => VEHICLE_TYPE_LABELS[t]).join(', ')}
                            {m.total_reviews > 0 && ` · ★ ${m.average_rating.toFixed(1)}`}
                            {m.is_available && ' · Available'}
                          </p>
                        </div>
                        <span data-testid={`distance-${m.id}`} className="shrink-0 text-emerald-300 font-semibold">
                          {m.distance_km} km
                        </span>
                      </div>
                      {selectedId === m.id && (
                        <span onClick={(e) => { e.stopPropagation(); bookMechanic(m); }}
                          role="button" tabIndex={0} data-testid={`book-${m.id}`}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); bookMechanic(m); } }}
                          className="mt-3 inline-flex h-9 items-center px-4 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-semibold cursor-pointer">
                          Book Mechanic
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:h-[calc(100vh-11rem)]">
      {/* Map: first on mobile, right-hand and dominant on desktop */}
      <div className="order-1 lg:order-2 h-[45vh] min-h-[300px] lg:h-full lg:min-h-0 lg:flex-1">  {/* flex-1 only at lg: in a column flex container it sets flex-basis:0 and collapses the height */}
        <MechanicMap origin={coords} mechanics={results} selectedId={selectedId}
          onSelect={setSelectedId} />
      </div>

      <aside className="order-2 lg:order-1 w-full lg:w-[400px] shrink-0 lg:h-full lg:overflow-y-auto
        bg-[#18181B] rounded-[32px] p-6 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
        {error && (
          <div data-testid="booking-error" role="alert"
            className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}
        {panel}
      </aside>
    </div>
  );
}
