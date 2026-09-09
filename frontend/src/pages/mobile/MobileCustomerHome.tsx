import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, CalendarCheck, Sparkle, CaretRight } from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth';
import {
  listBookings, STATUS_LABELS, TERMINAL_STATUSES, type Booking,
} from '../../lib/booking';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { useBookingRealtime } from '../../hooks/useBookingRealtime';
import { ErrorState } from '../../components/ui/StateMessage';
import { CARD, PRIMARY_BUTTON, SECONDARY_BUTTON, TAP } from '../../components/mobile/mobileTokens';

/**
 * The mobile customer home.
 *
 * Ordered by what someone standing next to a broken-down vehicle needs: an
 * active request first, then the way to start a new one. Everything else is
 * secondary and sits below the fold on purpose.
 *
 * Uses the same `listBookings` and realtime channel as desktop — only the
 * presentation is new.
 */
export default function MobileCustomerHome() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      setBookings(await listBookings());
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useBookingRealtime('customer', load);

  const active = bookings.find((b) => !TERMINAL_STATUSES.has(b.status));
  const recent = bookings.find((b) => TERMINAL_STATUSES.has(b.status));
  const firstName = (user?.email ?? '').split('@')[0];

  return (
    <div data-testid="m-home" className="space-y-5">
      <header>
        <p className="m-0 text-[13px] text-[#F0F4F2]/45">Welcome back</p>
        <h2 className="m-0 mt-0.5 font-semibold text-[24px] leading-tight tracking-[-0.02em] truncate">
          {firstName || 'there'}
        </h2>
      </header>

      {error ? <ErrorState error={error} onRetry={() => void load()} testId="m-home-error" /> : null}

      {/* 1 — anything in flight comes first. */}
      {loading ? (
        <div className={`${CARD} p-5`}>
          <p className="m-0 text-[13px] text-[#F0F4F2]/45">Loading your assistance…</p>
        </div>
      ) : active ? (
        <button
          type="button"
          onClick={() => navigate('/dashboard/bookings')}
          className="w-full text-left"
          data-testid="m-home-active"
          aria-label="View your active request"
        >
          <div className={`${CARD} p-5 border-[#3ECF8E]/35`}>
            <div className="flex items-center gap-2">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#3ECF8E] opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#3ECF8E]" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#3ECF8E]">
                Assistance in progress
              </span>
            </div>
            <p className="m-0 mt-3 font-semibold text-[17px] tracking-[-0.01em]">
              {STATUS_LABELS[active.status]}
            </p>
            <p className="m-0 mt-1 text-[13px] text-[#F0F4F2]/55">
              {active.mechanic.name} · {VEHICLE_TYPE_LABELS[active.vehicle_type]}
            </p>
            <p className="m-0 mt-0.5 text-[12.5px] text-[#F0F4F2]/35 truncate">
              {active.problem_description}
            </p>
          </div>
        </button>
      ) : null}

      {/* 2 — the primary action. */}
      <div className="space-y-2.5">
        <button type="button" onClick={() => navigate('/dashboard/find')}
          data-testid="m-home-find" className={PRIMARY_BUTTON}>
          <MapPin weight="fill" className="w-[18px] h-[18px]" />
          Find a Mechanic
        </button>
        <button type="button" onClick={() => navigate('/dashboard/schedule-service')}
          data-testid="m-home-schedule" className={SECONDARY_BUTTON}>
          <CalendarCheck weight="regular" className="w-[18px] h-[18px]" />
          Schedule a Service
        </button>
      </div>

      {/* 3 — quick actions. */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Troubleshoot', hint: 'Ask Wrench AI', to: '/dashboard/troubleshoot',
            icon: <Sparkle weight="regular" className="w-[18px] h-[18px] text-[#3ECF8E]" /> },
          { label: 'Appointments', hint: 'Scheduled work', to: '/dashboard/appointments',
            icon: <CalendarCheck weight="regular" className="w-[18px] h-[18px] text-[#3ECF8E]" /> },
        ].map((a) => (
          <button key={a.label} type="button" onClick={() => navigate(a.to)}
            data-testid={`m-home-quick-${a.label.toLowerCase()}`}
            className={`${CARD} p-4 text-left active:bg-white/[0.07] transition-colors`}
            style={{ minHeight: TAP + 32 }}>
            {a.icon}
            <p className="m-0 mt-2.5 font-medium text-[14px]">{a.label}</p>
            <p className="m-0 mt-0.5 text-[11.5px] text-[#F0F4F2]/40">{a.hint}</p>
          </button>
        ))}
      </div>

      {/* 4 — recent history, last. */}
      {recent && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="m-0 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0F4F2]/40">
              Recent
            </h3>
            <button type="button" onClick={() => navigate('/dashboard/bookings')}
              className="flex items-center gap-0.5 text-[12.5px] text-[#3ECF8E]">
              All <CaretRight weight="bold" className="w-3 h-3" />
            </button>
          </div>
          <div className={`${CARD} p-4`} data-testid="m-home-recent">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 font-medium text-[14.5px] truncate">{recent.mechanic.name}</p>
                <p className="m-0 mt-0.5 text-[12.5px] text-[#F0F4F2]/45 truncate">
                  {VEHICLE_TYPE_LABELS[recent.vehicle_type]} · {recent.problem_description}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-[#F0F4F2]/40">
                {STATUS_LABELS[recent.status]}
              </span>
            </div>
          </div>
        </section>
      )}

      {!loading && !active && !recent && (
        <div className={`${CARD} p-5`} data-testid="m-home-empty">
          <p className="m-0 font-medium text-[15px]">No assistance yet</p>
          <p className="m-0 mt-1 text-[13px] text-[#F0F4F2]/55">
            When you request help or book a service, it will show up here so you
            can follow it at a glance.
          </p>
        </div>
      )}
    </div>
  );
}
