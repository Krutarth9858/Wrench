import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';

export const Section1Hero = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Fade out the hero text as the user scrolls down
      gsap.to(textRef.current, {
        opacity: 0,
        y: -50,
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=500',
          scrub: true,
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="h-[150vh] w-full flex flex-col justify-start pointer-events-none"
    >
      <div className="h-screen w-full flex flex-col justify-end pb-32 px-8 md:px-24">
        <div ref={textRef} className="max-w-2xl pointer-events-auto">
          <h1 className="text-6xl md:text-8xl font-light tracking-tight text-white mb-6 drop-shadow-xl">
            Help is already
            <br />
            on the way.
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 font-light tracking-wide leading-relaxed drop-shadow-md">
            Wrench connects you to verified mechanics instantly. No endless waiting. No uncertainty.
          </p>
        </div>
      </div>
    </section>
  );
};
