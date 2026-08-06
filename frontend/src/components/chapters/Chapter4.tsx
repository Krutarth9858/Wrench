import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const Chapter4: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mockupRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const chat1Ref = useRef<HTMLDivElement>(null);
  const chat2Ref = useRef<HTMLDivElement>(null);
  const chat3Ref = useRef<HTMLDivElement>(null);

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

      tl.fromTo(textRef.current, { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 1 })
        .fromTo(
          mockupRef.current,
          { opacity: 0, y: 100, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 1 },
          '-=0.5',
        )
        .fromTo(
          chat1Ref.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5 },
          '-=0.2',
        )
        .fromTo(chat2Ref.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 })
        .fromTo(chat3Ref.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 });
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
            Meet your AI Assistant.
          </h2>
          <p className="text-white/60 text-lg md:text-xl leading-relaxed font-light">
            If mechanics aren't immediately available, our advanced AI runs a full diagnostic of
            your vehicle's symptoms, giving mechanics a head start before they even arrive.
          </p>
        </div>
        <div
          ref={mockupRef}
          className="relative h-[600px] w-full max-w-md mx-auto bg-white/5 border border-white/10 rounded-[3rem] backdrop-blur-md shadow-2xl flex items-center justify-center overflow-hidden opacity-0"
        >
          {/* Phone mockup UI for Chat */}
          <div className="absolute inset-2 rounded-[2.5rem] border border-white/5 bg-[#0a0a0a] flex flex-col overflow-hidden">
            <div className="w-full h-12 flex justify-center items-center mt-2 border-b border-white/5">
              <div className="w-24 h-6 bg-black rounded-full"></div>
            </div>
            <div className="flex-1 flex flex-col p-6 overflow-hidden gap-4 mt-4">
              {/* Chat Bubbles */}
              <div
                ref={chat1Ref}
                className="self-start max-w-[80%] bg-white/10 p-4 rounded-2xl rounded-tl-sm opacity-0"
              >
                <p className="text-sm">
                  Hi, I'm Wrench AI. Can you describe the issue you're having?
                </p>
              </div>

              <div
                ref={chat2Ref}
                className="self-end max-w-[80%] bg-indigo-600 p-4 rounded-2xl rounded-tr-sm opacity-0"
              >
                <p className="text-sm">My engine won't start and there's a clicking sound.</p>
              </div>

              <div
                ref={chat3Ref}
                className="self-start max-w-[80%] bg-white/10 p-4 rounded-2xl rounded-tl-sm border border-indigo-500/30 opacity-0"
              >
                <p className="text-sm mb-3">
                  Based on your description, this is likely a dead battery or a faulty starter
                  motor.
                </p>
                <div className="w-full bg-black/50 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-500 h-full w-[85%]"></div>
                </div>
                <p className="text-[10px] text-white/40 mt-1 uppercase">85% Confidence Score</p>
              </div>
            </div>

            {/* Fake input bar */}
            <div className="h-16 border-t border-white/5 flex items-center px-6">
              <div className="w-full h-10 bg-white/5 rounded-full flex items-center px-4">
                <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse ml-1 delay-75"></div>
                <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse ml-1 delay-150"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Chapter4;
