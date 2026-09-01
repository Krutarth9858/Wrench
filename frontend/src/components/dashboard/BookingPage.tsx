import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Target, CheckCircle2, ArrowLeft, Clock, MapPin, Loader2, Star, Wrench as WrenchIcon, X } from 'lucide-react';
import { ApiError, apiFetchData } from '../../lib/api';
import {
  actOnBooking,
  createBooking,
  CANCELLABLE_STATUSES,
  isEndedEarly,
  type Booking,
  type BookingStatus,
} from '../../lib/booking';
import { getMechanic, type MechanicSummary } from '../../lib/discovery';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import { clearDraft, loadDraft, type BookingDraft } from '../../lib/bookingDraft';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import MechanicMap from './MechanicMap';
import { FloatingNavbar } from '../ui/FloatingNavbar';

/* ── Design tokens ── */
const BRAND = '#00966B';
const HEADING = '#111827';
const BODY = '#6B7280';

const GLASS_PANEL: React.CSSProperties = {
  background: 'rgba(255,255,255,0.72)',
  backdropFilter: 'blur(28px) saturate(150%)',
  WebkitBackdropFilter: 'blur(28px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.65)',
  boxShadow: '0 20px 60px rgba(15,23,42,0.12), inset 0 1px 0 rgba(255,255,255,0.5)',
};

const GLASS_CARD: React.CSSProperties = {
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(28px) saturate(150%)',
  WebkitBackdropFilter: 'blur(28px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.75)',
  boxShadow: '0 24px 48px rgba(15,23,42,0.14), inset 0 1px 0 rgba(255,255,255,0.4)',
};

const FIELD =
  'w-full bg-white/60 border border-zinc-200/60 px-4 py-3 text-[#111827] placeholder-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#00966B]/20 focus:border-[#00966B]/40 transition-all text-sm rounded-xl';

const DANGER = '#DC2626';

/**
 * A booking can end before the service happens. The progress timeline cannot
 * express that — `indexOf` returns -1 for these, which previously left every
 * step greyed out and the customer waiting on a request that was already dead.
 */
const ENDED_EARLY: Record<'REJECTED' | 'CANCELLED', {
  step: string; heading: string; detail: string; cta: string; to: string;
}> = {
  REJECTED: {
    step: 'Declined',
    heading: 'Booking declined',
    detail: "That mechanic isn't available for this request.",
    cta: 'Find Another Mechanic',
    to: '/dashboard/find',
  },
  CANCELLED: {
    step: 'Cancelled',
    heading: 'Booking cancelled',
    detail: 'You cancelled this request. No mechanic was dispatched.',
    cta: 'Book Another Service',
    to: '/dashboard/find',
  },
};

const PROGRESS_STEPS: { id: BookingStatus; title: string; desc: string }[] = [
  { id: 'PENDING', title: 'Request Sent', desc: 'Waiting for mechanic to accept your request.' },
  { id: 'ACCEPTED', title: 'Accepted', desc: 'Mechanic is on their way.' },
  { id: 'IN_PROGRESS', title: 'In Progress', desc: 'Your service is now in progress.' },
  { id: 'COMPLETED', title: 'Completed', desc: 'Service completed successfully.' },
];

const VEHICLE_ICONS: Record<VehicleType, string> = { BIKE: '🛵', CAR: '🚗' };

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
  const [cancelling, setCancelling] = useState(false);
  const [, setConnectionStatus] = useState<string>('connecting');

  // Load mechanic details
  useEffect(() => {
    let active = true;
    getMechanic(mechanicId)
      .then((m) => active && setMechanic(m))
      .catch((err: Error) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [mechanicId]);

  // Load existing booking if we got redirected here somehow with an active booking (REST sync)
  const refreshBooking = useCallback(async () => {
    if (!booking) return;
    try {
      const data = await apiFetchData<Booking>(`/bookings/${booking.id}`);
      setBooking(data);
    } catch (e) {
      console.error('Failed to refresh booking', e);
    }
  }, [booking]);

  // WebSocket realtime updates
  useBookingRealtime('customer', () => {
    void refreshBooking();
  }, setConnectionStatus);

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

  /** Uses the same intent endpoint as My Bookings; the server owns the transition. */
  const cancelBooking = async () => {
    if (!booking) return;
    setCancelling(true);
    setError('');
    try {
      setBooking(await actOnBooking(booking.id, 'cancel'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not cancel this booking.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div data-testid="booking-page-loading" className="h-screen flex items-center justify-center" style={{ background: 'linear-gradient(180deg, #EBF3FC, #F5F9FD)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: BRAND }} />
      </div>
    );
  }

  if (!mechanic) {
    return (
      <div data-testid="mechanic-missing" className="h-screen flex flex-col items-center justify-center gap-4" style={{ background: 'linear-gradient(180deg, #EBF3FC, #F5F9FD)' }}>
        <h1 className="text-2xl font-bold" style={{ color: HEADING }}>Mechanic unavailable</h1>
        <p style={{ color: BODY }}>{error || 'We could not load that mechanic.'}</p>
        <button onClick={() => navigate('/dashboard/find')} className="px-6 py-2 rounded-xl text-white font-medium" style={{ background: BRAND }}>
          Return to search
        </button>
      </div>
    );
  }

  // Pre-fill a nearby mechanic struct for the map
  const mapMechanic = {
    ...mechanic,
    distance_km: draft?.distanceKm || 0,
  };

  return (
    <div data-testid="booking-page" className="h-screen overflow-hidden font-sans selection:bg-[#00966B]/30 relative flex" style={{ background: 'linear-gradient(180deg, #EBF3FC, #F5F9FD)' }}>
      <FloatingNavbar />

      {/* ── Left Column: Booking Details ── */}
      <div className="w-full lg:w-[480px] h-full flex flex-col relative z-20 pt-[88px] pb-6 px-6 pointer-events-none">
        <div className="w-full h-full rounded-[28px] p-8 overflow-y-auto pointer-events-auto flex flex-col" style={GLASS_PANEL}>
          
          <button data-testid="back-to-discovery" onClick={() => navigate('/dashboard/find')} className="flex items-center gap-1.5 text-xs font-semibold mb-6 w-max hover:opacity-70 transition-opacity" style={{ color: BODY }}>
            <ArrowLeft className="w-4 h-4" /> Back to map
          </button>

          {!booking ? (
            <>
              {/* Creation Form */}
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: BRAND }}>
                Roadside assistance
              </p>
              <h1 className="text-[28px] font-bold tracking-tight leading-tight mb-2" style={{ color: HEADING }}>
                Book your service
              </h1>
              <p className="text-[14px] leading-relaxed mb-8" style={{ color: BODY }}>
                Review your service details before confirming your request.
              </p>

              {error && (
                <div data-testid="booking-error" className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* 1. Vehicle Type */}
              <div className="mb-6">
                <p className="text-[14px] font-semibold mb-3" style={{ color: HEADING }}>Vehicle Type</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['BIKE', 'CAR'] as VehicleType[]).map((type) => {
                    const serviced = mechanic.supported_vehicle_types.includes(type);
                    const selected = vehicleType === type;
                    return (
                      <button key={type} type="button" disabled={!serviced} onClick={() => setVehicleType(type)} data-testid={`vehicle-${type}`} aria-pressed={selected}
                        className="relative h-20 rounded-2xl flex flex-col items-center justify-center gap-1.5 transition-all disabled:opacity-40"
                        style={{
                          background: selected ? `${BRAND}10` : 'rgba(255,255,255,0.6)',
                          border: selected ? `2px solid ${BRAND}` : '2px solid #e5e7eb',
                        }}>
                        {selected && (
                          <div className="absolute top-2 right-2" style={{ color: BRAND }}>
                            <CheckCircle2 className="w-4 h-4" style={{ fill: `${BRAND}20` }} />
                          </div>
                        )}
                        <span className="text-[24px]">{VEHICLE_ICONS[type]}</span>
                        <span className="text-xs font-semibold" style={{ color: selected ? BRAND : HEADING }}>
                          {VEHICLE_TYPE_LABELS[type]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. What's wrong? */}
              <div className="mb-6">
                <p className="text-[14px] font-semibold mb-3" style={{ color: HEADING }}>What's wrong?</p>
                <textarea rows={3} value={problem} onChange={(e) => setProblem(e.target.value)} data-testid="problem-input"
                  placeholder="Describe your problem..." className={FIELD} />
              </div>

              {/* 3. Service Location */}
              <div className="mb-8">
                <p className="text-[14px] font-semibold mb-3" style={{ color: HEADING }}>Service Location</p>
                {hasLocation ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3.5 bg-white/60 border border-zinc-200/60 rounded-xl">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: `${BRAND}15`, color: BRAND }}>
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="text-sm">
                        <p className="font-semibold" style={{ color: HEADING }}>Current Location</p>
                        <p data-testid="service-location" className="text-xs" style={{ color: BODY }}>{draft!.latitude.toFixed(4)}, {draft!.longitude.toFixed(4)}</p>
                      </div>
                    </div>
                    <input value={address} onChange={(e) => setAddress(e.target.value)} data-testid="address-input" placeholder="Add landmark (optional)" className={FIELD} />
                  </div>
                ) : (
                  <p data-testid="location-missing" className="text-sm p-4 bg-red-50 rounded-xl text-red-600">Location missing. Please return to search.</p>
                )}
              </div>

              {/* Spacer */}
              <div className="flex-1"></div>

              {/* Primary CTA */}
              <button type="button" onClick={confirm} disabled={!canConfirm || submitting} data-testid="confirm-service"
                className="h-14 w-full rounded-2xl text-white font-bold text-[16px] flex items-center justify-center gap-2.5 transition-all disabled:opacity-40 shrink-0 mt-4"
                style={{ background: BRAND, boxShadow: canConfirm && !submitting ? `0 8px 24px ${BRAND}40` : 'none' }}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Booking'} {!submitting && <span>→</span>}
              </button>
            </>
          ) : (
            <>
              {/* Status Display */}
              {(() => {
                const ended = isEndedEarly(booking.status)
                  ? ENDED_EARLY[booking.status as 'REJECTED' | 'CANCELLED']
                  : null;
                const currentIndex = PROGRESS_STEPS.findIndex((st) => st.id === booking.status);

                return (
                  <>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: ended ? DANGER : BRAND }}>
                      Booking ID: {booking.id.split('-')[0]}
                    </p>
                    <h1 data-testid="booking-heading" className="text-[28px] font-bold tracking-tight leading-tight mb-2" style={{ color: HEADING }}>
                      {ended ? ended.heading
                        : booking.status === 'PENDING' ? 'Request sent'
                        : booking.status === 'ACCEPTED' ? 'Mechanic accepted'
                        : booking.status === 'IN_PROGRESS' ? 'Service in progress'
                        : 'Service completed'}
                    </h1>
                    <p className="text-[14px] leading-relaxed mb-8" style={{ color: BODY }}>
                      {ended ? ended.detail : 'We will keep this updated as your mechanic progresses.'}
                    </p>

                    <div className="flex flex-col gap-4 relative">
                      <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-zinc-200/60 z-0"></div>

                      {ended ? (
                        /* The request was raised, then the booking ended. Only these
                           two steps are truthful — the rest never happened. */
                        <>
                          <div className="relative z-10 flex gap-4 p-4 rounded-2xl">
                            <div className="w-4 h-4 rounded-full border-2 mt-1 shrink-0" style={{ background: BRAND, borderColor: BRAND }} />
                            <div>
                              <p className="font-bold text-[15px]" style={{ color: HEADING }}>Request Sent</p>
                              <p className="text-sm mt-0.5" style={{ color: BODY }}>Your request reached the mechanic.</p>
                            </div>
                          </div>
                          <div data-testid="booking-ended-step" className="relative z-10 flex gap-4 p-4 rounded-2xl bg-white/60 shadow-sm">
                            <div className="w-4 h-4 rounded-full mt-1 shrink-0 flex items-center justify-center" style={{ background: DANGER }}>
                              <X className="w-2.5 h-2.5 text-white" strokeWidth={4} />
                            </div>
                            <div>
                              <p className="font-bold text-[15px]" style={{ color: DANGER }}>{ended.step}</p>
                              <p className="text-sm mt-0.5" style={{ color: BODY }}>{ended.detail}</p>
                            </div>
                          </div>
                        </>
                      ) : (
                        PROGRESS_STEPS.map((step, idx) => {
                          const isPast = idx < currentIndex;
                          const isCurrent = idx === currentIndex;
                          return (
                            <div key={step.id} className={`relative z-10 flex gap-4 p-4 rounded-2xl transition-all ${isCurrent ? 'bg-white/60 shadow-sm' : ''}`}>
                              <div className="w-4 h-4 rounded-full border-2 mt-1 shrink-0"
                                style={{ background: isPast || isCurrent ? BRAND : '#fff', borderColor: isPast || isCurrent ? (isCurrent ? '#fff' : BRAND) : '#e5e7eb' }} />
                              <div>
                                <p className="font-bold text-[15px]" style={{ color: isCurrent ? BRAND : isPast ? HEADING : BODY }}>{step.title}</p>
                                <p className="text-sm mt-0.5" style={{ color: BODY }}>{step.desc}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex-1"></div>

                    {error && (
                      <div data-testid="tracker-error" className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                        {error}
                      </div>
                    )}

                    {ended && (
                      <button type="button" data-testid="ended-cta" onClick={() => navigate(ended.to)}
                        className="h-14 w-full rounded-2xl text-white font-bold text-[16px] transition-all shrink-0 mt-4"
                        style={{ background: BRAND, boxShadow: `0 8px 24px ${BRAND}40` }}>
                        {ended.cta}
                      </button>
                    )}

                    {booking.status === 'COMPLETED' && (
                      <button type="button" onClick={() => navigate('/dashboard/find')}
                        className="h-14 w-full rounded-2xl text-white font-bold text-[16px] transition-all shrink-0 mt-4"
                        style={{ background: BRAND, boxShadow: `0 8px 24px ${BRAND}40` }}>
                        Book Another Service
                      </button>
                    )}

                    {/* Only offered while the server would actually accept it. */}
                    {CANCELLABLE_STATUSES.has(booking.status) && (
                      <button type="button" data-testid="cancel-booking" onClick={() => void cancelBooking()} disabled={cancelling}
                        className="h-12 w-full rounded-2xl font-semibold text-[15px] transition-all shrink-0 mt-3 bg-white/70 hover:bg-white disabled:opacity-40"
                        style={{ color: DANGER, border: '1px solid rgba(220,38,38,0.3)' }}>
                        {cancelling ? 'Cancelling…' : 'Cancel booking'}
                      </button>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* ── Right Column: Map & Mechanic Card ── */}
      <div className="absolute inset-0 z-0">
        <MechanicMap origin={draft ? { latitude: draft.latitude, longitude: draft.longitude } : null} mechanics={[mapMechanic]} selectedId={mechanic.id} onSelect={() => {}} />
      </div>

      {/* Floating Mechanic Card */}
      <div data-testid="selected-mechanic" className="absolute z-20 bottom-8 right-8 w-[420px] pointer-events-none hidden lg:block">
        <div className="p-6 rounded-[28px] pointer-events-auto" style={GLASS_CARD}>
          <div className="flex gap-4">
            {/* Mechanic thumbnail */}
            <div className="w-20 h-20 rounded-2xl bg-zinc-100 border border-zinc-200/60 flex-shrink-0 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-zinc-200 flex items-center justify-center">
                <WrenchIcon className="w-8 h-8 text-zinc-300" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg leading-tight truncate mb-1" style={{ color: HEADING }}>
                {mechanic.garage_name}
              </h3>
              
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: `${BRAND}15`, color: BRAND }}>
                  {mechanic.is_available ? 'Available' : 'Unavailable'}
                </span>
                <span className="text-xs font-medium" style={{ color: BODY }}>
                  {mechanic.specialization}
                </span>
              </div>

              {mechanic.total_reviews > 0 && (
                <div className="flex items-center gap-1 mb-2">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  <span className="text-sm font-semibold" style={{ color: HEADING }}>{mechanic.average_rating.toFixed(1)}</span>
                  <span className="text-sm" style={{ color: BODY }}>({mechanic.total_reviews} reviews)</span>
                </div>
              )}

              <div className="flex flex-col gap-1 text-xs mb-3" style={{ color: BODY }}>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {draft?.distanceKm || 0} km away</span>
                <span className="flex items-center gap-1"><Target className="w-3 h-3" /> {mechanic.supported_vehicle_types.map((t) => VEHICLE_TYPE_LABELS[t]).join(', ')}</span>
              </div>
            </div>
          </div>

          {!booking && (
            <div className="flex gap-3 mt-4">
              <button onClick={() => navigate('/dashboard/find')} className="flex-[1] h-12 rounded-xl bg-white/70 hover:bg-white border border-zinc-200/70 font-semibold text-sm transition-colors" style={{ color: HEADING }}>
                Change Mechanic
              </button>
              <button onClick={confirm} disabled={!canConfirm || submitting} className="flex-[1.5] h-12 rounded-xl text-white font-bold text-sm transition-all flex items-center justify-center disabled:opacity-40" style={{ background: BRAND, boxShadow: `0 6px 20px ${BRAND}35` }}>
                {submitting ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
