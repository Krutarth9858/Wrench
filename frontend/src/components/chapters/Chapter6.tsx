import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Chapter6: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const card1Ref = useRef<HTMLDivElement>(null);
  const card2Ref = useRef<HTMLDivElement>(null);
  const card3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const cards = [card1Ref.current, card2Ref.current, card3Ref.current];

      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 100 },
          {
            opacity: 1,
            y: 0,
            scrollTrigger: {
              trigger: card,
              start: 'top 80%',
              end: 'bottom 60%',
              scrub: 1,
            },
          },
        );
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-32 w-full bg-[#09090B] flex flex-col items-center">
      <div className="w-full max-w-6xl px-8">
        <h2 className="text-4xl md:text-6xl font-light tracking-tight mb-20 text-center">
          Designed for emergencies.
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div
            ref={card1Ref}
            className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6 backdrop-blur-sm"
          >
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
            <h3 className="text-2xl font-medium">No hidden fees.</h3>
            <p className="text-white/60 font-light leading-relaxed">
              Transparent pricing upfront. You approve the cost before the mechanic even leaves
              their shop.
            </p>
          </div>

          <div
            ref={card2Ref}
            className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6 backdrop-blur-sm lg:translate-y-12"
          >
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center text-green-400">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <h3 className="text-2xl font-medium">Verified Mechanics.</h3>
            <p className="text-white/60 font-light leading-relaxed">
              Every mechanic on Wrench undergoes rigorous background checks and skill verification.
            </p>
          </div>

          <div
            ref={card3Ref}
            className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6 backdrop-blur-sm lg:translate-y-24"
          >
            <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <h3 className="text-2xl font-medium">24/7 Availability.</h3>
            <p className="text-white/60 font-light leading-relaxed">
              Breakdowns don't sleep, and neither do we. AI handles off-hours triage to ensure
              you're never ignored.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Chapter6;
