import { useEffect, useState } from 'react';
import { listBookings } from '../../lib/booking';

/**
 * Wrench does not track money yet — there is no price, payment or payout field
 * anywhere in the backend, so there is no revenue to report and inventing some
 * would be a lie the mechanic might act on.
 *
 * The job count is counted from the mechanic's own COMPLETED bookings rather than
 * `MechanicProfile.completed_jobs`, which is declared but never incremented by
 * any code path and so always reads 0.
 */
export default function MechanicEarnings() {
  const [completed, setCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    listBookings(['COMPLETED'])
      .then((rows) => active && setCompleted(rows.length))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="relative overflow-hidden glass-panel p-8">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
        Payments
      </span>
      <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Earnings</h2>
      <p className="text-zinc-400 text-sm font-light mb-8">
        Your completed-service earnings will appear here.
      </p>

      {loading ? (
        <p data-testid="earnings-loading" className="text-zinc-500 text-sm">Loading…</p>
      ) : (
        <div data-testid="earnings-empty" className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 block">
              Completed services
            </span>
            <p data-testid="completed-jobs" className="text-white text-3xl font-semibold tracking-tight">
              {completed}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-white font-medium mb-1">Payment tracking isn't available yet</p>
            <p className="text-zinc-400 text-sm font-light">
              Wrench doesn't record pricing or payments for a job, so there are no
              figures to report. Settle payment directly with the customer for now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
