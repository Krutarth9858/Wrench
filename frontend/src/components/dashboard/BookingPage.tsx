import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { createBooking, type Booking } from '../../lib/booking';
import { getMechanic, type MechanicSummary } from '../../lib/discovery';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import { clearDraft, loadDraft, type BookingDraft } from '../../lib/bookingDraft';
import BookingStatusBadge from './BookingStatusBadge';

const FIELD =
  'w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 transition-all';
const LABEL = 'text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500';
const VEHICLE_ICONS: Record<VehicleType, string> = { BIKE: '🛵', CAR: '🚗' };

/**
 * Dedicated service-confirmation screen at /dashboard/booking/:mechanicId.
 *
 * Renders on its own — no discovery sidebar, no map. The mechanic comes from the
 * URL and is always re-fetched from the API, so a refresh cannot leave it
 * undefined; the rest of the draft is restored from sessionStorage.
 */
export default function BookingPage() {
  const { mechanicId = '' } = useParams();
  const navigate = useNavigate();
  const routerDraft = (useLocation().state as { draft?: BookingDraft } | null)?.draft;

  const [mechanic, setMechanic] = useState<MechanicSummary | null>(null);
  const [draft] = useState<BookingDraft | null>(() => routerDraft ?? loadDraft(mechanicId));
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(draft?.vehicleType ?? null);
  const [problem, setProblem] = useState(draft?.problem ?? '');
  const [address, setAddress] = useState(draft?.address ?? '');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getMechanic(mechanicId)
      .then((m) => active && setMechanic(m))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [mechanicId]);

  const hasLocation = typeof draft?.latitude === 'number' && typeof draft?.longitude === 'number';
  const canConfirm = !!mechanic && !!vehicleType && problem.trim().length >= 5 && hasLocation;

  const confirm = async () => {
    if (!mechanic || !vehicleType || !draft) return;
    setSubmitting(true);
    setError('');
    try {
      const created = await createBooking({
        mechanic_profile_id: mechanic.id,
        vehicle_type: vehicleType,
        problem_description: problem,
        service_latitude: draft.latitude,
        service_longitude: draft.longitude,
        service_address: address || null,
      });
      clearDraft();
      setBooking(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create this booking.');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Full-page shell. This screen is routed outside the dashboard layout, so no
   * account sidebar, marketing navbar or discovery map renders beside the form.
   */
  const shell = (children: React.ReactNode) => (
    <div
      data-testid="booking-page"
      className="min-h-screen bg-[#0A0A0B] text-white font-sans selection:bg-emerald-500/30"
    >
      {/* Grid backdrop matching the rest of the product */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Wrench.</span>
          <button
            type="button"
            onClick={() => navigate('/dashboard/find')}
            data-testid="back-to-discovery"
            className="h-9 px-4 rounded-full border border-white/10 text-zinc-300 text-sm hover:text-white hover:border-white/25 transition-colors"
          >
            Back
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10">{children}</main>
    </div>
  );

  if (loading) {
    return shell(
      <p data-testid="booking-page-loading" className="text-zinc-500 text-sm">
        Loading mechanic…
      </p>,
    );
  }

  if (!mechanic) {
    return shell(
      <div data-testid="mechanic-missing">
        <h1 className="text-xl font-semibold text-white tracking-tight">Mechanic unavailable</h1>
        <p className="text-zinc-400 text-sm mt-2">
          {error || 'We could not load that mechanic. Search again to pick another.'}
        </p>
      </div>,
    );
  }

  if (booking) {
    return shell(
      <div data-testid="booking-confirmation" className="space-y-5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
          Booking requested
        </span>
        <h1 className="text-2xl font-semibold text-white tracking-tight">
          {booking.mechanic.name}
        </h1>
        <BookingStatusBadge status={booking.status} />
        <dl className="space-y-3 text-sm">
          {[
            ['Booking ID', booking.id],
            ['Vehicle', VEHICLE_TYPE_LABELS[booking.vehicle_type]],
            ['Problem', booking.problem_description],
          ].map(([k, v]) => (
            <div key={k as string} className="flex gap-3">
              <dt className="w-24 shrink-0 text-zinc-500">{k}</dt>
              <dd className="text-zinc-200 break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate('/dashboard/bookings')}
            data-testid="view-bookings"
            className="h-11 px-6 rounded-2xl bg-emerald-500 text-zinc-950 font-semibold">
            View my bookings
          </button>
          <button type="button" onClick={() => navigate('/dashboard/find')}
            className="h-11 px-6 rounded-2xl border border-white/10 text-zinc-300 hover:text-white">
            Book another
          </button>
        </div>
      </div>,
    );
  }

  return shell(
    <div className="space-y-8">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
          Roadside assistance
        </span>
        <h1 className="text-3xl font-semibold text-white tracking-tight mt-2">
          Book your service
        </h1>
      </div>

      {error && (
        <div data-testid="booking-error" role="alert"
          className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Vehicle type */}
      <div className="space-y-3">
        <span className={LABEL}>Vehicle type</span>
        <div className="grid grid-cols-2 gap-3 max-w-md">
          {(['BIKE', 'CAR'] as VehicleType[]).map((type) => {
            const serviced = mechanic.supported_vehicle_types.includes(type);
            return (
              <button key={type} type="button" disabled={!serviced}
                onClick={() => setVehicleType(type)} aria-pressed={vehicleType === type}
                data-testid={`vehicle-${type}`}
                title={serviced ? undefined : 'This mechanic does not service this type'}
                className={`h-20 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-colors disabled:opacity-30 ${
                  vehicleType === type
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                }`}>
                <span className="text-2xl">{VEHICLE_ICONS[type]}</span>
                <span className="text-sm font-medium">{VEHICLE_TYPE_LABELS[type]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Problem */}
      <div className="space-y-3">
        <span className={LABEL}>What&apos;s wrong?</span>
        <textarea name="problem_description" rows={4} value={problem} minLength={5}
          onChange={(e) => setProblem(e.target.value)} data-testid="problem-input"
          placeholder="Describe your problem…" className={FIELD} />
      </div>

      {/* Service location */}
      <div className="space-y-3">
        <span className={LABEL}>Service location</span>
        {hasLocation ? (
          <>
            <p data-testid="service-location" className="text-zinc-300 text-sm">
              📍 {draft!.latitude.toFixed(4)}, {draft!.longitude.toFixed(4)}
            </p>
            <input value={address} onChange={(e) => setAddress(e.target.value)}
              name="service_address" data-testid="address-input"
              placeholder="Landmark (optional)" className={FIELD} />
          </>
        ) : (
          <div data-testid="location-missing"
            className="p-4 rounded-2xl border border-white/10 bg-white/5 text-zinc-400 text-sm">
            We no longer have your location. Go back and search again so we can send a
            mechanic to the right place.
          </div>
        )}
      </div>

      {/* Selected mechanic */}
      <div className="space-y-3">
        <span className={LABEL}>Selected mechanic</span>
        <div data-testid="selected-mechanic"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-white font-medium">{mechanic.garage_name}</h2>
          <p className="text-zinc-500 text-sm font-light mt-1">
            {mechanic.specialization} · {mechanic.city}
          </p>
          <p className="text-zinc-400 text-sm mt-2">
            {mechanic.total_reviews > 0 && `★ ${mechanic.average_rating.toFixed(1)} · `}
            {typeof draft?.distanceKm === 'number' && `${draft.distanceKm} km away · `}
            {mechanic.supported_vehicle_types.map((t) => VEHICLE_TYPE_LABELS[t]).join(', ')}
            {' · '}
            <span className={mechanic.is_available ? 'text-emerald-400' : 'text-zinc-500'}>
              {mechanic.is_available ? 'Available' : 'Unavailable'}
            </span>
          </p>
        </div>
      </div>

      <button type="button" onClick={confirm} disabled={!canConfirm || submitting}
        data-testid="confirm-service"
        className="h-12 w-full rounded-2xl bg-emerald-500 text-zinc-950 font-semibold disabled:opacity-40">
        {submitting ? 'Requesting…' : 'Confirm service'}
      </button>
    </div>,
  );
}
