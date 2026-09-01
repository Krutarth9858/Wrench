import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, MapPin, Search, CheckCircle2, X, Heart, Star, ChevronUp, Clock, Wrench as WrenchIcon } from 'lucide-react';
import { saveDraft } from '../../lib/bookingDraft';
import {
  findNearbyMechanics,
  getCurrentPosition,
  type Coordinates,
  type NearbyMechanic,
} from '../../lib/discovery';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import MechanicMap from './MechanicMap';

/* ── Design tokens ── */
const BRAND = '#00966B';
const HEADING = '#111827';
const BODY = '#6B7280';

/** Shortcuts that prefill the description. */
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

/* ── Glass styles ── */
const GLASS_PANEL: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(28px) saturate(150%)',
  WebkitBackdropFilter: 'blur(28px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 20px 60px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.5)',
};

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(28px) saturate(150%)',
  WebkitBackdropFilter: 'blur(28px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 24px 48px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.4)',
};

const FIELD =
  'w-full bg-white/60 border border-zinc-200/60 px-4 py-3 text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#00966B]/20 focus:border-[#00966B]/40 transition-all text-sm rounded-xl';

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
      setResults(await findNearbyMechanics(coords, vehicleType));
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not search for mechanics.');
    } finally {
      setPhase('idle');
    }
  };

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
    saveDraft(draft);
    navigate(`/booking/${mechanic.id}`, { state: { draft } });
  };

  const selectedMechanic = results.find(m => m.id === selectedId);

  /* ────────────────────────────────── Booking Panel Content ── */
  const panel = (
    <div>
      {/* Header */}
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: BRAND }}>
        Roadside assistance
      </p>
      <h2 className="text-[26px] font-bold tracking-tight leading-tight mb-6" style={{ color: HEADING }}>
        Book a mechanic
      </h2>

      {/* 1 — Location */}
      <div className="mb-5">
        <p className="text-[15px] font-semibold mb-1" style={{ color: HEADING }}>Where do you need help?</p>
        <p className="text-[13px] leading-relaxed mb-4" style={{ color: BODY }}>
          Use your live location to find mechanics whose service area covers you.
        </p>
        <button type="button" onClick={locate} disabled={busy} data-testid="use-location"
          className="w-full h-12 px-5 rounded-xl bg-white/60 border border-zinc-200/60 text-sm font-medium disabled:opacity-50 hover:bg-white/90 transition-colors flex items-center justify-center gap-2.5"
          style={{ color: HEADING }}>
          <Target className="w-4 h-4" style={{ color: BODY }} />
          {phase === 'locating' ? 'Getting your location…' : coords ? 'Update location' : 'Use current location'}
        </button>
        {coords && (
          <div className="mt-3 space-y-3">
            <div className="flex items-center gap-2.5 px-1">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: BRAND }}></div>
              <p data-testid="coords" className="text-xs font-medium" style={{ color: HEADING }}>
                Ahmedabad, Gujarat <span style={{ color: BODY }}>•</span> {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}
              </p>
            </div>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: BODY }} />
              <input value={address} onChange={(e) => setAddress(e.target.value)}
                name="service_address" data-testid="address-input" placeholder="Add landmark (optional)"
                className={`${FIELD} pl-10`} />
            </div>
          </div>
        )}
      </div>

      {/* 2 — Vehicle type */}
      {coords && (
        <div className="mb-5 pt-5 border-t border-zinc-200/40" data-testid="step-vehicle">
          <p className="text-[15px] font-semibold mb-4" style={{ color: HEADING }}>What are you driving?</p>
          <div className="grid grid-cols-2 gap-3">
            {(['BIKE', 'CAR'] as VehicleType[]).map((type) => {
              const selected = vehicleType === type;
              return (
                <button key={type} type="button" onClick={() => setVehicleType(type)}
                  aria-pressed={selected} data-testid={`vehicle-${type}`}
                  className="relative h-[88px] rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all"
                  style={{
                    background: selected ? `${BRAND}08` : 'rgba(255,255,255,0.6)',
                    border: selected ? `2px solid ${BRAND}` : '2px solid #e5e7eb',
                  }}>
                  {selected && (
                    <div className="absolute top-2.5 right-2.5" style={{ color: BRAND }}>
                      <CheckCircle2 className="w-[18px] h-[18px]" style={{ fill: `${BRAND}20` }} />
                    </div>
                  )}
                  <span className="text-[28px]">{VEHICLE_ICONS[type]}</span>
                  <span className="text-xs font-semibold" style={{ color: selected ? BRAND : HEADING }}>
                    {VEHICLE_TYPE_LABELS[type]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3 — Problem */}
      {coords && vehicleType && (
        <div className="mb-5 pt-5 border-t border-zinc-200/40" data-testid="step-problem">
          <p className="text-[15px] font-semibold mb-3" style={{ color: HEADING }}>What's wrong with your vehicle?</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {PROBLEM_PRESETS.map((preset) => {
              const active = problem === preset.text;
              return (
                <button key={preset.label} type="button" data-testid={`preset-${preset.label}`}
                  onClick={() => setProblem(preset.text)}
                  className="h-9 px-4 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: active ? `${BRAND}0a` : 'rgba(255,255,255,0.6)',
                    border: active ? `1.5px solid ${BRAND}` : '1.5px solid #e5e7eb',
                    color: active ? BRAND : BODY,
                  }}>
                  {preset.label}
                </button>
              );
            })}
          </div>
          <textarea name="problem_description" rows={3} value={problem} minLength={5}
            onChange={(e) => setProblem(e.target.value)} data-testid="problem-input"
            placeholder="Describe the problem in a sentence or two" className={FIELD} />
        </div>
      )}

      {/* 4 — Search button */}
      {coords && vehicleType && (
        <div className="pt-2">
          <button type="button" onClick={search} disabled={!canSearch || busy}
            data-testid="find-mechanics"
            className="h-[52px] w-full rounded-xl text-white font-bold text-[15px] flex items-center justify-center gap-2.5 transition-all disabled:opacity-40"
            style={{
              background: BRAND,
              boxShadow: canSearch && !busy ? `0 6px 20px ${BRAND}30` : 'none',
            }}>
            <Search className="w-5 h-5" />
            {phase === 'searching' ? 'Searching…' : 'Find Mechanics'}
          </button>
          {!canSearch && (
            <p className="text-xs mt-2.5 text-center" style={{ color: BODY }}>
              Describe the problem (at least a few words) to continue.
            </p>
          )}
        </div>
      )}

      {/* 5 — Results list (scrollable within panel) */}
      {searched && (
        <div className="pt-5 mt-5 border-t border-zinc-200/40" data-testid="step-results">
          {results.length === 0 ? (
            <div data-testid="results-empty"
              className="bg-white/50 border border-zinc-200/50 rounded-xl p-4 text-sm" style={{ color: BODY }}>
              No available mechanics cover your location for this vehicle type.
            </div>
          ) : (
            <>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-3" style={{ color: BODY }}>
                {results.length} mechanic{results.length > 1 ? 's' : ''} nearby
              </p>
              <ul data-testid="results-list" className="space-y-2">
                {results.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setSelectedId(m.id)}
                      aria-pressed={selectedId === m.id} data-testid={`mechanic-${m.id}`}
                      className="w-full text-left rounded-xl p-3.5 transition-all"
                      style={{
                        background: selectedId === m.id ? `${BRAND}08` : 'rgba(255,255,255,0.5)',
                        border: selectedId === m.id ? `1.5px solid ${BRAND}40` : '1.5px solid #e5e7eb',
                      }}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-sm" style={{ color: HEADING }}>{m.garage_name}</h3>
                          <p className="text-xs mt-0.5" style={{ color: BODY }}>
                            {m.specialization} · {m.city}
                          </p>
                        </div>
                        <span data-testid={`distance-${m.id}`} className="shrink-0 font-bold text-sm" style={{ color: BRAND }}>
                          {m.distance_km} km
                        </span>
                      </div>
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
    <div className="relative w-full h-full flex flex-col lg:block">
      {/* Map — fills entire space */}
      <div className="lg:absolute lg:inset-0 relative flex-1 min-h-[300px] z-0">
        <MechanicMap origin={coords} mechanics={results} selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* ── Floating Glass Booking Panel ── */}
      <aside className="relative lg:absolute z-10 top-0 left-0 w-full lg:w-auto lg:top-[90px] lg:left-6 lg:bottom-6 pointer-events-none">
        <div
          className="pointer-events-auto p-6 lg:p-7 lg:w-[360px] xl:w-[420px] rounded-none lg:rounded-[28px] max-h-[50vh] lg:max-h-full overflow-y-auto"
          style={GLASS_PANEL}
        >
          {error && (
            <div data-testid="booking-error" role="alert"
              className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}
          {panel}
        </div>
      </aside>

      {/* ── Floating Bottom-Center Status ── */}
      {searched && (
        <div className="absolute z-20 bottom-5 left-1/2 -translate-x-1/2 pointer-events-none">
          <div
            className="flex items-center gap-2.5 px-5 py-2 rounded-full animate-in fade-in slide-in-from-bottom-4"
            style={{
              ...GLASS_CARD,
              pointerEvents: 'auto',
            }}
          >
            <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: BRAND }}></div>
            <span className="text-sm font-semibold whitespace-nowrap" style={{ color: HEADING }}>
              {results.length === 0 ? 'No mechanics nearby' : `${results.length} mechanic${results.length > 1 ? 's' : ''} nearby`}
            </span>
            <ChevronUp className="w-4 h-4" style={{ color: BODY }} />
          </div>
        </div>
      )}

      {/* ── Floating Bottom-Right Mechanic Card ── */}
      {selectedMechanic && (
        <div
          className="absolute z-20 bottom-5 left-1/2 -translate-x-1/2 w-[calc(100%-2rem)] lg:left-auto lg:right-5 lg:translate-x-0 lg:w-[400px] p-5 rounded-3xl animate-in fade-in slide-in-from-bottom-6"
          style={GLASS_CARD}
        >
          <div className="flex gap-4">
            {/* Mechanic thumbnail */}
            <div className="w-[88px] h-[88px] rounded-2xl bg-zinc-100 border border-zinc-200/60 flex-shrink-0 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-zinc-200 flex items-center justify-center">
                <WrenchIcon className="w-8 h-8 text-zinc-300" />
              </div>
              {selectedMechanic.is_available && (
                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] font-bold text-white px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ background: BRAND }}>
                  Available
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="font-bold text-[17px] leading-tight truncate" style={{ color: HEADING }}>
                  {selectedMechanic.garage_name}
                </h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button className="p-1 rounded-lg hover:bg-zinc-100 transition-colors" style={{ color: BODY }}>
                    <Heart className="w-[18px] h-[18px]" />
                  </button>
                  <button onClick={() => setSelectedId(null)} className="p-1 rounded-lg hover:bg-zinc-100 transition-colors" style={{ color: BODY }}>
                    <X className="w-[18px] h-[18px]" />
                  </button>
                </div>
              </div>

              {/* Rating — only if backend provides real data */}
              {selectedMechanic.total_reviews > 0 && (
                <div className="flex items-center gap-1 mb-1.5">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold" style={{ color: HEADING }}>
                    {selectedMechanic.average_rating.toFixed(1)}
                  </span>
                  <span className="text-sm" style={{ color: BODY }}>
                    ({selectedMechanic.total_reviews})
                  </span>
                </div>
              )}

              {/* Distance */}
              <div className="flex items-center gap-3 text-xs mb-2.5" style={{ color: BODY }}>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {selectedMechanic.distance_km} km
                </span>
              </div>

              {/* Vehicle type badges */}
              <div className="flex flex-wrap gap-1.5">
                {selectedMechanic.supported_vehicle_types.map((t) => (
                  <span key={t} className="text-[11px] font-medium px-2.5 py-1 rounded-md bg-zinc-100 border border-zinc-200/60" style={{ color: BODY }}>
                    {VEHICLE_TYPE_LABELS[t]}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 mt-4">
            <button className="flex-1 h-11 rounded-xl bg-white/70 hover:bg-white border border-zinc-200/70 font-semibold text-sm transition-colors" style={{ color: HEADING }}>
              View Details
            </button>
            <button
              onClick={() => bookMechanic(selectedMechanic)}
              data-testid={`book-${selectedMechanic.id}`}
              className="flex-[1.3] h-11 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2"
              style={{ background: BRAND, boxShadow: `0 6px 20px ${BRAND}35` }}>
              Book Mechanic <span>→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
