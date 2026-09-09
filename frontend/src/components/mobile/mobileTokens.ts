/**
 * Mobile design tokens.
 *
 * The same identity as desktop Wrench — near-black ground, restrained green,
 * glass used sparingly — retuned for a phone: bigger touch targets, tighter
 * type scale, more generous vertical rhythm.
 */

export const INK = '#0A0A0B';
export const SURFACE = 'rgba(255,255,255,0.04)';
export const BORDER = 'rgba(255,255,255,0.10)';
export const TEXT = '#F0F4F2';
export const MUTED = 'rgba(240,244,242,0.55)';
export const FAINT = 'rgba(240,244,242,0.35)';
export const BRAND = '#3ECF8E';
export const BRAND_INK = '#052018';
export const DANGER = '#E07864';

/** Comfortable minimum for a thumb. Everything tappable clears this. */
export const TAP = 44;

/** iOS notch/home-indicator clearance. No-ops on devices without insets. */
export const SAFE_TOP = 'env(safe-area-inset-top, 0px)';
export const SAFE_BOTTOM = 'env(safe-area-inset-bottom, 0px)';

/** One card surface, used everywhere so mobile never drifts from itself. */
export const CARD =
  'rounded-[18px] border border-white/10 bg-white/[0.04] backdrop-blur-xl';

/** Full-width primary action. */
export const PRIMARY_BUTTON =
  'w-full h-[52px] rounded-[16px] bg-[#3ECF8E] text-[#052018] font-semibold ' +
  'text-[15px] flex items-center justify-center gap-2 active:brightness-95 ' +
  'transition-all disabled:opacity-45 disabled:cursor-not-allowed ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-[#3ECF8E]';

export const SECONDARY_BUTTON =
  'w-full h-[52px] rounded-[16px] border border-white/12 bg-white/[0.05] ' +
  'text-[#F0F4F2] font-medium text-[15px] flex items-center justify-center gap-2 ' +
  'active:bg-white/[0.09] transition-all';
