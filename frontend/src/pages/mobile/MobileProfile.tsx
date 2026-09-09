import { useNavigate } from 'react-router-dom';
import {
  User, Car, Bell, ShieldCheck, SignOut, CaretRight, CheckCircle, Warning,
} from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth';
import { CARD, TAP } from '../../components/mobile/mobileTokens';

interface Row {
  label: string;
  hint?: string;
  icon: React.ReactNode;
  to?: string;
}

/**
 * Mobile settings: a plain grouped list, the pattern phones already teach.
 * No sidebar, no dashboard panels.
 */
export default function MobileProfile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isMechanic = user?.role === 'MECHANIC';

  const rows: Row[] = isMechanic
    ? [
        { label: 'Garage profile', hint: 'Details customers see', icon: <User weight="regular" className="w-[18px] h-[18px]" />, to: '/dashboard/profile' },
        { label: 'Availability', hint: 'Accepting requests', icon: <Bell weight="regular" className="w-[18px] h-[18px]" />, to: '/dashboard/availability' },
        { label: 'Earnings', hint: 'Completed work', icon: <ShieldCheck weight="regular" className="w-[18px] h-[18px]" />, to: '/dashboard/earnings' },
      ]
    : [
        { label: 'Account', hint: 'Name and contact', icon: <User weight="regular" className="w-[18px] h-[18px]" />, to: '/dashboard' },
        { label: 'My bookings', hint: 'Roadside assistance', icon: <Car weight="regular" className="w-[18px] h-[18px]" />, to: '/dashboard/bookings' },
        { label: 'Appointments', hint: 'Scheduled service', icon: <Bell weight="regular" className="w-[18px] h-[18px]" />, to: '/dashboard/appointments' },
      ];

  return (
    <div data-testid="m-profile" className="space-y-5">
      <div className={`${CARD} p-5 flex items-center gap-4`}>
        <div className="shrink-0 w-14 h-14 rounded-2xl bg-[#3ECF8E]/12 border border-[#3ECF8E]/25 flex items-center justify-center text-[#3ECF8E] font-semibold text-[20px]">
          {user?.email?.[0]?.toUpperCase() ?? 'W'}
        </div>
        <div className="min-w-0">
          <p className="m-0 font-semibold text-[16px] truncate">{user?.email}</p>
          <p className="m-0 mt-1 flex items-center gap-1.5 text-[12px]">
            <span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[#F0F4F2]/60">
              {isMechanic ? 'Mechanic' : 'Customer'}
            </span>
            {user?.is_email_verified ? (
              <span className="inline-flex items-center gap-1 text-[#3ECF8E]">
                <CheckCircle weight="fill" className="w-3.5 h-3.5" /> Verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[#F0F4F2]/40">
                <Warning weight="regular" className="w-3.5 h-3.5" /> Unverified
              </span>
            )}
          </p>
        </div>
      </div>

      {!user?.is_email_verified && (
        <button type="button" onClick={() => navigate('/verify-email')}
          data-testid="m-profile-verify"
          className={`${CARD} w-full p-4 text-left active:bg-white/[0.07]`}
          style={{ minHeight: TAP }}>
          <p className="m-0 font-medium text-[14.5px]">Verify your email</p>
          <p className="m-0 mt-0.5 text-[12.5px] text-[#F0F4F2]/50">
            Confirm your address so we can reach you about a booking.
          </p>
        </button>
      )}

      <ul className={`${CARD} overflow-hidden divide-y divide-white/[0.07]`}>
        {rows.map((row) => (
          <li key={row.label}>
            <button type="button" onClick={() => row.to && navigate(row.to)}
              data-testid={`m-profile-${row.label.split(' ')[0].toLowerCase()}`}
              className="w-full flex items-center gap-3.5 px-4 text-left active:bg-white/[0.05]"
              style={{ minHeight: TAP + 12 }}>
              <span className="text-[#3ECF8E]">{row.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-[14.5px]">{row.label}</span>
                {row.hint && (
                  <span className="block text-[12px] text-[#F0F4F2]/40">{row.hint}</span>
                )}
              </span>
              <CaretRight weight="bold" className="w-4 h-4 text-[#F0F4F2]/25 shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      <button type="button" data-testid="m-profile-logout"
        onClick={() => { void logout(); navigate('/'); }}
        className={`${CARD} w-full flex items-center justify-center gap-2 text-[#EFB2A4] font-medium text-[14.5px] active:bg-[#E07864]/10`}
        style={{ minHeight: TAP + 8 }}>
        <SignOut weight="regular" className="w-[18px] h-[18px]" />
        Sign out
      </button>
    </div>
  );
}
