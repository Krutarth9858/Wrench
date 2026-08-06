import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
  {
    text: 'My engine died on the I-95 at 2 AM. A mechanic was there in 15 minutes. Unbelievable service.',
    name: 'Sarah J.',
    role: 'Customer',
  },
  {
    text: "The transparency is what sold me. I saw the price, the ETA, and the mechanic's route live.",
    name: 'Marcus T.',
    role: 'Customer',
  },
  {
    text: 'As a mechanic, Wrench is the best platform. The AI diagnosis saves me 30 minutes per job.',
    name: 'David L.',
    role: 'Verified Mechanic',
  },
  {
    text: 'Premium experience from start to finish. It feels like having a personal pit crew on speed dial.',
    name: 'Elena R.',
    role: 'Customer',
  },
];

const Chapter8: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Horizontal scroll effect
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: sectionRef.current,
          start: 'top top',
          end: '+=200%',
          scrub: 1,
          pin: true,
        },
      });

      tl.to(containerRef.current, {
        x: () => -(containerRef.current?.scrollWidth || 0) + window.innerWidth - 100, // leave a bit of margin
        ease: 'none',
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="h-screen w-full bg-[#09090B] flex flex-col justify-center overflow-hidden"
    >
      <div className="pl-8 md:pl-24 mb-16">
        <h2 className="text-4xl md:text-6xl font-light tracking-tight">
          Don't just take our word for it.
        </h2>
      </div>

      <div className="flex w-[200vw] md:w-[150vw]" ref={containerRef}>
        <div className="flex gap-8 px-8 md:px-24">
          {testimonials.map((t, idx) => (
            <div
              key={idx}
              className="w-[85vw] md:w-[500px] h-[300px] bg-white/5 border border-white/10 rounded-3xl p-10 flex flex-col justify-between shrink-0 backdrop-blur-sm"
            >
              <p className="text-xl md:text-2xl font-light leading-relaxed text-white/80">
                "{t.text}"
              </p>
              <div>
                <p className="font-medium text-lg">{t.name}</p>
                <p className="text-white/40 uppercase tracking-wider text-xs">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Chapter8;
