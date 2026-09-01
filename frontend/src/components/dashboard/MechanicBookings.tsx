import { useCallback, useEffect, useState } from 'react';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import type { ConnectionState } from '../../lib/realtime';
import { actOnBooking, listBookings, type Booking, type BookingStatus } from '../../lib/booking';
import BookingStatusBadge from './BookingStatusBadge';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';

/** Which intents the mechanic may raise from each state — mirrors the backend
 *  state machine, which remains authoritative and re-checks every call. */
const ACTIONS: Partial<Record<BookingStatus, { action: 'accept' | 'reject' | 'start' | 'complete'; label: string; tone: string }[]>> = {
  PENDING: [
    { action: 'accept', label: 'Accept', tone: 'bg-emerald-500 text-zinc-950' },
    { action: 'reject', label: 'Decline', tone: 'border border-red-500/30 text-red-300' },
  ],
  ACCEPTED: [{ action: 'start', label: 'Start service', tone: 'bg-sky-500 text-zinc-950' }],
  IN_PROGRESS: [{ action: 'complete', label: 'Mark complete', tone: 'bg-emerald-500 text-zinc-950' }],
};

type View = 'all' | 'requests' | 'active' | 'history';

const TITLES: Record<View, string> = {
  all: 'Booking requests',
  requests: 'Incoming requests',
  active: 'Active services',
  history: 'History',
};

export default function MechanicBookings({ view = 'all' }: { view?: View }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('connecting');

  const load = useCallback(async () => {
    setError('');
    try {
      setBookings(await listBookings());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load booking requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime updates; every event and reconnection refetches over REST.
  useBookingRealtime('mechanic', load, setConnection);

  const act = async (id: string, action: 'accept' | 'reject' | 'start' | 'complete') => {
    setBusyId(id);
    setError('');
    try {
      const updated = await actOnBooking(id, action);
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that booking.');
    } finally {
      setBusyId('');
    }
  };

  const show = (section: View) => view === 'all' || view === section;
  const incoming = bookings.filter((b) => b.status === 'PENDING');
  const active = bookings.filter((b) => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS');
  const past = bookings.filter((b) =>
    ['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status),
  );

  const card = (b: Booking) => (
    <li key={b.id} data-testid={`job-${b.id}`} className="glass-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-white font-medium">
            {VEHICLE_TYPE_LABELS[b.vehicle_type]}
            {b.vehicle ? ` · ${b.vehicle.brand} ${b.vehicle.model}` : ''}
          </h3>
          <p className="text-zinc-500 text-sm font-light">
            {b.customer.name}
            {b.customer.phone_number ? ` · ${b.customer.phone_number}` : ''}
          </p>
          <p className="text-zinc-400 text-sm mt-2">{b.problem_description}</p>
          <p className="text-zinc-600 text-xs mt-1">
            {b.service_address || `${b.service_latitude}, ${b.service_longitude}`}
            {b.created_at ? ` · ${new Date(b.created_at).toLocaleString()}` : ''}
          </p>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>
      <div className="mt-4 flex items-center gap-3">
        {(ACTIONS[b.status] ?? []).map(({ action, label, tone }) => (
          <button
            key={action}
            type="button"
            onClick={() => void act(b.id, action)}
            disabled={busyId === b.id}
            data-testid={`${action}-${b.id}`}
            className={`h-9 px-4 rounded-xl text-sm font-medium disabled:opacity-50 ${tone}`}
          >
            {label}
          </button>
        ))}
      </div>
    </li>
  );

  if (loading) {
    return (
      <div data-testid="jobs-loading" className="glass-panel p-8 text-zinc-500 text-sm">
        Loading booking requests…
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden glass-panel p-8">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
            Dispatch
          </span>
          <h2 className="text-2xl font-semibold text-white tracking-tight">{TITLES[view]}</h2>
        </div>
        <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          data-testid="refresh-jobs"
          className="h-10 px-4 rounded-2xl border border-white/10 text-zinc-300 text-sm hover:text-white"
        >
          Refresh
        </button>
        <span
          data-testid="realtime-state"
          data-state={connection}
          title={connection === 'open' ? 'Live updates on' : 'Reconnecting…'}
          className={`inline-flex items-center gap-2 text-xs ${
            connection === 'open' ? 'text-emerald-400' : 'text-zinc-500'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${
            connection === 'open' ? 'bg-emerald-400' : 'bg-zinc-500 animate-pulse'
          }`} />
          {connection === 'open' ? 'Live' : 'Offline'}
        </span>
        </div>
      </div>

      {error && (
        <div data-testid="jobs-error" role="alert" className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {(view === 'all' ? bookings.length === 0
        : (view === 'requests' ? incoming : view === 'active' ? active : past).length === 0) && (
        <div data-testid="jobs-empty" className="glass-card p-6 text-zinc-400 text-sm">
          {view === 'active'
            ? 'No active services right now.'
            : view === 'history'
              ? 'No completed or closed bookings yet.'
              : 'No booking requests yet. Make sure you are marked available.'}
        </div>
      )}

      {[
        ['Incoming requests', show('requests') ? incoming : [], 'incoming'],
        ['Active service', show('active') ? active : [], 'active'],
        ['History', show('history') ? past : [], 'past'],
      ].map(([title, list, key]) =>
        (list as Booking[]).length > 0 ? (
          <section key={key as string} className="mb-8">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3">
              {title as string}
            </h3>
            <ul data-testid={`jobs-${key}`} className="space-y-3">
              {(list as Booking[]).map(card)}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
