import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft } from '@phosphor-icons/react';
import { WrenchLogo } from '../ui/WrenchLogo';
import MobileBottomNav from './MobileBottomNav';
import { INK, SAFE_TOP, TAP } from './mobileTokens';

interface Props {
  children: ReactNode;
  /** Context title. Omitted on Home, where the logo carries the identity. */
  title?: string;
  /** Shows a back affordance instead of the logo. */
  onBack?: () => void;
  action?: ReactNode;
  isMechanic?: boolean;
  /** Full-bleed screens (the map) opt out of padding and of the scroll box. */
  bleed?: boolean;
  hideNav?: boolean;
}

/**
 * The authenticated mobile app shell: compact header, scrolling content, tab bar.
 *
 * Deliberately not the desktop chrome — no FloatingNavbar, no sidebar. Content
 * scrolls in its own region between two fixed bars, and the bottom padding
 * clears the tab bar plus the home indicator so nothing is ever trapped
 * underneath it.
 */
export default function MobileShell({
  children, title, onBack, action, isMechanic = false, bleed = false, hideNav = false,
}: Props) {
  const navigate = useNavigate();
  const NAV_HEIGHT = 56;

  return (
    <div
      data-testid="mobile-shell"
      className="fixed inset-0 flex flex-col overflow-hidden text-[#F0F4F2] font-sans"
      style={{ background: INK }}
    >
      <header
        className="relative z-[300] flex items-center gap-3 px-4 shrink-0 border-b border-white/[0.07]"
        style={{
          paddingTop: `calc(${SAFE_TOP} + 10px)`,
          paddingBottom: 10,
          background: 'rgba(10,10,11,0.82)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        }}
      >
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            data-testid="mobile-back"
            className="-ml-2 flex items-center justify-center rounded-full text-[#F0F4F2]/80 active:bg-white/10"
            style={{ width: TAP, height: TAP }}
          >
            <CaretLeft weight="bold" className="w-5 h-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            aria-label="Wrench home"
            className="flex items-center shrink-0"
            style={{ minHeight: TAP }}
          >
            <WrenchLogo animated={false} compact />
          </button>
        )}

        {title && (
          <h1 className="m-0 font-semibold text-[17px] leading-none tracking-[-0.01em] truncate">
            {title}
          </h1>
        )}

        <div className="ml-auto flex items-center gap-2 shrink-0">{action}</div>
      </header>

      <main
        data-testid="mobile-content"
        className={`flex-1 min-h-0 ${bleed ? 'relative' : 'overflow-y-auto overscroll-contain'}`}
        style={
          bleed
            ? undefined
            : { padding: '18px 18px', paddingBottom: hideNav ? 32 : NAV_HEIGHT + 44 }
        }
      >
        {children}
      </main>

      {!hideNav && <MobileBottomNav isMechanic={isMechanic} />}
    </div>
  );
}
