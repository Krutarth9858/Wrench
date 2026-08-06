import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const Section7Trust = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState({ mechanics: 0, time: 0, cities: 0 });

  useEffect(() => {
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top 70%',
        onEnter: () => {
          gsap.to(stats, {
            mechanics: 8500,
            time: 12,
            cities: 340,
            duration: 2.5,
            ease: 'power3.out',
            onUpdate: () => setStats({ ...stats }),
          });
        },
        once: true,
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="py-40 w-full bg-slate-900 flex flex-col items-center relative z-20"
    >
      <div className="w-full max-w-6xl px-8">
        <h2 className="text-3xl md:text-5xl font-light tracking-tight mb-20 text-center text-white">
          A network built on trust.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-16 text-center">
          <div className="flex flex-col items-center justify-center gap-4">
            <span className="text-6xl md:text-7xl font-light text-blue-500">
              {Math.floor(stats.mechanics).toLocaleString()}+
            </span>
            <span className="text-slate-400 font-medium tracking-wide">Verified Mechanics</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-4">
            <span className="text-6xl md:text-7xl font-light text-blue-500">
              {Math.floor(stats.time)}m
            </span>
            <span className="text-slate-400 font-medium tracking-wide">Avg. Response Time</span>
          </div>
          <div className="flex flex-col items-center justify-center gap-4">
            <span className="text-6xl md:text-7xl font-light text-blue-500">
              {Math.floor(stats.cities)}+
            </span>
            <span className="text-slate-400 font-medium tracking-wide">Cities Covered</span>
          </div>
        </div>
      </div>
    </section>
  );
};
