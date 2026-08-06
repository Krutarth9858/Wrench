import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { GlassCard } from '../ui/GlassCard';
import { AlertCircle } from 'lucide-react';

export const Section2Problem = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 100 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top center',
            end: 'center center',
            scrub: 1,
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="h-[150vh] w-full flex flex-col justify-start">
      <div className="h-screen w-full flex items-center justify-end px-8 md:px-24">
        <GlassCard
          ref={cardRef}
          className="max-w-md p-10 backdrop-blur-2xl bg-slate-900/60 border-slate-700/60"
        >
          <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-6">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-3xl font-medium text-white mb-4">The journey stops.</h2>
          <p className="text-slate-400 text-lg leading-relaxed font-light">
            An engine failure at 2 AM. A flat tire on a deserted highway. When the unexpected
            happens, you need a solution you can trust, immediately.
          </p>
        </GlassCard>
      </div>
    </section>
  );
};
