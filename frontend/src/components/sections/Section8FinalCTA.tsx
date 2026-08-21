import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Button } from '../ui/Button';

gsap.registerPlugin(ScrollTrigger);

export const Section8FinalCTA = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Fade in the CTA as the video (in background) reaches its final bright frames
      gsap.fromTo(
        textRef.current,
        { opacity: 0, y: 50 },
        {
          opacity: 1,
          y: 0,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top 75%',
            end: 'center center',
            scrub: 1,
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="h-screen w-full flex flex-col items-center justify-center p-8 text-center bg-transparent pointer-events-none"
    >
      <div ref={textRef} className="opacity-0 pointer-events-auto">
        <h2 className="text-5xl md:text-8xl font-light tracking-tight mb-8 text-white drop-shadow-2xl">
          Back on the road.
        </h2>
        <Button size="lg" className="px-12 py-6 text-xl rounded-full">
          Download Wrench
        </Button>
      </div>
    </section>
  );
};
