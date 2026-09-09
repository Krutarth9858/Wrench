import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlass, SlidersHorizontal, CrosshairSimple, X, CaretLeft } from '@phosphor-icons/react';
import { ApiError } from '../../lib/api';
import {
  findNearbyMechanics, getCurrentPosition,
  type Coordinates, type NearbyMechanic,
} from '../../lib/discovery';
import { saveDraft } from '../../lib/bookingDraft';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import MechanicMap from '../../components/dashboard/MechanicMap';
import MobileBottomSheet, { type SheetState } from '../../components/mobile/MobileBottomSheet';
import MobileMechanicCard from '../../components/mobile/MobileMechanicCard';
import MobileBottomNav from '../../components/mobile/MobileBottomNav';
import { ErrorState } from '../../components/ui/StateMessage';
import { SAFE_TOP, TAP } from '../../components/mobile/mobileTokens';

/** Height of the tab bar the sheet and recentre control must clear. */
const NAV_CLEARANCE = 62;

/**
 * Mobile discovery: the map is the screen, the list rides over it.
 *
 * Deliberately not the desktop layout — no sidebar. Controls float over the
 * map and the results live in a draggable sheet, so the map stays the primary
 * surface and everything actionable sits in thumb reach.
 *
 * Business logic is the existing shared layer: `findNearbyMechanics`,
 * `getCurrentPosition` and `saveDraft` are the same calls the desktop screen
 * makes, and the booking draft has the identical shape so `/booking/:id`
 * behaves the same from either experience.
 */
export default function MobileFindMechanic() {
  const navigate = useNavigate();
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>('CAR');
  const [problem, setProblem] = useState('');
  const [results, setResults] = useState<NearbyMechanic[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>('collapsed');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [locationDenied, setLocationDenied] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const search = useCallback(async (position: Coordinates, vehicle: VehicleType) => {
    setLoading(true);
    setError(null);
    try {
      const found = await findNearbyMechanics(position, vehicle);
      setResults(found);
      setSheet(found.length ? 'expanded' : 'collapsed');
    } catch (err) {
      setError(err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const locate = useCallback(async (vehicle: VehicleType) => {
    setLoading(true);
    setError(null);
    setLocationDenied(false);
    try {
      const position = await getCurrentPosition();
      setCoords(position);
      await search(position, vehicle);
    } catch (err) {
      setLocationDenied(true);
      setError(err instanceof ApiError ? err : null);
      setLoading(false);
    }
  }, [search]);

  // Discovery needs a position, so ask for one as soon as the screen opens
  // rather than making the customer tap twice in an emergency.
  useEffect(() => { void locate('CAR'); }, [locate]);

  const changeVehicle = (next: VehicleType) => {
    setVehicleType(next);
    setFiltersOpen(false);
    if (coords) void search(coords, next);
  };

  const request = (mechanic: NearbyMechanic) => {
    if (!coords) return;
    // Identical draft shape to the desktop flow — the booking screen is shared.
    const draft = {
      mechanicId: mechanic.id,
      vehicleType,
      problem,
      latitude: coords.latitude,
      longitude: coords.longitude,
      address: '',
      distanceKm: mechanic.distance_km,
    };
    saveDraft(draft);
    navigate(`/booking/${mechanic.id}`, { state: { draft } });
  };

  const available = results.filter((m) => m.is_available).length;

  return (
    <div data-testid="m-find" className="fixed inset-0 overflow-hidden bg-[#0A0A0B]">
      {/* The map owns the full screen; everything else floats above it. */}
      <div className="absolute inset-0 z-0">
        <MechanicMap
          origin={coords}
          mechanics={results}
          selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setSheet('expanded'); }}
        />
      </div>

      {/* Floating controls. `pointer-events-none` on the rail so the map stays
          draggable between them; each control re-enables its own taps. */}
      <div
        className="absolute left-0 right-0 z-[360] px-4 pointer-events-none"
        style={{ top: `calc(${SAFE_TOP} + 12px)` }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="Back"
            data-testid="m-find-back"
            className="shrink-0 flex items-center justify-center rounded-[16px] border border-white/12 pointer-events-auto active:bg-white/10"
            style={{
              width: TAP, height: TAP,
              background: 'rgba(12,13,14,0.9)',
              backdropFilter: 'blur(20px) saturate(160%)',
            }}
          >
            <CaretLeft weight="bold" className="w-[18px] h-[18px] text-[#F0F4F2]/80" />
          </button>
          <div
            className="flex-1 flex items-center gap-2 rounded-[16px] border border-white/12 px-3.5 pointer-events-auto"
            style={{
              minHeight: TAP,
              background: 'rgba(12,13,14,0.9)',
              backdropFilter: 'blur(20px) saturate(160%)',
              WebkitBackdropFilter: 'blur(20px) saturate(160%)',
            }}
          >
            <MagnifyingGlass weight="regular" className="w-[18px] h-[18px] text-[#F0F4F2]/45 shrink-0" />
            <input
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder="What's wrong with your vehicle?"
              aria-label="Describe the problem"
              data-testid="m-find-search"
              className="w-full bg-transparent text-[14px] text-[#F0F4F2] placeholder-[#F0F4F2]/35 outline-none py-2"
            />
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            aria-label="Filters"
            aria-expanded={filtersOpen}
            data-testid="m-find-filter"
            className="shrink-0 flex items-center justify-center rounded-[16px] border border-white/12 pointer-events-auto active:bg-white/10"
            style={{
              width: TAP, height: TAP,
              background: 'rgba(12,13,14,0.9)',
              backdropFilter: 'blur(20px) saturate(160%)',
            }}
          >
            <SlidersHorizontal weight="regular" className="w-[18px] h-[18px] text-[#F0F4F2]/75" />
          </button>
        </div>

        {filtersOpen && (
          <div
            data-testid="m-find-filters"
            className="mt-2 rounded-[18px] border border-white/12 p-3 pointer-events-auto"
            style={{ background: 'rgba(12,13,14,0.94)', backdropFilter: 'blur(24px)' }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0F4F2]/45">
                Vehicle type
              </span>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters"
                className="text-[#F0F4F2]/45 active:text-[#F0F4F2]">
                <X weight="bold" className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['BIKE', 'CAR'] as VehicleType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => changeVehicle(type)}
                  data-testid={`m-find-vehicle-${type}`}
                  aria-pressed={vehicleType === type}
                  className={`rounded-[14px] border text-[14px] font-medium transition-colors ${
                    vehicleType === type
                      ? 'border-[#3ECF8E]/60 bg-[#3ECF8E]/12 text-[#3ECF8E]'
                      : 'border-white/10 bg-white/[0.04] text-[#F0F4F2]/70'
                  }`}
                  style={{ minHeight: TAP }}
                >
                  {type === 'BIKE' ? '🛵' : '🚗'} {VEHICLE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recentre — a map control, so it is hidden while the sheet covers the
          map. Leaving it visible put it on top of a card's action button. */}
      <button
        type="button"
        hidden={sheet === 'expanded'}
        onClick={() => void locate(vehicleType)}
        aria-label="Use my current location"
        data-testid="m-find-locate"
        className={`absolute right-4 z-[355] items-center justify-center rounded-full border border-white/12 active:bg-white/10 ${
          sheet === 'expanded' ? 'hidden' : 'flex'}`}
        style={{
          bottom: 168 + NAV_CLEARANCE, width: TAP, height: TAP,
          background: 'rgba(12,13,14,0.9)',
          backdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        <CrosshairSimple weight="regular" className="w-[19px] h-[19px] text-[#F0F4F2]/80" />
      </button>

      <MobileBottomSheet
        bottomInset={NAV_CLEARANCE}
        state={sheet}
        onStateChange={setSheet}
        peek={
          <div className="px-4 pb-3">
            <p className="m-0 font-semibold text-[16px] tracking-[-0.01em]">
              {loading ? 'Finding mechanics…'
                : results.length ? `${results.length} nearby`
                : locationDenied ? 'Location needed'
                : 'No mechanics nearby'}
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] text-[#F0F4F2]/45">
              {loading ? 'Searching your area'
                : results.length ? `${available} available now · ${VEHICLE_TYPE_LABELS[vehicleType]}`
                : locationDenied ? 'Allow location to find help near you'
                : 'Try a different vehicle type'}
            </p>
          </div>
        }
      >
        {error ? (
          <ErrorState error={error} onRetry={() => void locate(vehicleType)} testId="m-find-error" />
        ) : locationDenied ? (
          <div data-testid="m-find-location-denied"
            className="rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
            <p className="m-0 font-medium text-[15px]">Location is switched off</p>
            <p className="m-0 mt-1 text-[13px] text-[#F0F4F2]/55">
              Wrench matches you with mechanics whose service area covers where you
              are, so it needs your location to find anyone.
            </p>
            <button type="button" onClick={() => void locate(vehicleType)}
              className="mt-4 w-full rounded-[14px] bg-[#3ECF8E] text-[#052018] font-semibold text-[14px]"
              style={{ minHeight: TAP }}>
              Allow location
            </button>
          </div>
        ) : loading ? (
          <p data-testid="m-find-loading" className="text-[13px] text-[#F0F4F2]/45 py-6 text-center">
            Looking for mechanics near you…
          </p>
        ) : results.length === 0 ? (
          <div data-testid="m-find-empty"
            className="rounded-[18px] border border-white/10 bg-white/[0.04] p-5">
            <p className="m-0 font-medium text-[15px]">No mechanics nearby</p>
            <p className="m-0 mt-1 text-[13px] text-[#F0F4F2]/55">
              No garage covering your area services{' '}
              {VEHICLE_TYPE_LABELS[vehicleType].toLowerCase()}s right now. Try the
              other vehicle type, or check again shortly.
            </p>
          </div>
        ) : (
          <ul className="space-y-3 pt-1">
            {results.map((mechanic) => (
              <li key={mechanic.id}>
                <MobileMechanicCard
                  mechanic={mechanic}
                  selected={selectedId === mechanic.id}
                  onSelect={() => setSelectedId(mechanic.id)}
                  onRequest={() => request(mechanic)}
                />
              </li>
            ))}
          </ul>
        )}
      </MobileBottomSheet>

      <MobileBottomNav isMechanic={false} />
    </div>
  );
}
