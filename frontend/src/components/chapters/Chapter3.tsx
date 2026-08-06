import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Chapter3: React.FC = () => {
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

      tl.fromTo(
        mockupRef.current,
        { opacity: 0, y: 100, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 1 },
      ).fromTo(textRef.current, { opacity: 0, x: 50 }, { opacity: 1, x: 0, duration: 1 }, '-=0.5');
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="min-h-screen w-full flex flex-col items-center justify-center p-8"
    >
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
        <div
          ref={mockupRef}
          className="order-2 md:order-1 relative h-[600px] w-full max-w-md mx-auto bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-md shadow-2xl flex items-center justify-center overflow-hidden opacity-0"
        >
          {/* Map mockup placeholder */}
          <div className="absolute inset-2 rounded-[2.5rem] border border-white/5 bg-[#111] overflow-hidden">
            {/* Fake map background */}
            <div
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: 'radial-gradient(circle at center, #333 2px, transparent 2px)',
                backgroundSize: '24px 24px',
              }}
            ></div>

            {/* Fake route line */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <path
                d="M 20,80 Q 50,50 80,20"
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="5,5"
                className="animate-pulse"
              />
            </svg>

            {/* Fake markers */}
            <div className="absolute top-[20%] right-[20%] w-6 h-6 bg-indigo-500 rounded-full border-4 border-black shadow-[0_0_15px_rgba(99,102,241,0.8)]"></div>
            <div className="absolute bottom-[20%] left-[20%] w-6 h-6 bg-white rounded-full border-4 border-black"></div>

            {/* Floating ETA card */}
            <div className="absolute bottom-6 left-6 right-6 bg-white/10 backdrop-blur-xl border border-white/20 p-4 rounded-2xl flex justify-between items-center">
              <div>
                <p className="text-white/60 text-xs uppercase tracking-wider mb-1">ETA</p>
                <p className="text-xl font-medium">8 min</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <span className="text-indigo-400">★</span>
              </div>
            </div>
          </div>
        </div>
        <div ref={textRef} className="order-1 md:order-2 flex flex-col justify-center opacity-0">
          <h2 className="text-4xl md:text-6xl font-light tracking-tight mb-6">
            They're on their way.
          </h2>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed font-light">
            Watch your mechanic approach in real-time. Transparent ETAs. Seamless communication.
            Total peace of mind.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Chapter3;
