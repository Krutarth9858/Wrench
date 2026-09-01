import React, { useEffect, useRef, useState } from 'react';
import { Bell } from 'lucide-react';

/**
 * Wrench has no notification store — booking events arrive as transient toasts
 * from the WebSocket channel and are never persisted, so there is no history to
 * list. The bell previously did nothing at all *and* wore a permanent unread dot,
 * which promised messages that never existed.
 *
 * It now opens and says so honestly. When a notifications resource exists on the
 * backend, render it in place of the empty state.
 */
export const NotificationBell: React.FC<{ dark?: boolean }> = ({ dark = true }) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        data-testid="notification-bell"
        aria-label="Notifications"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={
          dark
            ? 'relative w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors'
            : 'relative w-9 h-9 rounded-full flex items-center justify-center text-[#6B7280] hover:text-[#111827] transition-colors bg-black/[0.03] border border-black/[0.06]'
        }
      >
        <Bell className={dark ? 'w-5 h-5' : 'w-[18px] h-[18px]'} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          data-testid="notification-panel"
          className={`absolute right-0 top-[calc(100%+10px)] w-72 rounded-2xl p-5 z-[600] ${
            dark
              ? 'bg-[#141416] border border-white/10 text-white shadow-2xl'
              : 'bg-white border border-black/[0.06] text-[#111827] shadow-xl'
          }`}
        >
          <p className="text-sm font-semibold mb-1">Notifications</p>
          <p className={`text-sm font-light ${dark ? 'text-zinc-400' : 'text-[#6B7280]'}`}>
            No new notifications.
          </p>
          <p className={`text-xs font-light mt-3 ${dark ? 'text-zinc-500' : 'text-[#9CA3AF]'}`}>
            Booking updates appear as alerts while you have Wrench open.
          </p>
        </div>
      )}
    </div>
  );
};
