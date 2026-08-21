import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { listBookings, type Booking } from '../../lib/booking';
import { getAvailability } from '../../lib/mechanic';
import AvailabilityControl from './AvailabilityControl';
import BookingStatusBadge from './BookingStatusBadge';

/** Mechanic landing page: what needs attention right now. */
export default function MechanicOverview() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [available, setAvailable] = useState(false);
  const [hasProfile, setHasProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const [jobs, availability] = await Promise.allSettled([listBookings(), getAvailability()]);

    if (jobs.status === 'fulfilled') setBookings(jobs.value);
    else setError(jobs.reason instanceof Error ? jobs.reason.message : 'Could not load bookings.');

    if (availability.status === 'fulfilled') {
      setAvailable(availability.value.is_available);
      setHasProfile(true);
    } else if (availability.reason instanceof ApiError && availability.reason.status === 404) {
      // No profile saved yet — availability simply does not exist to toggle.
      setHasProfile(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = bookings.filter((b) => b.status === 'PENDING');
  const active = bookings.filter((b) => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS');
  const completed = bookings.filter((b) => b.status === 'COMPLETED');

  if (loading) {
    return (
      <div data-testid="overview-loading"
        className="bg-[#18181B] rounded-[40px] p-8 border border-white/5 text-zinc-500 text-sm">
        Loading your dashboard…
      </div>
    );
  }

  const tiles: [string, number, string][] = [
    ['Pending requests', pending.length, '/dashboard/requests'],
    ['Active services', active.length, '/dashboard/active'],
    ['Completed', completed.length, '/dashboard/history'],
  ];

  return (
    <div data-testid="mechanic-overview" className="space-y-6">
      <div className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          Dispatch
        </span>
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-8">Dashboard</h2>

        {error && (
          <div data-testid="overview-error" role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {tiles.map(([label, count, href]) => (
            <Link key={label} to={href} data-testid={`tile-${label.split(' ')[0].toLowerCase()}`}
              className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 hover:border-white/25 transition-colors">
              <p className="text-3xl font-semibold text-white tracking-tight">{count}</p>
              <p className="text-zinc-500 text-sm font-light mt-1">{label}</p>
            </Link>
          ))}
        </div>

        <AvailabilityControl available={available} enabled={hasProfile}
          onChange={setAvailable} onError={setError} />

        {!hasProfile && (
          <p data-testid="profile-prompt" className="text-zinc-500 text-sm mt-4">
            Finish your <Link to="/dashboard/profile" className="text-emerald-400">garage profile</Link>{' '}
            so customers can find you.
          </p>
        )}
      </div>

      {/* What needs attention first */}
      {pending.length > 0 && (
        <div className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium">Newest request</h3>
            <Link to="/dashboard/requests" className="text-emerald-400 text-sm">View all</Link>
          </div>
          <div data-testid="overview-newest"
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-white font-medium">{pending[0].problem_description}</p>
                <p className="text-zinc-500 text-sm font-light mt-1">{pending[0].customer.name}</p>
              </div>
              <BookingStatusBadge status={pending[0].status} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
