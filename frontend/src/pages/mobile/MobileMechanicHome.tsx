import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { listAppointments, type Appointment } from '../../lib/appointments';
import { actOnBooking, listBookings, type Booking } from '../../lib/booking';
import { getAvailability, VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { useAvailability } from '../../lib/availability';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import AvailabilityControl from '../../components/dashboard/AvailabilityControl';
import { ErrorState } from '../../components/ui/StateMessage';
import { CARD, TAP } from '../../components/mobile/mobileTokens';

/**
 * The mechanic's mobile home: the job in front of them, and the two taps that
 * move it forward.
 *
 * Ordered incoming request -> active job -> everything else, because a
 * mechanic reading this is usually holding the phone in one hand.
 * Availability reuses the shared `AvailabilityControl`, so there is still
 * exactly one way to change it.
 */
export default function MobileMechanicHome() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [available, setAvailable] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const publishAvailability = useAvailability((s) => s.setKnownAvailability);

  const load = useCallback(async () => {
    const [jobs, appts, availability] = await Promise.allSettled([
      listBookings(), listAppointments(), getAvailability(),
    ]);
    if (jobs.status === 'fulfilled') setBookings(jobs.value);
    else setError(jobs.reason);
    if (appts.status === 'fulfilled') setAppointments(appts.value);
    if (availability.status === 'fulfilled') {
      setAvailable(availability.value.is_available);
      setHasProfile(true);
      publishAvailability(availability.value.is_available);
    } else if (availability.reason instanceof ApiError && availability.reason.status === 404) {
      setHasProfile(false);
    }
    setLoading(false);
  }, [publishAvailability]);

  useEffect(() => { void load(); }, [load]);
  useBookingRealtime('mechanic', load);

  const act = async (id: string, action: 'accept' | 'reject' | 'start' | 'complete') => {
    setBusyId(id);
    try {
      const updated = await actOnBooking(id, action);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err);
    } finally {
      setBusyId('');
    }
  };

  const incoming = bookings.filter((b) => b.status === 'PENDING');
  const activeJob = bookings.find((b) => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS');
  const upcomingAppointments = appointments.filter(
    (a) => !['COMPLETED', 'DECLINED', 'CANCELLED'].includes(a.status)).length;
  const completedToday = bookings.filter((b) => b.status === 'COMPLETED').length;

  if (loading) {
    return <p data-testid="m-mech-loading" className="text-[13px] text-[#F0F4F2]/45">
      Loading your dashboard…
    </p>;
  }

  return (
    <div data-testid="m-mechanic-home" className="space-y-5">
      {error ? <ErrorState error={error} onRetry={() => void load()} testId="m-mech-error" /> : null}

      <AvailabilityControl
        available={available}
        enabled={hasProfile}
        onChange={setAvailable}
        onError={(m) => setError(new ApiError(0, null, m))}
      />

      {/* 1 — a request waiting on an answer is the whole job. */}
      {incoming.length > 0 && (
        <section data-testid="m-mech-incoming">
          <h3 className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3ECF8E]">
            New request{incoming.length > 1 ? `s · ${incoming.length}` : ''}
          </h3>
          <ul className="space-y-3">
            {incoming.map((b) => (
              <li key={b.id} className={`${CARD} p-4 border-[#3ECF8E]/30`}>
                <p className="m-0 font-semibold text-[15.5px] tracking-[-0.01em]">
                  {VEHICLE_TYPE_LABELS[b.vehicle_type]}
                </p>
                <p className="m-0 mt-1 text-[13.5px] text-[#F0F4F2]/70">{b.problem_description}</p>
                <p className="m-0 mt-1 text-[12px] text-[#F0F4F2]/40 truncate">
                  {b.customer.name}{b.service_address ? ` · ${b.service_address}` : ''}
                </p>
                <div className="mt-3.5 grid grid-cols-2 gap-2.5">
                  <button type="button" disabled={busyId === b.id}
                    onClick={() => void act(b.id, 'reject')}
                    data-testid={`m-mech-decline-${b.id}`}
                    className="rounded-[14px] border border-[#E07864]/30 text-[#EFB2A4] text-[14px] font-medium active:bg-[#E07864]/10 disabled:opacity-50"
                    style={{ minHeight: TAP }}>
                    Decline
                  </button>
                  <button type="button" disabled={busyId === b.id}
                    onClick={() => void act(b.id, 'accept')}
                    data-testid={`m-mech-accept-${b.id}`}
                    className="rounded-[14px] bg-[#3ECF8E] text-[#052018] text-[14px] font-semibold active:brightness-95 disabled:opacity-50"
                    style={{ minHeight: TAP }}>
                    Accept
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2 — the job in hand, with its single next step. */}
      {activeJob && (
        <section data-testid="m-mech-active">
          <h3 className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0F4F2]/40">
            Active job
          </h3>
          <div className={`${CARD} p-4`}>
            <p className="m-0 font-semibold text-[15.5px]">
              {VEHICLE_TYPE_LABELS[activeJob.vehicle_type]}
            </p>
            <p className="m-0 mt-1 text-[13.5px] text-[#F0F4F2]/70">
              {activeJob.problem_description}
            </p>
            <p className="m-0 mt-1 text-[12px] text-[#F0F4F2]/40 truncate">
              {activeJob.customer.name}
              {activeJob.customer.phone_number ? ` · ${activeJob.customer.phone_number}` : ''}
            </p>
            <button type="button" disabled={busyId === activeJob.id}
              onClick={() => void act(activeJob.id,
                activeJob.status === 'ACCEPTED' ? 'start' : 'complete')}
              data-testid="m-mech-advance"
              className="mt-3.5 w-full rounded-[14px] bg-[#3ECF8E] text-[#052018] text-[14px] font-semibold active:brightness-95 disabled:opacity-50"
              style={{ minHeight: TAP }}>
              {activeJob.status === 'ACCEPTED' ? 'Start service' : 'Complete service'}
            </button>
          </div>
        </section>
      )}

      {incoming.length === 0 && !activeJob && (
        <div className={`${CARD} p-5`} data-testid="m-mech-idle">
          <p className="m-0 font-medium text-[15px]">
            {available ? 'Waiting for requests' : "You're not accepting requests"}
          </p>
          <p className="m-0 mt-1 text-[13px] text-[#F0F4F2]/55">
            {available
              ? 'New roadside requests in your service area will appear here straight away.'
              : 'Switch availability on above so customers can be matched with you.'}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Appointments', value: upcomingAppointments, to: '/dashboard/appointments' },
          { label: 'Completed', value: completedToday, to: '/dashboard/history' },
        ].map((s) => (
          <button key={s.label} type="button" onClick={() => navigate(s.to)}
            data-testid={`m-mech-stat-${s.label.toLowerCase()}`}
            className={`${CARD} p-4 text-left active:bg-white/[0.07]`}>
            <p className="m-0 text-[26px] font-semibold tracking-[-0.02em]">{s.value}</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-[#F0F4F2]/40">{s.label}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
