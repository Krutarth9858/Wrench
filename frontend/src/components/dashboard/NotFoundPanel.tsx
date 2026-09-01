import { Link } from 'react-router-dom';

/**
 * Rendered by the dashboard's catch-all. Previously an unmatched path (a stale
 * link, or a customer opening a mechanic-only route) fell through every <Route>
 * and painted an unexplained blank panel.
 *
 * It deliberately says nothing about whether the route exists for another role —
 * a customer must not learn anything about the mechanic surface from this.
 */
export default function NotFoundPanel() {
  return (
    <div data-testid="dashboard-not-found" className="relative overflow-hidden glass-panel p-8">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
        Not found
      </span>
      <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Page not found</h2>
      <p className="text-zinc-400 text-sm font-light mb-6">
        This page isn't available on your account.
      </p>
      <Link to="/dashboard" className="inline-flex h-11 items-center rounded-2xl bg-emerald-500 px-6 text-sm font-semibold text-zinc-950">
        Back to Dashboard
      </Link>
    </div>
  );
}
