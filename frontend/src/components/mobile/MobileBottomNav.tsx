import { NavLink } from 'react-router-dom';
import {
  House, MapPin, Toolbox, CalendarCheck, User, Tray, Clock, ToggleRight,
} from '@phosphor-icons/react';
import { SAFE_BOTTOM, TAP } from './mobileTokens';

interface Item {
  to: string;
  label: string;
  icon: React.ReactNode;
  /** Exact match, so "Home" is not active on every nested route. */
  end?: boolean;
}

const CUSTOMER: Item[] = [
  { to: '/dashboard', label: 'Home', icon: <House weight="regular" className="w-[22px] h-[22px]" />, end: true },
  { to: '/dashboard/find', label: 'Find', icon: <MapPin weight="regular" className="w-[22px] h-[22px]" /> },
  { to: '/dashboard/bookings', label: 'Bookings', icon: <Toolbox weight="regular" className="w-[22px] h-[22px]" /> },
  { to: '/dashboard/appointments', label: 'Service', icon: <CalendarCheck weight="regular" className="w-[22px] h-[22px]" /> },
  { to: '/dashboard/profile-m', label: 'Profile', icon: <User weight="regular" className="w-[22px] h-[22px]" /> },
];

const MECHANIC: Item[] = [
  { to: '/dashboard', label: 'Home', icon: <House weight="regular" className="w-[22px] h-[22px]" />, end: true },
  { to: '/dashboard/requests', label: 'Requests', icon: <Tray weight="regular" className="w-[22px] h-[22px]" /> },
  { to: '/dashboard/appointments', label: 'Service', icon: <CalendarCheck weight="regular" className="w-[22px] h-[22px]" /> },
  { to: '/dashboard/history', label: 'History', icon: <Clock weight="regular" className="w-[22px] h-[22px]" /> },
  { to: '/dashboard/availability', label: 'Status', icon: <ToggleRight weight="regular" className="w-[22px] h-[22px]" /> },
];

/**
 * The mobile tab bar. Fixed to the bottom so every primary destination is in
 * thumb reach, and padded for the home indicator rather than sitting under it.
 */
export default function MobileBottomNav({ isMechanic }: { isMechanic: boolean }) {
  const items = isMechanic ? MECHANIC : CUSTOMER;

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-[400] border-t border-white/10"
      style={{
        paddingBottom: SAFE_BOTTOM,
        background: 'rgba(10,10,11,0.88)',
        backdropFilter: 'blur(24px) saturate(160%)',
        WebkitBackdropFilter: 'blur(24px) saturate(160%)',
      }}
    >
      <ul className="flex items-stretch">
        {items.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-[3px] w-full transition-colors ${
                  isActive ? 'text-[#3ECF8E]' : 'text-[#F0F4F2]/45 active:text-[#F0F4F2]/80'
                }`
              }
              style={{ minHeight: TAP + 12 }}
            >
              {item.icon}
              <span className="text-[10px] font-medium leading-none tracking-[0.01em]">
                {item.label}
              </span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
