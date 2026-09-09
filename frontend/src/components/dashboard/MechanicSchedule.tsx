import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { listBookings, type Booking } from '../../lib/booking';
import { getMechanicProfile, VEHICLE_TYPE_LABELS, type MechanicProfile } from '../../lib/mechanic';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import AvailabilityControl from './AvailabilityControl';
import BookingStatusBadge from './BookingStatusBadge';

/**
 * The backend has no separate scheduling resource. The only real schedule data is
 * the working window, coverage and availability on the mechanic profile, plus the
 * mechanic's own bookings — so this page is those two things and nothing invented.
 *
 * Availability is edited here through the same `AvailabilityControl` the profile
 * and dashboard use, so there remains exactly one way to change it. Everything
 * else on the profile (hours, radius) is still owned by the profile page.
 */
export default function MechanicSchedule() {
  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [available, setAvailable] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  /** A missing profile is an empty state; anything else is a real failure. */
  const [noProfile, setNoProfile] = useState(false);
  /* Tracked separately so a successful booking refresh cannot clear a profile
     failure that is still on screen, and vice versa. Rendered as one banner. */
  const [profileError, setProfileError] = useState('');
  const [bookingsError, setBookingsError] = useState('');
  const [loading, setLoading] = useState(true);

  /**
   * `withProfile` is false for realtime refreshes. A booking event can only
   * change bookings — the profile changes when the mechanic edits it, which the
   * profile page owns — so refetching it on every event (and on the socket's
   * first resync) was a second request for data that could not have changed.
   */
  const load = useCallback(async (withProfile: boolean) => {
    const [profileResult, bookingResult] = await Promise.allSettled([
      withProfile ? getMechanicProfile() : Promise.resolve(null),
      listBookings(),
    ]);

    if (profileResult.status === 'fulfilled') {
      // `null` only when this refresh deliberately skipped the profile.
      if (profileResult.value) {
        setProfile(profileResult.value);
        setAvailable(profileResult.value.is_available);
        setNoProfile(false);
        setProfileError('');
      }
    } else if (profileResult.reason instanceof ApiError && profileResult.reason.status === 404) {
      setNoProfile(true); // no profile saved yet — an empty state, not an error
      setProfileError('');
    } else {
      setProfileError(profileResult.reason instanceof Error
        ? profileResult.reason.message : 'Could not load your schedule.');
    }

    if (bookingResult.status === 'fulfilled') {
      setBookings(bookingResult.value);
      setBookingsError('');
    } else {
      setBookingsError(bookingResult.reason instanceof Error
        ? bookingResult.reason.message : 'Could not load your scheduled work.');
    }

    setLoading(false);
  }, []);

  useEffect(() => { void load(true); }, [load]);

  // Same realtime channel the other mechanic panels use: events refetch over
  // REST, so accepting a job elsewhere shows up here without polling.
  const refreshBookings = useCallback(() => load(false), [load]);
  useBookingRealtime('mechanic', refreshBookings);

  // One banner, profile failure first — the order the combined state used.
  const error = profileError || bookingsError;

  // Committed work first, then requests still awaiting an answer. Both are real
  // rows; neither is a schedule the backend actually stores.
  const committed = bookings.filter((b) => b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS');
  const awaiting = bookings.filter((b) => b.status === 'PENDING');

  const jobRow = (b: Booking) => (
    <li key={b.id} data-testid={`scheduled-${b.id}`} className="glass-card p-5">
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
            {b.created_at ? ` · ${new Date(b.created_at).toLocaleString()}` : ''}
          </p>
        </div>
        <BookingStatusBadge status={b.status} />
      </div>
    </li>
  );

  return (
    <div data-testid="mechanic-schedule" className="space-y-6">
      <div className="relative overflow-hidden glass-panel p-8">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
          Availability
        </span>
        <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Schedule</h2>
        <p className="text-zinc-400 text-sm font-light mb-8">
          Manage when you're available for roadside assistance.
        </p>

        {error && (
          <div data-testid="schedule-error" role="alert"
            className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {loading && (
          <p data-testid="schedule-loading" className="text-zinc-500 text-sm">Loading your schedule…</p>
        )}

        {!loading && noProfile && (
          <div data-testid="schedule-empty" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
            <p className="text-white font-medium mb-1">No schedule yet</p>
            <p className="text-zinc-400 text-sm font-light mb-5">
              Set up your garage profile to choose the hours you accept roadside jobs.
            </p>
            <Link to="/dashboard/profile"
              className="inline-flex h-10 items-center rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950">
              Set up profile
            </Link>
          </div>
        )}

        {!loading && profile && (
          <div data-testid="schedule-content" className="space-y-4">
            {/* The one availability switch, shared with the profile and dashboard. */}
            <AvailabilityControl
              available={available}
              enabled
              onChange={setAvailable}
              onError={setProfileError}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 block">
                  Working hours
                </span>
                <p data-testid="working-hours" className="text-white text-xl font-semibold tracking-tight">
                  {profile.working_start_time} – {profile.working_end_time}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 block">
                  Service radius
                </span>
                <p className="text-white text-xl font-semibold tracking-tight">{profile.service_radius_km} km</p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2 block">
                Vehicles you cover
              </span>
              <p className="text-white text-sm">
                {profile.supported_vehicle_types.map((t) => VEHICLE_TYPE_LABELS[t]).join(', ')}
              </p>
            </div>

            <p className="text-zinc-500 text-xs font-light pt-2">
              Wrench does not support per-day scheduling yet — these hours apply every day.{' '}
              <Link to="/dashboard/profile" className="text-emerald-400 hover:text-emerald-300">Edit in Profile</Link>
            </p>
          </div>
        )}
      </div>

      {/* Scheduled work — real bookings, not a calendar the backend cannot fill. */}
      {!loading && !noProfile && (
        <div className="relative overflow-hidden glass-panel p-8">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
            Upcoming
          </span>
          <h3 className="text-xl font-semibold text-white tracking-tight mb-6">Scheduled work</h3>

          {committed.length === 0 && awaiting.length === 0 ? (
            <div data-testid="scheduled-empty" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <p className="text-white font-medium mb-1">Nothing scheduled</p>
              <p className="text-zinc-400 text-sm font-light">
                {available
                  ? 'You are available — new requests will appear here as customers send them.'
                  : 'You are unavailable, so customers cannot be matched with you right now.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {committed.length > 0 && (
                <div>
                  <p className="text-zinc-500 text-xs font-light mb-3">
                    {committed.length} job{committed.length === 1 ? '' : 's'} you have committed to
                  </p>
                  <ul data-testid="scheduled-committed" className="space-y-3">{committed.map(jobRow)}</ul>
                </div>
              )}
              {awaiting.length > 0 && (
                <div>
                  <p className="text-zinc-500 text-xs font-light mb-3">
                    Awaiting your response ·{' '}
                    <Link to="/dashboard/requests" className="text-emerald-400 hover:text-emerald-300">
                      Respond in Requests
                    </Link>
                  </p>
                  <ul data-testid="scheduled-awaiting" className="space-y-3">{awaiting.map(jobRow)}</ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
