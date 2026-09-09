import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Star } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  createAppointment, createPaymentOrder, confirmPayment, formatDuration, formatPrice,
  formatTime, listServicePackages, listSlots, markPaymentFailed,
  type Appointment, type ServicePackage, type ServiceType,
} from '../../lib/appointments';
import { findNearbyMechanics, getCurrentPosition, type Coordinates, type NearbyMechanic }
  from '../../lib/discovery';
import { VEHICLE_TYPE_LABELS, type VehicleType } from '../../lib/mechanic';
import { openCheckout } from '../../lib/checkout';
import ServiceCard from './ServiceCard';

type Step = 'vehicle' | 'service' | 'mechanic' | 'slot' | 'review';

const STEPS: { id: Step; label: string }[] = [
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'service', label: 'Service' },
  { id: 'mechanic', label: 'Garage' },
  { id: 'slot', label: 'Date & time' },
  { id: 'review', label: 'Review' },
];

/** The bookable window. Matches the backend's 14-day horizon. */
const HORIZON_DAYS = 14;

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export default function ScheduleService() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('vehicle');
  const [vehicleType, setVehicleType] = useState<VehicleType | null>(null);
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [mechanics, setMechanics] = useState<NearbyMechanic[]>([]);
  const [mechanic, setMechanic] = useState<NearbyMechanic | null>(null);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState<string[]>([]);
  const [slot, setSlot] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selectedPackage = useMemo(
    () => packages.find((p) => p.service_type === serviceType) ?? null,
    [packages, serviceType],
  );
  const isCustom = serviceType === 'CUSTOM';

  const dates = useMemo(() => {
    const today = new Date();
    return Array.from({ length: HORIZON_DAYS }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      return d;
    });
  }, []);

  /* The catalogue is fetched per vehicle type — prices are vehicle-specific and
     the server is the only place they exist. */
  useEffect(() => {
    if (!vehicleType) return;
    let active = true;
    setLoading(true);
    setError('');
    listServicePackages(vehicleType)
      .then((p) => active && setPackages(p))
      .catch((e: Error) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [vehicleType]);

  const findMechanics = useCallback(async (vehicle: VehicleType) => {
    setLoading(true);
    setError('');
    try {
      const position = coords ?? await getCurrentPosition();
      setCoords(position);
      setMechanics(await findNearbyMechanics(position, vehicle));
    } catch (e) {
      setError(e instanceof Error ? e.message
        : 'We could not find garages near you. Allow location access and try again.');
    } finally {
      setLoading(false);
    }
  }, [coords]);

  /* The garage is passed in rather than read from state: the first call happens
     in the same handler that selects it, before that state has applied. */
  const loadSlots = useCallback(async (chosen: string, garage?: NearbyMechanic) => {
    const target = garage ?? mechanic;
    if (!target || !serviceType || !vehicleType) return;
    setLoading(true);
    setError('');
    setSlot('');
    try {
      const result = await listSlots({
        mechanicProfileId: target.id, serviceType, vehicleType, date: chosen,
      });
      setSlots(result.slots);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load available times.');
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [mechanic, serviceType, vehicleType]);

  /**
   * Create the appointment, then pay for it when a price is already known.
   * A Custom Service is submitted unpriced and waits for the mechanic's
   * quotation — it is never forced through the fixed-price flow.
   */
  const submit = async () => {
    if (!mechanic || !serviceType || !vehicleType || !date || !slot) return;
    setSubmitting(true);
    setError('');
    let appointment: Appointment;
    try {
      appointment = await createAppointment({
        mechanic_profile_id: mechanic.id,
        service_type: serviceType,
        vehicle_type: vehicleType,
        appointment_date: date,
        start_time: slot,
        description: description.trim() || null,
        service_latitude: coords?.latitude ?? null,
        service_longitude: coords?.longitude ?? null,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not book that appointment.');
      setSubmitting(false);
      return;
    }

    if (isCustom) {
      navigate(`/dashboard/appointments?highlight=${appointment.id}`);
      return;
    }

    try {
      // The order — and its amount — are created by the server.
      const order = await createPaymentOrder(appointment.id);
      const result = await openCheckout(order, {
        name: mechanic.garage_name,
        description: appointment.service_name,
        appointmentId: appointment.id,
      });
      if (!result) {
        await markPaymentFailed(appointment.id);
        navigate(`/dashboard/appointments?highlight=${appointment.id}`);
        return;
      }
      await confirmPayment(appointment.id, result);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Payment could not be completed.');
      setSubmitting(false);
      navigate(`/dashboard/appointments?highlight=${appointment.id}`);
      return;
    }
    navigate(`/dashboard/appointments?highlight=${appointment.id}`);
  };

  const goBack = () => {
    const index = STEPS.findIndex((s) => s.id === step);
    if (index > 0) setStep(STEPS[index - 1].id);
  };

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div data-testid="schedule-service" className="space-y-6">
      <div className="relative overflow-hidden glass-panel p-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          Scheduled service
        </span>
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Schedule Service</h2>
        <p className="text-zinc-400 text-sm font-light mb-8">
          Plan your vehicle service in advance.
        </p>

        {/* Progress. Subtle, and never clickable ahead of what has been chosen. */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 mb-8">
          {STEPS.map((s, index) => (
            <li key={s.id} className="flex items-center gap-2">
              <span
                data-testid={`step-${s.id}`}
                data-active={index === stepIndex}
                className={`text-xs font-medium transition-colors ${
                  index === stepIndex ? 'text-emerald-400'
                    : index < stepIndex ? 'text-zinc-300' : 'text-zinc-600'
                }`}
              >
                {s.label}
              </span>
              {index < STEPS.length - 1 && <span className="text-zinc-700 text-xs">›</span>}
            </li>
          ))}
        </ol>

        {error && (
          <div data-testid="schedule-error" role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {stepIndex > 0 && (
          <button type="button" onClick={goBack} data-testid="schedule-back"
            className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        )}

        {/* ── 1. Vehicle type ── */}
        {step === 'vehicle' && (
          <div className="grid gap-4 sm:grid-cols-2">
            {(['BIKE', 'CAR'] as VehicleType[]).map((type) => (
              <button key={type} type="button" data-testid={`vehicle-${type}`}
                onClick={() => { setVehicleType(type); setServiceType(null); setStep('service'); }}
                className="glass-card p-6 text-left hover:border-white/25 transition-colors">
                <span className="text-3xl">{type === 'BIKE' ? '🛵' : '🚗'}</span>
                <p className="mt-3 text-white font-medium">{VEHICLE_TYPE_LABELS[type]}</p>
                <p className="text-zinc-500 text-sm font-light mt-1">
                  Prices and durations differ by vehicle type.
                </p>
              </button>
            ))}
          </div>
        )}

        {/* ── 2. Service ── */}
        {step === 'service' && (
          loading ? (
            <p data-testid="packages-loading" className="text-zinc-500 text-sm">Loading services…</p>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {packages.map((pkg) => (
                  <ServiceCard key={pkg.id} pkg={pkg} selected={serviceType === pkg.service_type}
                    onSelect={() => setServiceType(pkg.service_type)} />
                ))}
              </div>
              {isCustom && (
                <div className="mt-6">
                  <label htmlFor="custom-description"
                    className="text-sm font-medium text-white mb-2 block">
                    What does your vehicle need?
                  </label>
                  <textarea id="custom-description" rows={4} value={description}
                    data-testid="custom-description"
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the problem or the work you need…"
                    className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40" />
                  <p className="text-zinc-500 text-xs mt-2">
                    The mechanic reviews this and sends you a quotation before any payment.
                  </p>
                </div>
              )}
              <button type="button" data-testid="service-continue"
                disabled={!serviceType || (isCustom && description.trim().length < 5)}
                onClick={() => { setStep('mechanic'); void findMechanics(vehicleType!); }}
                className="mt-6 h-12 w-full rounded-2xl bg-emerald-500 text-zinc-950 font-semibold text-sm disabled:opacity-40">
                Continue
              </button>
            </>
          )
        )}

        {/* ── 3. Mechanic ── */}
        {step === 'mechanic' && (
          loading ? (
            <p data-testid="mechanics-loading" className="text-zinc-500 text-sm">
              Finding garages near you…
            </p>
          ) : mechanics.length === 0 ? (
            <div data-testid="mechanics-empty"
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-white font-medium mb-1">No garages available</p>
              <p className="text-zinc-400 text-sm font-light">
                No garage near you currently services {vehicleType && VEHICLE_TYPE_LABELS[vehicleType]}.
              </p>
            </div>
          ) : (
            <ul data-testid="mechanic-list" className="space-y-3">
              {mechanics.map((m) => (
                <li key={m.id}>
                  <button type="button" data-testid={`mechanic-${m.id}`}
                    onClick={() => {
                      setMechanic(m);
                      const first = isoDate(dates[0]);
                      setDate(first);
                      setStep('slot');
                      void loadSlots(first, m);
                    }}
                    className="glass-card w-full p-5 text-left hover:border-white/25 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="text-white font-medium truncate">{m.garage_name}</h3>
                        <p className="text-zinc-500 text-sm font-light">{m.specialization}</p>
                        <p className="text-zinc-600 text-xs mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {m.distance_km} km away
                        </p>
                      </div>
                      {m.total_reviews > 0 && (
                        <span className="flex items-center gap-1 text-sm text-zinc-300 shrink-0">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          {m.average_rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {/* ── 4. Date and slot ── */}
        {step === 'slot' && mechanic && (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-white mb-3">Choose a date</p>
              <div className="flex gap-2 overflow-x-auto pb-2" data-testid="date-strip">
                {dates.map((d) => {
                  const value = isoDate(d);
                  const active = value === date;
                  return (
                    <button key={value} type="button" data-testid={`date-${value}`}
                      onClick={() => { setDate(value); void loadSlots(value); }}
                      className={`shrink-0 rounded-2xl border px-4 py-3 text-center transition-colors ${
                        active ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                          : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:text-white'
                      }`}>
                      <span className="block text-[10px] uppercase tracking-wider">
                        {d.toLocaleDateString([], { weekday: 'short' })}
                      </span>
                      <span className="block text-lg font-semibold">{d.getDate()}</span>
                      <span className="block text-[10px]">
                        {d.toLocaleDateString([], { month: 'short' })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-white mb-3">Available times</p>
              {loading ? (
                <p data-testid="slots-loading" className="text-zinc-500 text-sm">Checking availability…</p>
              ) : slots.length === 0 ? (
                <div data-testid="slots-empty"
                  className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
                  <p className="text-white font-medium mb-1">No times available</p>
                  <p className="text-zinc-400 text-sm font-light">
                    This garage has nothing free on that date. Try another day.
                  </p>
                </div>
              ) : (
                <div data-testid="slot-grid" className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {slots.map((s) => (
                    <button key={s} type="button" data-testid={`slot-${s}`}
                      onClick={() => setSlot(s)}
                      className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        slot === s ? 'border-emerald-500/50 bg-emerald-500/10 text-white'
                          : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:text-white'
                      }`}>
                      {formatTime(s)}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" data-testid="slot-continue" disabled={!slot}
              onClick={() => setStep('review')}
              className="h-12 w-full rounded-2xl bg-emerald-500 text-zinc-950 font-semibold text-sm disabled:opacity-40">
              Review appointment
            </button>
          </div>
        )}

        {/* ── 5. Review ── */}
        {step === 'review' && mechanic && selectedPackage && (
          <div data-testid="review-panel" className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
              {[
                ['Service', selectedPackage.name],
                ['Vehicle', vehicleType ? VEHICLE_TYPE_LABELS[vehicleType] : ''],
                ['Garage', mechanic.garage_name],
                ['Date', new Date(`${date}T00:00:00`).toLocaleDateString([], {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })],
                ['Time', `${formatTime(slot)} · ${formatDuration(selectedPackage.duration_minutes)}`],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <span className="text-zinc-500 text-sm">{label}</span>
                  <span className="text-white text-sm font-medium text-right">{value}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-3 flex items-baseline justify-between gap-4">
                <span className="text-zinc-400 text-sm">
                  {isCustom ? 'Amount' : 'Total payable'}
                </span>
                <span data-testid="review-price"
                  className="text-white text-xl font-semibold tracking-tight">
                  {formatPrice(selectedPackage.price_minor)}
                </span>
              </div>
            </div>

            {isCustom && (
              <p data-testid="custom-notice" className="text-zinc-400 text-sm font-light">
                Custom Service has no fixed price. The mechanic reviews your request and
                sends a quotation — you only pay after you approve it.
              </p>
            )}

            <button type="button" data-testid="confirm-appointment" disabled={submitting}
              onClick={() => void submit()}
              className="h-12 w-full rounded-2xl bg-emerald-500 text-zinc-950 font-semibold text-sm disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isCustom ? 'Submit request' : `Pay ${formatPrice(selectedPackage.price_minor)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
