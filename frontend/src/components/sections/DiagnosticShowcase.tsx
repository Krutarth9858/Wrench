import { useEffect, useState } from 'react';

/**
 * Landing-page visual only: a miniature of the Wrench product going from AI
 * diagnosis to a matched mechanic.
 *
 * Illustrative and entirely self-contained — it never calls an API, and the
 * mechanic shown is example copy, not a real record. Landing-page scope: not a
 * shared component and not used anywhere in the product.
 */

const STEPS = 5; // problem → question → result → searching → matched
const STEP_MS = 1400;

const CARD = 'glass-card';
const MUTED = 'text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35';

export default function DiagnosticShowcase() {
  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // With reduced motion the sequence is skipped and the end state is shown.
  const [step, setStep] = useState(reduceMotion ? STEPS - 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = setInterval(
      () => setStep((current) => (current + 1) % STEPS),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, [reduceMotion]);

  /** Fade/slide a block in once the sequence reaches its step. */
  const reveal = (at: number) =>
    `transition-all duration-500 ${
      step >= at ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
    }`;

  const matched = step >= 4;

  return (
    <div
      data-testid="diagnostic-showcase"
      data-step={step}
      className="absolute inset-2 glass-panel overflow-hidden flex flex-col"
    >
      {/* faint product-grid ground, consistent with the dashboard surfaces */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:28px_28px]" />

      {/* Header */}
      <header className="relative flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/5">
        <div className="min-w-0">
          <p className="text-white text-[13px] font-semibold tracking-tight leading-none">
            Wrench AI
          </p>
          <p className="text-white/40 text-[11px] leading-none mt-1 truncate">
            Vehicle Troubleshooter
          </p>
        </div>
        <span className="flex items-center gap-1.5 shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[10px] font-medium text-emerald-300">Online</span>
        </span>
      </header>

      <div className="relative flex-1 min-h-0 px-4 sm:px-5 py-3 flex flex-col gap-2.5 overflow-hidden">
        {/* 1 — customer */}
        <div className={`flex justify-end ${reveal(0)}`}>
          <p
            data-testid="showcase-customer"
            className="max-w-[80%] rounded-xl rounded-br-sm bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-[12px] text-emerald-50"
          >
            My bike won&apos;t start.
          </p>
        </div>

        {/* 2 — assistant */}
        <div className={`flex justify-start ${reveal(1)}`}>
          <p
            data-testid="showcase-assistant"
            className="max-w-[80%] rounded-xl rounded-bl-sm bg-white/[0.05] border border-white/10 px-3 py-2 text-[12px] text-white/80"
          >
            Does the starter motor turn?
          </p>
        </div>

        {/* 3 — diagnostic result */}
        <div data-testid="showcase-result" className={`${CARD} p-3 ${reveal(2)}`}>
          <p className={MUTED}>Possible issue</p>
          <p className="text-white text-[13px] font-medium mt-1.5">
            Battery / Starter System
          </p>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1 flex-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400/80 transition-[width] duration-700"
                style={{ width: step >= 2 ? '82%' : '0%' }}
              />
            </div>
            <span className="text-[11px] text-white/60 tabular-nums shrink-0">
              Confidence 82%
            </span>
          </div>
        </div>

        {/* 4/5 — matching */}
        <div data-testid="showcase-matching" className={`${CARD} p-3 ${reveal(3)}`}>
          {!matched ? (
            <p
              data-testid="showcase-searching"
              className="flex items-center gap-2 text-[12px] text-white/55"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-pulse" />
              Finding nearby mechanics…
            </p>
          ) : (
            <div data-testid="showcase-matched">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300">
                <span aria-hidden>✓</span> Mechanic matched
              </p>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-white text-[13px] font-medium truncate">
                    <span aria-hidden className="mr-1">🔧</span> Raj Auto Care
                  </p>
                  <p className="text-white/45 text-[11px] mt-0.5">
                    <span className="text-amber-300/80" aria-hidden>★</span> 4.9 · 2.4 km away
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-300">
                  Available now
                </span>
              </div>
            </div>
          )}
        </div>

        {/* minimal connection */}
        <div
          data-testid="showcase-route"
          className={`mt-auto flex items-center gap-2 ${reveal(3)}`}
        >
          <span className="h-2 w-2 rounded-full bg-white/70 shrink-0" />
          <span className="text-[10px] text-white/45 shrink-0">You</span>
          <span className="relative flex-1 h-px bg-white/15">
            <span
              className={`absolute -top-[7px] text-[10px] text-white/45 left-1/2 -translate-x-1/2 bg-[#0B0B0C] px-1.5 transition-opacity duration-500 ${
                matched ? 'opacity-100' : 'opacity-0'
              }`}
            >
              2.4 km
            </span>
          </span>
          <span className="text-[10px] text-white/45 shrink-0">Mechanic</span>
          <span aria-hidden className="text-[11px] shrink-0">🔧</span>
        </div>
      </div>
    </div>
  );
}
