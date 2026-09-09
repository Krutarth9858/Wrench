import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ApiError } from '../../lib/api';
import {
  actOnAppointment, confirmPayment, createPaymentOrder, formatDuration, formatPrice,
  formatTime, listAppointments, markPaymentFailed, CANCELLABLE_STATUSES, PAYMENT_LABELS,
  TERMINAL_STATUSES, type Appointment,
} from '../../lib/appointments';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { openCheckout } from '../../lib/checkout';
import { useAppointmentRealtime } from '../../hooks/useAppointmentRealtime';
import AppointmentStatusBadge from './AppointmentStatusBadge';

const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString([], {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

export default function MyAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [params] = useSearchParams();
  const highlight = params.get('highlight') ?? '';

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

  // The existing socket, not a second one and not polling.
  useAppointmentRealtime('customer', load);

  const act = async (id: string, action: 'cancel' | 'accept-quotation') => {
    setBusyId(id);
    setError('');
    try {
      const updated = await actOnAppointment(id, action);
      setAppointments((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      // Approving a quotation makes the appointment payable straight away.
      if (action === 'accept-quotation') await pay(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update that appointment.');
    } finally {
      setBusyId('');
    }
  };

  /** The amount is created and verified server-side; nothing is sent from here. */
  const pay = async (appointment: Appointment) => {
    setBusyId(appointment.id);
    setError('');
    try {
      const order = await createPaymentOrder(appointment.id);
      const result = await openCheckout(order, {
        name: appointment.mechanic.name,
        description: appointment.service_name,
        appointmentId: appointment.id,
      });
      if (!result) {
        await markPaymentFailed(appointment.id);
      } else {
        await confirmPayment(appointment.id, result);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Payment could not be completed.');
      await load();
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <div data-testid="appointments-loading" className="glass-panel p-8 text-zinc-500 text-sm">
        Loading your appointments…
      </div>
    );
  }

  const upcoming = appointments.filter((a) => !TERMINAL_STATUSES.has(a.status));
  const past = appointments.filter((a) => TERMINAL_STATUSES.has(a.status));

  const card = (a: Appointment) => (
    <li key={a.id} data-testid={`appointment-${a.id}`}
      className={`glass-card p-5 ${a.id === highlight ? 'border-emerald-500/50' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-white font-medium">{a.service_name}</h3>
          <p className="text-zinc-500 text-sm font-light">
            {VEHICLE_TYPE_LABELS[a.vehicle_type]} · {a.mechanic.name}
          </p>
          <p className="text-zinc-300 text-sm mt-2">
            {longDate(a.appointment_date)} · {formatTime(a.start_time)}
          </p>
          <p className="text-zinc-600 text-xs mt-1">
            {formatDuration(a.duration_minutes)}
            {a.description ? ` · ${a.description}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <AppointmentStatusBadge status={a.status} />
          <p data-testid={`price-${a.id}`}
            className="text-white text-lg font-semibold tracking-tight mt-2">
            {formatPrice(a.price_minor)}
          </p>
          <p className="text-zinc-500 text-xs">{PAYMENT_LABELS[a.payment_status]}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {a.status === 'QUOTED' && (
          <button type="button" data-testid={`approve-${a.id}`} disabled={busyId === a.id}
            onClick={() => void act(a.id, 'accept-quotation')}
            className="h-9 px-4 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-semibold disabled:opacity-50">
            {busyId === a.id ? 'Working…' : `Approve ${formatPrice(a.price_minor)} & pay`}
          </button>
        )}
        {a.status === 'PAYMENT_PENDING' && (
          <button type="button" data-testid={`pay-${a.id}`} disabled={busyId === a.id}
            onClick={() => void pay(a)}
            className="h-9 px-4 rounded-xl bg-emerald-500 text-zinc-950 text-sm font-semibold disabled:opacity-50 inline-flex items-center gap-2">
            {busyId === a.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Pay {formatPrice(a.price_minor)}
          </button>
        )}
        {CANCELLABLE_STATUSES.has(a.status) && (
          <button type="button" data-testid={`cancel-${a.id}`} disabled={busyId === a.id}
            onClick={() => void act(a.id, 'cancel')}
            className="h-9 px-4 rounded-xl border border-red-500/30 text-red-300 text-sm disabled:opacity-50 hover:bg-red-500/10">
            Cancel
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div data-testid="my-appointments" className="space-y-6">
      <div className="relative overflow-hidden glass-panel p-8">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
              Scheduled service
            </span>
            <h2 className="text-2xl font-semibold text-white tracking-tight">
              My Service Appointments
            </h2>
          </div>
          <Link to="/dashboard/schedule-service"
            className="h-10 px-4 inline-flex items-center rounded-2xl bg-emerald-500 text-zinc-950 text-sm font-semibold shrink-0">
            Schedule service
          </Link>
        </div>

        {error && (
          <div data-testid="appointments-error" role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <h3 className="text-white font-medium mb-4">Upcoming</h3>
        {upcoming.length === 0 ? (
          <div data-testid="upcoming-empty"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-white font-medium mb-1">No upcoming appointments</p>
            <p className="text-zinc-400 text-sm font-light">
              Plan your vehicle service in advance and it will appear here.
            </p>
          </div>
        ) : (
          <ul data-testid="upcoming-list" className="space-y-3">{upcoming.map(card)}</ul>
        )}
      </div>

      {/* Service history — the record a future maintenance recommendation reads. */}
      <div className="relative overflow-hidden glass-panel p-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          History
        </span>
        <h3 className="text-xl font-semibold text-white tracking-tight mb-6">Service history</h3>
        {past.length === 0 ? (
          <div data-testid="history-empty"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-white font-medium mb-1">Nothing here yet</p>
            <p className="text-zinc-400 text-sm font-light">
              Completed, cancelled and declined appointments are kept here.
            </p>
          </div>
        ) : (
          <ul data-testid="history-list" className="space-y-3">{past.map(card)}</ul>
        )}
      </div>
    </div>
  );
}
