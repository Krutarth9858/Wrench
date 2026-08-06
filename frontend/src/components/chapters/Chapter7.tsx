import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Chapter7: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({ mechanics: 0, time: 0, cities: 0 });

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top 70%',
        onEnter: () => {
          gsap.to(stats, {
            mechanics: 5000,
            time: 15,
            cities: 120,
            duration: 2,
            ease: 'power2.out',
            onUpdate: () => setStats({ ...stats }),
          });
        },
        once: true,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="py-32 w-full bg-[#09090B] flex flex-col items-center">
      <div className="w-full max-w-5xl px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center border-y border-white/10 py-16">
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="text-6xl md:text-8xl font-light text-white">
              {Math.floor(stats.mechanics)}+
            </span>
            <span className="text-white/40 uppercase tracking-widest text-sm">
              Verified Mechanics
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="text-6xl md:text-8xl font-light text-white">
              {Math.floor(stats.time)}m
            </span>
            <span className="text-white/40 uppercase tracking-widest text-sm">
              Avg. Response Time
            </span>
          </div>
          <div className="flex flex-col items-center justify-center gap-2">
            <span className="text-6xl md:text-8xl font-light text-white">
              {Math.floor(stats.cities)}
            </span>
            <span className="text-white/40 uppercase tracking-widest text-sm">Cities Covered</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Chapter7;
