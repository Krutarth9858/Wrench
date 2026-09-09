import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import {
  actOnAppointment, formatPrice, formatTime, listAppointments,
  CANCELLABLE_STATUSES, PAYMENT_LABELS, STATUS_LABELS, STATUS_TONES,
  TERMINAL_STATUSES, type Appointment,
} from '../../lib/appointments';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { useAppointmentRealtime } from '../../hooks/useAppointmentRealtime';
import { ErrorState } from '../../components/ui/StateMessage';
import { CARD, PRIMARY_BUTTON, TAP } from '../../components/mobile/mobileTokens';

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], {
    weekday: 'short', day: 'numeric', month: 'short',
  });

/**
 * Scheduled service on mobile: stacked cards, never a table.
 *
 * Each card answers what/when/who/how much at a glance, with the one relevant
 * action underneath. Same API and realtime channel as desktop.
 */
export default function MobileAppointments() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setAppointments(await listAppointments());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useAppointmentRealtime('customer', load);

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await actOnAppointment(id, 'cancel');
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err : err);
    } finally {
      setBusyId('');
    }
  };

  const upcoming = appointments.filter((a) => !TERMINAL_STATUSES.has(a.status));
  const past = appointments.filter((a) => TERMINAL_STATUSES.has(a.status));

  const card = (a: Appointment) => (
    <li key={a.id} data-testid={`m-appointment-${a.id}`} className={`${CARD} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 font-semibold text-[15.5px] tracking-[-0.01em] truncate">
            {a.service_name}
          </h3>
          <p className="m-0 mt-0.5 text-[12.5px] text-[#F0F4F2]/45 truncate">
            {VEHICLE_TYPE_LABELS[a.vehicle_type]} · {a.mechanic.name}
          </p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10.5px] font-medium ${STATUS_TONES[a.status]}`}>
          {STATUS_LABELS[a.status]}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="m-0 text-[14px] font-medium">
            {longDate(a.appointment_date)} · {formatTime(a.start_time)}
          </p>
          <p className="m-0 mt-0.5 text-[11.5px] text-[#F0F4F2]/40">
            {PAYMENT_LABELS[a.payment_status]}
          </p>
        </div>
        <p className="m-0 text-[17px] font-semibold tracking-[-0.01em]">
          {formatPrice(a.price_minor)}
        </p>
      </div>

      {CANCELLABLE_STATUSES.has(a.status) && (
        <button type="button" onClick={() => void cancel(a.id)} disabled={busyId === a.id}
          data-testid={`m-appointment-cancel-${a.id}`}
          className="mt-3 w-full rounded-[14px] border border-[#E07864]/30 text-[#EFB2A4] text-[13.5px] font-medium active:bg-[#E07864]/10 disabled:opacity-50"
          style={{ minHeight: TAP }}>
          {busyId === a.id ? 'Cancelling…' : 'Cancel appointment'}
        </button>
      )}
    </li>
  );

  if (loading) {
    return <p data-testid="m-appointments-loading" className="text-[13px] text-[#F0F4F2]/45">
      Loading your appointments…
    </p>;
  }

  return (
    <div data-testid="m-appointments" className="space-y-6">
      {error ? <ErrorState error={error} onRetry={() => void load()} testId="m-appointments-error" /> : null}

      <section>
        <h3 className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0F4F2]/40">
          Upcoming
        </h3>
        {upcoming.length === 0 ? (
          <div className={`${CARD} p-5`} data-testid="m-appointments-empty">
            <p className="m-0 font-medium text-[15px]">Nothing scheduled</p>
            <p className="m-0 mt-1 mb-4 text-[13px] text-[#F0F4F2]/55">
              Book a service in advance and it will appear here with its date,
              price and payment status.
            </p>
            <button type="button" onClick={() => navigate('/dashboard/schedule-service')}
              className={PRIMARY_BUTTON} data-testid="m-appointments-schedule">
              Schedule a Service
            </button>
          </div>
        ) : (
          <ul className="space-y-3">{upcoming.map(card)}</ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h3 className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0F4F2]/40">
            History
          </h3>
          <ul className="space-y-3" data-testid="m-appointments-history">{past.map(card)}</ul>
        </section>
      )}
    </div>
  );
}
