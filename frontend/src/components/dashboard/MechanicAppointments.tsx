import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import {
  actOnAppointment, formatDuration, formatPrice, formatTime, listAppointments,
  quoteAppointment, refundAppointment, PAYMENT_LABELS, TERMINAL_STATUSES,
  type Appointment,
} from '../../lib/appointments';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { useAppointmentRealtime } from '../../hooks/useAppointmentRealtime';
import AppointmentStatusBadge from './AppointmentStatusBadge';

/** Which intents the mechanic may raise from each state — mirrors the backend
 *  state machine, which remains authoritative and re-checks every call. */
const ACTIONS: Partial<Record<Appointment['status'],
  { action: 'accept' | 'decline' | 'start' | 'complete'; label: string; tone: string }[]>> = {
  PAYMENT_CONFIRMED: [
    { action: 'accept', label: 'Accept', tone: 'bg-emerald-500 text-zinc-950' },
    { action: 'decline', label: 'Decline', tone: 'border border-red-500/30 text-red-300' },
  ],
  CONFIRMED: [
    { action: 'start', label: 'Start service', tone: 'bg-sky-500 text-zinc-950' },
    { action: 'decline', label: 'Decline', tone: 'border border-red-500/30 text-red-300' },
  ],
  IN_SERVICE: [{ action: 'complete', label: 'Complete service', tone: 'bg-emerald-500 text-zinc-950' }],
  REQUESTED: [{ action: 'decline', label: 'Decline', tone: 'border border-red-500/30 text-red-300' }],
};

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });

export default function MechanicAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [quotes, setQuotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setAppointments(await listAppointments());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useAppointmentRealtime('mechanic', load);

  const act = async (id: string, action: 'accept' | 'decline' | 'start' | 'complete') => {
    setBusyId(id);
    setError('');
    try {
      const updated = await actOnAppointment(id, action);
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that appointment.');
    } finally {
      setBusyId('');
    }
  };

  /** Only offered while a refund is genuinely owed; the server re-checks and
   *  is idempotent, so a double click cannot refund twice. */
  const refund = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const updated = await refundAppointment(id);
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start that refund.');
    } finally {
      setBusyId('');
    }
  };

  const sendQuote = async (id: string) => {
    const amount = Number(quotes[id]);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter the amount you are quoting for this job.');
      return;
    }
    setBusyId(id);
    setError('');
    try {
      const updated = await quoteAppointment(id, amount);
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send that quotation.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <div data-testid="mechanic-appointments-loading"
        className="glass-panel p-8 text-zinc-500 text-sm">
        Loading your appointments…
      </div>
    );
  }

  const upcoming = appointments.filter((a) => !TERMINAL_STATUSES.has(a.status));
  const past = appointments.filter((a) => TERMINAL_STATUSES.has(a.status));

  const card = (a: Appointment) => (
    <li key={a.id} data-testid={`mechanic-appointment-${a.id}`} className="glass-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-white font-medium">{a.service_name}</h3>
          <p className="text-zinc-500 text-sm font-light">
            {VEHICLE_TYPE_LABELS[a.vehicle_type]} · {a.customer.name}
          </p>
          <p className="text-zinc-300 text-sm mt-2">
            {longDate(a.appointment_date)} · {formatTime(a.start_time)} –{' '}
            {formatTime(a.end_time)}
          </p>
          <p className="text-zinc-600 text-xs mt-1">{formatDuration(a.duration_minutes)}</p>
          {a.description && (
            <p className="text-zinc-400 text-sm mt-2">{a.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <AppointmentStatusBadge status={a.status} />
          <p className="text-white text-lg font-semibold tracking-tight mt-2">
            {formatPrice(a.price_minor)}
          </p>
          <p className="text-zinc-500 text-xs">{PAYMENT_LABELS[a.payment_status]}</p>
        </div>
      </div>

      {/* A custom request is priced before anything else can happen. */}
      {a.status === 'REQUESTED' && a.service_type === 'CUSTOM' && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`quote-${a.id}`}>Quotation amount</label>
          <input id={`quote-${a.id}`} data-testid={`quote-input-${a.id}`} type="number" min="1"
            value={quotes[a.id] ?? ''}
            onChange={(e) => setQuotes((q) => ({ ...q, [a.id]: e.target.value }))}
            placeholder="Amount (₹)"
            className="h-9 w-40 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/40" />
          <button type="button" data-testid={`send-quote-${a.id}`} disabled={busyId === a.id}
            onClick={() => void sendQuote(a.id)}
            className="h-9 px-4 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-semibold disabled:opacity-50">
            Send quotation
          </button>
        </div>
      )}

      {(a.payment_status === 'REFUND_PENDING' || a.payment_status === 'REFUND_FAILED') && (
        <div className="mt-4">
          <button type="button" data-testid={`refund-${a.id}`} disabled={busyId === a.id}
            onClick={() => void refund(a.id)}
            className="h-9 px-4 rounded-xl border border-amber-500/30 text-amber-300 text-sm font-semibold disabled:opacity-50 hover:bg-amber-500/10">
            {a.payment_status === 'REFUND_FAILED' ? 'Retry refund' : 'Issue refund'}{' '}
            {formatPrice(a.price_minor)}
          </button>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {(ACTIONS[a.status] ?? []).map(({ action, label, tone }) => (
          <button key={action} type="button" data-testid={`${action}-${a.id}`}
            disabled={busyId === a.id} onClick={() => void act(a.id, action)}
            className={`h-9 px-4 rounded-xl text-sm font-semibold disabled:opacity-50 ${tone}`}>
            {label}
          </button>
        ))}
      </div>
    </li>
  );

  return (
    <div data-testid="mechanic-appointments" className="space-y-6">
      <div className="relative overflow-hidden glass-panel p-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          Scheduled service
        </span>
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">
          Service Appointments
        </h2>
        <p className="text-zinc-400 text-sm font-light mb-8">
          Pre-booked work, separate from your emergency requests.
        </p>

        {error && (
          <div data-testid="mechanic-appointments-error" role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <h3 className="text-white font-medium mb-4">Upcoming</h3>
        {upcoming.length === 0 ? (
          <div data-testid="mechanic-upcoming-empty"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-white font-medium mb-1">No upcoming appointments</p>
            <p className="text-zinc-400 text-sm font-light">
              Scheduled services customers book with you will appear here.
            </p>
          </div>
        ) : (
          <ul data-testid="mechanic-upcoming" className="space-y-3">{upcoming.map(card)}</ul>
        )}
      </div>

      {past.length > 0 && (
        <div className="relative overflow-hidden glass-panel p-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
            History
          </span>
          <h3 className="text-xl font-semibold text-white tracking-tight mb-6">Past appointments</h3>
          <ul data-testid="mechanic-appointment-history" className="space-y-3">{past.map(card)}</ul>
        </div>
      )}
    </div>
  );
}
