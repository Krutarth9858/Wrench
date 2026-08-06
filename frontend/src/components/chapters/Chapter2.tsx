import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Chapter2: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top center',
          end: 'bottom center',
          scrub: 1,
        },
      });

      tl.fromTo(textRef.current, { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 1 }).fromTo(
        mockupRef.current,
        { opacity: 0, y: 100, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 1 },
        '-=0.5',
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="min-h-screen w-full flex flex-col items-center justify-center p-8"
    >
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div ref={textRef} className="flex flex-col justify-center opacity-0">
          <h2 className="text-4xl md:text-6xl font-light tracking-tight mb-6">
            Instant Help.
            <br />
            Zero Friction.
          </h2>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed font-light">
            Tap a button. We connect you to verified mechanics nearby in seconds. No endless phone
            calls. No waiting in the dark.
          </p>
        </div>
        <div
          ref={mockupRef}
          className="relative h-[600px] w-full max-w-md mx-auto bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-md shadow-2xl flex items-center justify-center overflow-hidden opacity-0"
        >
          {/* Phone mockup UI */}
          <div className="absolute inset-2 rounded-[2.5rem] border border-white/5 bg-[#0a0a0a] flex flex-col overflow-hidden">
            <div className="w-full h-12 flex justify-center items-center mt-2">
              <div className="w-24 h-6 bg-black rounded-full"></div> {/* Notch */}
            </div>
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mb-6">
                <div className="w-12 h-12 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_30px_rgba(99,102,241,0.6)]"></div>
              </div>
              <h3 className="text-2xl font-medium mb-2">Requesting Help</h3>
              <p className="text-white/40 text-sm">Finding nearby mechanics...</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Chapter2;
