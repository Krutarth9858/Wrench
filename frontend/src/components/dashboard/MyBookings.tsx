import { useCallback, useEffect, useState } from 'react';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import type { ConnectionState } from '../../lib/realtime';
import { actOnBooking, listBookings, type Booking } from '../../lib/booking';
import BookingStatusBadge from './BookingStatusBadge';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';

const CANCELLABLE = new Set(['PENDING', 'ACCEPTED']);

export default function MyBookings() {
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
      setError(err instanceof Error ? err.message : 'Could not load your bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime updates; every event and reconnection refetches over REST.
  useBookingRealtime('customer', load, setConnection);

  const cancel = async (id: string) => {
    setBusyId(id);
    setError('');
    try {
      const updated = await actOnBooking(id, 'cancel');
      setBookings((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel that booking.');
    } finally {
      setBusyId('');
    }
  };

  if (loading) {
    return (
      <div data-testid="bookings-loading" className="bg-[#18181B] rounded-[40px] p-8 border border-white/5 text-zinc-500 text-sm">
        Loading your bookings…
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
            Service requests
          </span>
          <h2 className="text-2xl font-semibold text-white tracking-tight">My bookings</h2>
        </div>
        <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void load()}
          data-testid="refresh-bookings"
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
        <div data-testid="bookings-error" role="alert" className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {bookings.length === 0 ? (
        <div data-testid="bookings-empty" className="p-6 rounded-2xl border border-white/10 bg-white/5 text-zinc-400 text-sm">
          No bookings yet. Find a mechanic to request roadside assistance.
        </div>
      ) : (
        <ul data-testid="bookings-list" className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} data-testid={`booking-${b.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-white font-medium">{b.mechanic.name}</h3>
                  <p className="text-zinc-500 text-sm font-light">
                    {VEHICLE_TYPE_LABELS[b.vehicle_type]}
                    {b.vehicle ? ` · ${b.vehicle.brand} ${b.vehicle.model}` : ''}
                  </p>
                  <p className="text-zinc-400 text-sm mt-2">{b.problem_description}</p>
                  <p className="text-zinc-600 text-xs mt-1">
                    {b.service_address || `${b.service_latitude}, ${b.service_longitude}`}
                    {b.created_at ? ` · ${new Date(b.created_at).toLocaleString()}` : ''}
                  </p>
                </div>
                <BookingStatusBadge status={b.status} />
              </div>
              {CANCELLABLE.has(b.status) && (
                <button
                  type="button"
                  onClick={() => void cancel(b.id)}
                  disabled={busyId === b.id}
                  data-testid={`cancel-${b.id}`}
                  className="mt-4 h-9 px-4 rounded-xl border border-red-500/30 text-red-300 text-sm disabled:opacity-50 hover:bg-red-500/10"
                >
                  {busyId === b.id ? 'Cancelling…' : 'Cancel booking'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
