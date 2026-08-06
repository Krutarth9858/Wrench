import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Chapter5: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        textRef.current,
        { opacity: 0, scale: 0.9 },
        {
          opacity: 1,
          scale: 1,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top center',
            end: 'center center',
            scrub: true,
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="h-[150vh] w-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-t from-[#09090B] to-transparent"
    >
      <div ref={textRef} className="opacity-0">
        <h2 className="text-5xl md:text-7xl font-light tracking-tight mb-8 drop-shadow-2xl text-white/90">
          Back on the road.
        </h2>
        <p className="text-xl md:text-2xl text-white/60 font-light tracking-wide max-w-lg mx-auto">
          No stress. No uncertainty. Just premium roadside assistance when you need it most.
        </p>
      </div>
    </section>
  );
};

export default Chapter5;
