import React, { useRef, useEffect, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { MockupPhone } from '../ui/MockupPhone';
import { Button } from '../ui/Button';
import { MapPin, Navigation, MessageSquare, Wrench, ShieldCheck, Zap } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SectionPhoneSequence = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const phoneWrapperRef = useRef<HTMLDivElement>(null);

  // Track scroll progress to swap internal UI (0 to 1)
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Pin the phone for 400vh
      ScrollTrigger.create({
        trigger: containerRef.current,
        start: 'top top',
        end: '+=300%',
        pin: phoneWrapperRef.current,
        scrub: true,
        onUpdate: (self) => {
          setProgress(self.progress);
        },
      });

      // Animate phone sliding up initially
      gsap.fromTo(
        phoneWrapperRef.current,
        { y: '100vh', opacity: 0, scale: 0.8 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          scrollTrigger: {
            trigger: containerRef.current,
            start: 'top bottom',
            end: 'top top',
            scrub: 1,
          },
        },
      );
    }, containerRef);

    return () => ctx.revert();
  }, []);

  // Determine which UI state to show based on scroll progress
  let activeState = 'request'; // 0.0 - 0.25
  if (progress > 0.25 && progress <= 0.5) activeState = 'dashboard';
  if (progress > 0.5 && progress <= 0.75) activeState = 'map';
  if (progress > 0.75) activeState = 'ai';

  return (
    <section ref={containerRef} className="h-[400vh] w-full relative z-20 pointer-events-none">
      {/* Background Dimmer for the UI sections to pop */}
      <div
        className="fixed inset-0 bg-slate-900/80 backdrop-blur-2xl transition-opacity duration-1000 -z-10"
        style={{ opacity: progress > 0.05 && progress < 0.95 ? 1 : 0 }}
      />

      <div className="h-screen w-full flex items-center justify-center">
        <div ref={phoneWrapperRef} className="w-full flex justify-center pointer-events-auto">
          <div
            className="hidden lg:flex w-[300px] flex-col justify-center pr-16 text-right transition-opacity duration-500"
            style={{ opacity: activeState === 'request' || activeState === 'dashboard' ? 1 : 0 }}
          >
            <h2 className="text-4xl font-light mb-4">Request in seconds.</h2>
            <p className="text-slate-400 text-lg font-light">
              No forms. No calling around. Tap once, and our network of verified mechanics is
              alerted.
            </p>
          </div>

          <MockupPhone className="transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-[0_0_100px_rgba(37,99,235,0.15)]">
            {/* STATE 1: REQUEST */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col items-center justify-center p-6 bg-slate-950 transition-all duration-700',
                activeState === 'request' ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0',
              )}
            >
              <div className="w-24 h-24 bg-blue-600/10 rounded-full flex items-center justify-center mb-8 relative">
                <div className="absolute inset-0 bg-blue-600/20 rounded-full animate-ping"></div>
                <Wrench className="text-blue-500 w-10 h-10" />
              </div>
              <h3 className="text-2xl font-medium text-white mb-2 text-center">Stranded?</h3>
              <p className="text-slate-400 text-center text-sm mb-12">
                We'll find the nearest verified mechanic to get you back on the road.
              </p>
              <Button className="w-full py-6 text-lg rounded-2xl shadow-[0_0_30px_rgba(37,99,235,0.4)]">
                Get Help Now
              </Button>
            </div>

            {/* STATE 2: DASHBOARD */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col p-5 bg-slate-950 transition-all duration-700',
                activeState === 'dashboard'
                  ? 'opacity-100 scale-100 z-10'
                  : 'opacity-0 scale-105 z-0',
              )}
            >
              <div className="mt-10 mb-6 flex justify-between items-center">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
                    Status
                  </p>
                  <p className="text-lg font-medium text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    Mechanic Assigned
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl mb-4">
                <div className="flex gap-4 items-center mb-4">
                  <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden">
                    <img
                      src="https://i.pravatar.cc/150?u=mechanic"
                      alt="Marcus"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-white">Marcus T.</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1">
                      <ShieldCheck size={12} className="text-blue-500" /> Verified Master Tech
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1 rounded-xl text-xs h-9">
                    <MessageSquare size={14} className="mr-2" />
                    Message
                  </Button>
                  <Button
                    variant="secondary"
                    className="w-12 rounded-xl h-9 flex items-center justify-center p-0"
                  >
                    Call
                  </Button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-400">Diagnosis Fee</span>
                  <span className="text-sm font-medium text-white">$45.00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">ETA</span>
                  <span className="text-sm font-medium text-white">12 mins</span>
                </div>
              </div>
            </div>

            {/* STATE 3: MAP */}
            <div
              className={cn(
                'absolute inset-0 bg-slate-900 overflow-hidden transition-all duration-700',
                activeState === 'map' ? 'opacity-100 z-10' : 'opacity-0 z-0',
              )}
            >
              {/* Fake Mapbox Background */}
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at center, #334155 2px, transparent 2px)',
                  backgroundSize: '24px 24px',
                }}
              ></div>

              {/* Route */}
              <svg
                className="absolute inset-0 w-full h-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  d="M 20,80 Q 50,50 80,20"
                  fill="none"
                  stroke="#2563EB"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  className="animate-pulse"
                />
              </svg>

              {/* Pins */}
              <div className="absolute top-[20%] right-[20%] w-8 h-8 bg-blue-600 rounded-full border-2 border-white shadow-[0_0_20px_rgba(37,99,235,0.6)] flex items-center justify-center text-white">
                <MapPin size={16} />
              </div>
              <div className="absolute bottom-[20%] left-[20%] w-4 h-4 bg-white rounded-full border-4 border-blue-600 shadow-lg"></div>

              {/* Overlay UI */}
              <div className="absolute bottom-6 left-4 right-4 bg-slate-900/90 backdrop-blur-xl border border-slate-700 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center text-blue-500">
                  <Navigation size={18} />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-medium">ARRIVING IN</p>
                  <p className="text-lg font-semibold text-white">
                    8 min <span className="text-slate-500 text-sm font-normal"> (2.4 mi)</span>
                  </p>
                </div>
              </div>
            </div>

            {/* STATE 4: AI ASSISTANT */}
            <div
              className={cn(
                'absolute inset-0 flex flex-col bg-slate-950 transition-all duration-700',
                activeState === 'ai' ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0',
              )}
            >
              <div className="h-20 border-b border-slate-800 flex items-end pb-4 px-6 bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-full flex items-center justify-center text-white">
                    <Zap size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Wrench AI</p>
                    <p className="text-[10px] text-green-500 font-medium">Online</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-5 overflow-hidden flex flex-col justify-end gap-4 pb-6">
                <div className="self-start max-w-[85%] bg-slate-800 p-3 rounded-2xl rounded-tl-sm shadow-sm">
                  <p className="text-sm text-slate-200">
                    Hi! I'm Wrench AI. While we wait for your mechanic, can you describe the issue?
                  </p>
                </div>

                <div className="self-end max-w-[85%] bg-blue-600 p-3 rounded-2xl rounded-tr-sm shadow-md">
                  <p className="text-sm text-white">
                    My engine won't start and there's a clicking sound when I turn the key.
                  </p>
                </div>

                <div className="self-start w-full bg-slate-800 border border-blue-500/30 p-4 rounded-2xl rounded-tl-sm shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-slate-700">
                    <div className="h-full bg-blue-500 w-[85%]"></div>
                  </div>
                  <p className="text-xs text-blue-400 font-semibold mb-2 mt-1 uppercase tracking-wider">
                    Diagnosis: 85% Confidence
                  </p>
                  <p className="text-sm text-slate-200">
                    Based on your description, this is highly likely a **dead battery** or a
                    **faulty starter motor**.
                  </p>
                  <p className="text-xs text-slate-400 mt-3">
                    I've sent this preliminary report to Marcus so he arrives with the right
                    equipment.
                  </p>
                </div>
              </div>
            </div>
          </MockupPhone>

          <div
            className="hidden lg:flex w-[300px] flex-col justify-center pl-16 text-left transition-opacity duration-500"
            style={{ opacity: activeState === 'map' || activeState === 'ai' ? 1 : 0 }}
          >
            <h2 className="text-4xl font-light mb-4">Total Transparency.</h2>
            <p className="text-slate-400 text-lg font-light">
              Watch them arrive in real-time on the map, or chat with our AI to get a head-start on
              the diagnosis.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
