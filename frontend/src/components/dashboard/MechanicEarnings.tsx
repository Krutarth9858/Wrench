import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listBookings, type Booking } from '../../lib/booking';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';

/**
 * Wrench does not track money. There is no price, payment or payout column
 * anywhere in the backend, so this page reports the work that was actually done
 * — real COMPLETED bookings — and says plainly that figures do not exist rather
 * than inventing amounts a mechanic might act on.
 *
 * The job count is derived from the mechanic's own COMPLETED bookings rather than
 * `MechanicProfile.completed_jobs`, which is declared but never incremented by
 * any code path and so always reads 0.
 */

/** A COMPLETED booking's `updated_at` is the moment it was completed. */
const completedAt = (b: Booking): Date | null =>
  b.updated_at ? new Date(b.updated_at) : b.created_at ? new Date(b.created_at) : null;

const MONTH = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });

/** Completed jobs bucketed by completion month, newest month first. */
function byMonth(jobs: Booking[]): [string, Booking[]][] {
  const groups = new Map<string, Booking[]>();
  for (const job of jobs) {
    const at = completedAt(job);
    const key = at ? MONTH.format(at) : 'Date unknown';
    groups.set(key, [...(groups.get(key) ?? []), job]);
  }
  return [...groups.entries()];
}

export default function MechanicEarnings() {
  const [completed, setCompleted] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      // Server-side filter: the mechanic's own completed jobs, nothing else.
      const jobs = await listBookings(['COMPLETED']);
      jobs.sort((a, b) => (completedAt(b)?.getTime() ?? 0) - (completedAt(a)?.getTime() ?? 0));
      setCompleted(jobs);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your completed jobs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Existing realtime channel: a job completed elsewhere lands here without polling.
  useBookingRealtime('mechanic', load);

  const now = new Date();
  const thisMonth = completed.filter((b) => {
    const at = completedAt(b);
    return !!at && at.getMonth() === now.getMonth() && at.getFullYear() === now.getFullYear();
  });
  const latest = completed[0] ? completedAt(completed[0]) : null;

  if (loading) {
    return (
      <div data-testid="earnings-loading" className="glass-panel p-8 text-zinc-500 text-sm">
        Loading your completed jobs…
      </div>
    );
  }

  const tiles: [string, string, string][] = [
    ['Completed services', String(completed.length), 'completed-jobs'],
    ['This month', String(thisMonth.length), 'completed-this-month'],
    ['Last completed', latest ? latest.toLocaleDateString() : '—', 'last-completed'],
  ];

  return (
    <div data-testid="mechanic-earnings" className="space-y-6">
      <div className="relative overflow-hidden glass-panel p-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          Payments
        </span>
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Earnings</h2>
        <p className="text-zinc-400 text-sm font-light mb-8">
          The work you have completed on Wrench.
        </p>

        {error && (
          <div data-testid="earnings-error" role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {tiles.map(([label, value, testid]) => (
            <div key={label} className="glass-card p-5">
              <p data-testid={testid} className="text-3xl font-semibold text-white tracking-tight">{value}</p>
              <p className="text-zinc-500 text-sm font-light mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Stated plainly, because the alternative is a number that is not real. */}
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-white font-medium mb-1">Payment tracking isn't available yet</p>
          <p className="text-zinc-400 text-sm font-light">
            Wrench doesn't record pricing or payments for a job, so there are no
            figures to report. Settle payment directly with the customer for now.
          </p>
        </div>
      </div>

      <div className="relative overflow-hidden glass-panel p-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          History
        </span>
        <h3 className="text-xl font-semibold text-white tracking-tight mb-6">Completed jobs</h3>

        {completed.length === 0 ? (
          <div data-testid="earnings-empty" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-white font-medium mb-1">No completed jobs yet</p>
            <p className="text-zinc-400 text-sm font-light mb-5">
              Finish a service and it will be listed here with the date you completed it.
            </p>
            <Link to="/dashboard/requests"
              className="inline-flex h-10 items-center rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950">
              View requests
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {byMonth(completed).map(([month, jobs]) => (
              <div key={month} data-testid={`month-${month}`}>
                <div className="flex items-baseline justify-between gap-4 mb-3">
                  <p className="text-white text-sm font-medium">{month}</p>
                  <p className="text-zinc-500 text-xs font-light">
                    {jobs.length} job{jobs.length === 1 ? '' : 's'}
                  </p>
                </div>
                <ul className="space-y-3">
                  {jobs.map((b) => {
                    const at = completedAt(b);
                    return (
                      <li key={b.id} data-testid={`completed-${b.id}`} className="glass-card p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h4 className="text-white font-medium truncate">
                              {VEHICLE_TYPE_LABELS[b.vehicle_type]}
                              {b.vehicle ? ` · ${b.vehicle.brand} ${b.vehicle.model}` : ''}
                            </h4>
                            <p className="text-zinc-400 text-sm mt-1">{b.problem_description}</p>
                            <p className="text-zinc-600 text-xs mt-1 truncate">
                              {b.customer.name}
                              {b.service_address ? ` · ${b.service_address}` : ''}
                            </p>
                          </div>
                          <span className="text-zinc-500 text-xs shrink-0">
                            {at ? at.toLocaleDateString() : ''}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
