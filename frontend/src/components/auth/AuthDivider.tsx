/** The hairline "or" between password and provider sign-in. Matches the
 *  existing login typography rather than introducing a new rule style. */
export default function AuthDivider() {
  return (
    <div className="flex items-center gap-[12px]" aria-hidden="true">
      <span className="flex-1 h-px bg-white/10" />
      <span className="font-mono font-medium text-[9px] leading-none tracking-[0.2em] text-[#F0F4F2]/35">
        OR
      </span>
      <span className="flex-1 h-px bg-white/10" />
    </div>
  );
}
