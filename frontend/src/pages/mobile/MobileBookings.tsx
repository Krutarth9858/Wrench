import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone } from '@phosphor-icons/react';
import {
  actOnBooking, listBookings, CANCELLABLE_STATUSES, STATUS_LABELS,
  TERMINAL_STATUSES, type Booking, type BookingStatus,
} from '../../lib/booking';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import { ErrorState } from '../../components/ui/StateMessage';
import { CARD, PRIMARY_BUTTON, TAP } from '../../components/mobile/mobileTokens';

/** The live steps of a roadside job, in order. */
const TIMELINE: { id: BookingStatus; label: string }[] = [
  { id: 'PENDING', label: 'Request sent' },
  { id: 'ACCEPTED', label: 'Mechanic accepted' },
  { id: 'IN_PROGRESS', label: 'Service in progress' },
  { id: 'COMPLETED', label: 'Completed' },
];

/**
 * Live assistance on mobile — a tracking screen, not a list page.
 *
 * An in-flight job takes the whole first screen with a large status, the
 * mechanic's details and a timeline, because that is the only thing that
 * matters while you are waiting at the roadside. Everything finished drops
 * into a compact history below.
 */
export default function MobileBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setBookings(await listBookings());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useBookingRealtime('customer', load);

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await actOnBooking(id, 'cancel');
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err);
    } finally {
      setBusyId('');
    }
  };

  const active = bookings.find((b) => !TERMINAL_STATUSES.has(b.status));
  const past = bookings.filter((b) => TERMINAL_STATUSES.has(b.status));
  const stepIndex = active ? TIMELINE.findIndex((s) => s.id === active.status) : -1;

  if (loading) {
    return <p data-testid="m-bookings-loading" className="text-[13px] text-[#F0F4F2]/45">
      Loading your assistance…
    </p>;
  }

  return (
    <div data-testid="m-bookings" className="space-y-6">
      {error ? <ErrorState error={error} onRetry={() => void load()} testId="m-bookings-error" /> : null}

      {active ? (
        <section data-testid="m-bookings-active" className={`${CARD} p-5 border-[#3ECF8E]/30`}>
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-[#3ECF8E] opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-[#3ECF8E]" />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3ECF8E]">
              Live
            </span>
          </div>

          <h2 className="m-0 mt-3 font-semibold text-[24px] leading-tight tracking-[-0.025em]">
            {STATUS_LABELS[active.status]}
          </h2>
          <p className="m-0 mt-1.5 text-[13.5px] text-[#F0F4F2]/55">
            {active.mechanic.name} · {VEHICLE_TYPE_LABELS[active.vehicle_type]}
          </p>

          <ol className="mt-5 space-y-0">
            {TIMELINE.map((step, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;
              return (
                <li key={step.id} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                      done || current ? 'bg-[#3ECF8E]' : 'bg-white/15'}`} />
                    {index < TIMELINE.length - 1 && (
                      <span className={`w-px h-7 ${done ? 'bg-[#3ECF8E]/45' : 'bg-white/10'}`} />
                    )}
                  </div>
                  <span className={`text-[13.5px] leading-none pt-1 ${
                    current ? 'text-[#F0F4F2] font-medium'
                      : done ? 'text-[#F0F4F2]/60' : 'text-[#F0F4F2]/30'}`}>
                    {step.label}
                  </span>
                </li>
              );
            })}
          </ol>

          {active.mechanic.phone_number && (
            <a href={`tel:${active.mechanic.phone_number}`}
              data-testid="m-bookings-call"
              className="mt-5 flex items-center justify-center gap-2 rounded-[14px] border border-white/12 bg-white/[0.05] text-[14px] font-medium active:bg-white/10"
              style={{ minHeight: TAP }}>
              <Phone weight="fill" className="w-[16px] h-[16px] text-[#3ECF8E]" />
              Call mechanic
            </a>
          )}

          {CANCELLABLE_STATUSES.has(active.status) && (
            <button type="button" onClick={() => void cancel(active.id)} disabled={busyId === active.id}
              data-testid="m-bookings-cancel"
              className="mt-2.5 w-full rounded-[14px] border border-[#E07864]/30 text-[#EFB2A4] text-[13.5px] font-medium active:bg-[#E07864]/10 disabled:opacity-50"
              style={{ minHeight: TAP }}>
              {busyId === active.id ? 'Cancelling…' : 'Cancel request'}
            </button>
          )}
        </section>
      ) : (
        <section className={`${CARD} p-5`} data-testid="m-bookings-empty">
          <p className="m-0 font-medium text-[15px]">No active assistance</p>
          <p className="m-0 mt-1 mb-4 text-[13px] text-[#F0F4F2]/55">
            When you request help, this screen tracks it live — from the mechanic
            accepting through to the job being finished.
          </p>
          <button type="button" onClick={() => navigate('/dashboard/find')}
            className={PRIMARY_BUTTON} data-testid="m-bookings-find">
            Find a Mechanic
          </button>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h3 className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0F4F2]/40">
            Past requests
          </h3>
          <ul className="space-y-3" data-testid="m-bookings-history">
            {past.map((b) => (
              <li key={b.id} className={`${CARD} p-4`} data-testid={`m-booking-${b.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 font-medium text-[14.5px] truncate">{b.mechanic.name}</p>
                    <p className="m-0 mt-0.5 text-[12.5px] text-[#F0F4F2]/45 truncate">
                      {VEHICLE_TYPE_LABELS[b.vehicle_type]} · {b.problem_description}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-[#F0F4F2]/40">
                    {STATUS_LABELS[b.status]}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
