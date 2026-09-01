import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Live-tracking panel for the Recovery Workflow section.
 *
 * Ported from the "Wrench Live Panel" design canvas. The artboard's own page
 * frame is dropped — this renders the card contents only, so it drops straight
 * into the existing rotated mockup shell on the landing page.
 *
 * Typography follows the host page (Space Grotesk / Inter) rather than the
 * artboard's Sora, so the panel reads as part of the site instead of an inset.
 */

const GREEN = '#3ECF8E';
const INK = '#F0F4F2';

/** Artboard size — the panel is drawn at this size, then scaled to its container. */
const W = 880;
const H = 616;

const mono = "ui-monospace, SFMono-Regular, Menlo, monospace";

export const WrenchLivePanel: React.FC = () => {
  const [eta, setEta] = useState(8);
  const [confidence, setConfidence] = useState(0);

  // The panel is laid out at its artboard size and scaled into whatever box it
  // is given, so every fixed px value keeps its designed proportion. CSS alone
  // can't do this: calc(100cqw / 880) is a length, and scale() needs a ratio.
  const shellRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const fit = () => setScale(shell.clientWidth / W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(shell);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // Bar grows from zero on mount so the reading looks measured, not preset.
    const settle = setTimeout(() => setConfidence(82), 480);
    const tick = setInterval(() => setEta((v) => (v > 2 ? v - 1 : 8)), 4200);
    return () => {
      clearTimeout(settle);
      clearInterval(tick);
    };
  }, []);

  return (
    <div ref={shellRef} className="w-full h-full overflow-hidden">
      <div
        className="flex flex-col origin-top-left"
        style={{
          width: `${W}px`,
          height: `${H}px`,
          padding: '26px',
          gap: '14px',
          transform: `scale(${scale})`,
          // Hidden until measured, so the panel never flashes at full size.
          visibility: scale ? 'visible' : 'hidden',
          color: INK,
        }}
      >

      {/* Mechanic identity + live status */}
      <div className="flex items-center justify-between gap-5 lp-rise" style={{ animationDelay: '80ms', marginBottom: '8px' }}>
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 flex-none">
            <span
              className="absolute inset-0 rounded-full lp-ping"
              style={{ border: `1px solid ${GREEN}80` }}
            />
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center font-space text-sm font-medium"
              style={{
                background: 'linear-gradient(150deg, rgba(62,207,142,0.22), rgba(62,207,142,0.06))',
                border: '1px solid rgba(62,207,142,0.35)',
                color: GREEN,
              }}
            >
              MV
            </div>
          </div>
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="font-space text-base font-medium tracking-[-0.01em] leading-none">MV Motors</span>
            <div className="flex items-center gap-2 text-xs font-light leading-none" style={{ color: 'rgba(240,244,242,0.5)' }}>
              <span style={{ color: 'rgba(240,244,242,0.8)' }}>★ 4.9</span>
              <span className="w-[3px] h-[3px] rounded-full" style={{ background: 'rgba(240,244,242,0.25)' }} />
              <span className="truncate">Two-wheeler specialist</span>
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 py-2 px-3.5 rounded-full flex-none"
          style={{ background: 'rgba(62,207,142,0.1)', border: '1px solid rgba(62,207,142,0.28)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full lp-pulse" style={{ background: GREEN }} />
          <span
            className="font-medium leading-none"
            style={{ fontFamily: mono, fontSize: '9.5px', letterSpacing: '0.2em', color: GREEN }}
          >
            ON THE WAY
          </span>
        </div>
      </div>

      {/* Route map */}
      <div
        className="relative flex-none rounded-[20px] overflow-hidden lp-rise"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))',
          border: '1px solid rgba(255,255,255,0.08)',
          height: '270px',
          animationDelay: '160ms',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
            backgroundSize: '52px 52px',
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(70% 90% at 78% 30%, rgba(62,207,142,0.14), transparent 60%)' }}
        />
        <div
          className="absolute left-0 right-0 h-[120px] lp-scan"
          style={{ background: 'linear-gradient(180deg, transparent, rgba(62,207,142,0.045), transparent)' }}
        />

        <svg viewBox="0 0 720 270" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
          <path
            d="M60 210 C 190 210, 200 120, 320 118 S 470 130, 560 66"
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M60 210 C 190 210, 200 120, 320 118 S 470 130, 560 66"
            fill="none"
            stroke={GREEN}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeDasharray="14 12"
            className="lp-dash"
            style={{ filter: 'drop-shadow(0 0 6px rgba(62,207,142,0.6))' }}
          />
        </svg>

        <div className="absolute left-[8.3%] top-[78%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <span
            className="w-[11px] h-[11px] rounded-full"
            style={{ background: INK, boxShadow: '0 0 0 5px rgba(240,244,242,0.14)' }}
          />
          <span
            className="font-medium leading-none"
            style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '0.16em', color: 'rgba(240,244,242,0.55)' }}
          >
            YOU
          </span>
        </div>

        <div className="absolute left-[77.8%] top-[24.4%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2">
          <span
            className="font-medium leading-none whitespace-nowrap order-first"
            style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '0.16em', color: 'rgba(62,207,142,0.9)' }}
          >
            MV MOTORS
          </span>
          <span
            className="w-[11px] h-[11px] rounded-[3px]"
            style={{ background: GREEN, boxShadow: '0 0 0 5px rgba(62,207,142,0.18)' }}
          />
        </div>

        {/* ETA readout */}
        <div
          className="absolute right-[22px] bottom-[22px] flex flex-col gap-1.5 py-3.5 px-4 rounded-2xl"
          style={{
            background: 'rgba(10,12,12,0.72)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <span
            className="font-medium leading-none"
            style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(240,244,242,0.4)' }}
          >
            ARRIVING IN
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="font-space text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{eta}</span>
            <span className="text-[13px] font-light leading-none" style={{ color: 'rgba(240,244,242,0.5)' }}>min</span>
          </div>
          <span className="text-[11px] font-light leading-none" style={{ color: 'rgba(240,244,242,0.45)' }}>
            2.4 km · via MG Road
          </span>
        </div>
      </div>

      {/* Diagnosis + estimate */}
      <div className="grid grid-cols-2 gap-3.5">
        <div
          className="flex flex-col gap-3.5 py-4 px-5 rounded-[18px] lp-rise"
          style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', animationDelay: '240ms' }}
        >
          <span
            className="font-medium leading-none"
            style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(240,244,242,0.38)' }}
          >
            AI DIAGNOSIS
          </span>
          <div className="flex flex-col gap-1.5">
            <span className="font-space text-[15px] font-medium leading-[1.25]">Battery / starter system</span>
            <span className="text-xs font-light leading-[1.5]" style={{ color: 'rgba(240,244,242,0.45)' }}>
              Based on 4 answers about cranking and lights.
            </span>
          </div>
          <div className="flex flex-col gap-[7px] mt-auto">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] font-light leading-none" style={{ color: 'rgba(240,244,242,0.45)' }}>Confidence</span>
              <span className="font-medium leading-none tabular-nums" style={{ fontFamily: mono, fontSize: '11px', color: GREEN }}>
                {confidence}%
              </span>
            </div>
            <div className="h-[3px] rounded-sm overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-sm"
                style={{
                  width: `${confidence}%`,
                  background: `linear-gradient(90deg, rgba(62,207,142,0.45), ${GREEN})`,
                  transition: 'width 900ms cubic-bezier(.2,.75,.3,1)',
                }}
              />
            </div>
          </div>
        </div>

        <div
          className="flex flex-col gap-3.5 py-4 px-5 rounded-[18px] lp-rise"
          style={{ background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.07)', animationDelay: '320ms' }}
        >
          <div className="flex items-center justify-between">
            <span
              className="font-medium leading-none"
              style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(240,244,242,0.38)' }}
            >
              ESTIMATE
            </span>
            <div className="flex items-end gap-[3px] h-4">
              {[0, 180, 360].map((delay) => (
                <span
                  key={delay}
                  className="w-[3px] h-full rounded-sm origin-bottom lp-bar"
                  style={{ background: 'rgba(62,207,142,0.55)', animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-space text-[26px] font-semibold leading-none tracking-[-0.03em]">₹450</span>
            <span className="text-xs font-light leading-none" style={{ color: 'rgba(240,244,242,0.4)' }}>– ₹1,200</span>
          </div>
          <div className="flex flex-col gap-2 mt-auto">
            <div className="flex justify-between text-xs font-light leading-none" style={{ color: 'rgba(240,244,242,0.5)' }}>
              <span>Callout</span>
              <span style={{ color: 'rgba(240,244,242,0.8)' }}>₹250</span>
            </div>
            <div className="flex justify-between text-xs font-light leading-none" style={{ color: 'rgba(240,244,242,0.5)' }}>
              <span>Parts, if needed</span>
              <span style={{ color: 'rgba(240,244,242,0.8)' }}>on approval</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 lp-rise" style={{ animationDelay: '400ms' }}>
        <button
          type="button"
          className="flex-1 h-12 rounded-[14px] font-space text-sm font-medium cursor-pointer transition-[transform,filter] duration-200 hover:brightness-110 hover:-translate-y-px active:translate-y-0"
          style={{ background: GREEN, color: '#052018', boxShadow: '0 12px 28px -16px rgba(62,207,142,0.8)' }}
        >
          Call MV Motors
        </button>
        <button
          type="button"
          className="flex-none h-12 px-5 rounded-[14px] text-sm font-normal cursor-pointer transition-colors duration-200 hover:bg-white/[0.08] hover:border-white/25"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(240,244,242,0.8)' }}
        >
          Share trip
        </button>
        </div>
      </div>
    </div>
  );
};
