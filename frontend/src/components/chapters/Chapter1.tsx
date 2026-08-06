import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Chapter1: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Fade out the text quickly as user starts scrolling
      gsap.to(textRef.current, {
        opacity: 0,
        y: -100,
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=800',
          scrub: true,
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="h-[200vh] w-full flex flex-col justify-start">
      <div className="h-screen w-full flex items-end justify-start pb-24 pl-8 md:pl-24">
        <div ref={textRef} className="text-left max-w-xl">
          <h1 className="text-6xl md:text-8xl font-light tracking-tight text-white/90 mb-4 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
            Stranded?
          </h1>
          <p className="text-xl md:text-2xl text-white/70 font-light tracking-wide leading-relaxed drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]">
            Every second counts when you're on the side of the road. Wrench brings the solution
            directly to you.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Chapter1;
