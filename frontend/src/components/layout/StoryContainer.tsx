import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface StoryContextType {
  progress: number;
}

const StoryContext = createContext<StoryContextType>({ progress: 0 });

export const useStoryProgress = () => useContext(StoryContext);

export const StoryContainer = ({ children }: { children: React.ReactNode }) => {
  const [progress, setProgress] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0,
        onUpdate: (self) => {
          setProgress(self.progress);
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <StoryContext.Provider value={{ progress }}>
      {/* 
        The actual scroll track. 
        800vh provides a long enough runway for all transitions.
      */}
      <div ref={containerRef} className="relative w-full h-[800vh] bg-slate-900">
        {/* Fixed layer that holds all the dynamic UI */}
        <div className="sticky top-0 left-0 w-full h-screen overflow-hidden">
          {children}
        </div>
      </div>
    </StoryContext.Provider>
  );
};
