import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMechanicProfile, VEHICLE_TYPE_LABELS, type MechanicProfile } from '../../lib/mechanic';

/**
 * The backend has no separate scheduling resource — the only real schedule data
 * is the working window, availability and coverage already stored on the mechanic
 * profile. This surfaces that honestly and sends edits to the profile page that
 * owns them, rather than inventing a second scheduling system.
 */
export default function MechanicSchedule() {
  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getMechanicProfile()
      .then((p) => active && setProfile(p))
      .catch(() => active && setError('no-profile'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  return (
    <div className="relative overflow-hidden glass-panel p-8">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-3 block">
        Availability
      </span>
      <h2 className="text-2xl font-semibold text-white tracking-tight mb-2">Schedule</h2>
      <p className="text-zinc-400 text-sm font-light mb-8">
        Manage when you're available for roadside assistance.
      </p>

      {loading && <p data-testid="schedule-loading" className="text-zinc-500 text-sm">Loading your schedule…</p>}

      {!loading && error && (
        <div data-testid="schedule-empty" className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <p className="text-white font-medium mb-1">No schedule yet</p>
          <p className="text-zinc-400 text-sm font-light mb-5">
            Set up your garage profile to choose the hours you accept roadside jobs.
          </p>
          <Link to="/dashboard/profile" className="inline-flex h-10 items-center rounded-2xl bg-emerald-500 px-5 text-sm font-semibold text-zinc-950">
            Set up profile
          </Link>
        </div>
      )}

      {!loading && profile && (
        <div data-testid="schedule-content" className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div>
              <p className="text-white font-medium">
                {profile.is_available ? 'Accepting requests' : 'Not accepting requests'}
              </p>
              <p className="text-zinc-400 text-sm font-light mt-0.5">
                Customers can only be matched with you while you are available.
              </p>
            </div>
            <span className={`inline-flex items-center gap-2 text-xs ${profile.is_available ? 'text-emerald-400' : 'text-zinc-500'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${profile.is_available ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
              {profile.is_available ? 'Available' : 'Unavailable'}
            </span>
          </div>

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
  );
}
