import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export const JourneyLine: React.FC = () => {
  const pathRef = useRef<SVGPathElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pathRef.current || !containerRef.current) return;

    const path = pathRef.current;
    const length = path.getTotalLength();

    // Set initial dash state to hide the path
    gsap.set(path, {
      strokeDasharray: length,
      strokeDashoffset: length,
    });

    // Create the scroll animation
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top center', // Start drawing when container top hits center of viewport
        end: 'bottom center', // Finish drawing when container bottom hits center
        scrub: 1, // Smooth scrubbing
      },
    });

    tl.to(path, {
      strokeDashoffset: 0,
      ease: 'none',
    });

    return () => {
      tl.kill();
    };
  }, []);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      <svg 
        className="w-full h-full" 
        preserveAspectRatio="none" 
        viewBox="0 0 100 1000" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          ref={pathRef}
          d="M 50 0 C 50 200, 10 300, 10 500 C 10 700, 90 800, 90 1000"
          stroke="url(#journeyGradient)"
          strokeWidth="2"
          strokeLinecap="round"
          className="drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]"
        />
        <defs>
          <linearGradient id="journeyGradient" x1="50" y1="0" x2="50" y2="1000" gradientUnits="userSpaceOnUse">
            <stop stopColor="#34D399" stopOpacity="0.1" />
            <stop offset="0.5" stopColor="#34D399" />
            <stop offset="1" stopColor="#34D399" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
