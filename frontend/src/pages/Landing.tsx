import React, { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import { FloatingNavbar } from '../components/ui/FloatingNavbar';
import { HeroVideoScrub } from '../components/features/HeroVideoScrub';
import { JourneyLine } from '../components/features/JourneyLine';
import { WrenchLivePanel } from '../components/features/WrenchLivePanel';
import SpecularButton from '../components/ui/SpecularButton';
import { ArrowRight, Check, Zap, Sparkles, Box, Code } from 'lucide-react';
import { WrenchLogo } from '../components/ui/WrenchLogo';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const App: React.FC = () => {
  useEffect(() => {
    // 1. Initialize Lenis (Strict 60FPS scrolling)
    // `lerp` is frame-rate independent and pairs far better with a scrubbed
    // timeline than duration+easing, which re-eases every wheel event and makes
    // the canvas appear to surge and settle rather than track the scroll.
    const lenis = new Lenis({
      lerp: 0.09,
      orientation: 'vertical',
      smoothWheel: true,
      syncTouch: true,
    });
    // Lenis must drive ScrollTrigger, otherwise pinned/scrubbed timelines never
    // update: Lenis owns the scroll loop and ScrollTrigger's own listener is
    // starved, so the hero would scroll past instead of pinning and scrubbing.
    lenis.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Initial animations
    gsap.fromTo('.fade-in-up',
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    );

    // Section snapping is deliberately NOT enabled. Snapping to [0, 1] over
    // 1.5-3s hijacks the scroll the moment the user pauses, which reads as
    // stutter rather than smoothness. Lenis alone carries the motion.
    const sectionTriggers: ScrollTrigger[] = [];

    // Pin measurements depend on images/fonts that settle after mount.
    ScrollTrigger.refresh();

    return () => {
      sectionTriggers.forEach((t) => t.kill());
      gsap.ticker.remove(tick);
      lenis.off('scroll', ScrollTrigger.update);
      lenis.destroy();
    };
  }, []);

  return (
    <div className="bg-[#000000] min-h-screen text-white font-sans selection:bg-emerald-500/30 overflow-hidden">
      {/* Global Grain Overlay - Optimized */}
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-5"></div>

      <FloatingNavbar />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-32">

        {/* 1. Hero — scroll-scrubbed 4K sequence */}
        <HeroVideoScrub />

        {/* 2. Feature Grid (Light Mode Transition Wrapper) */}
        <div className="snap-section relative bg-[#F4F4F5] rounded-[40px] mt-8 pt-32 pb-32 px-4 md:px-12 lg:px-24 border border-zinc-200 overflow-hidden text-zinc-900">

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Left Column: Sticky Header */}
            <div className="lg:col-span-5 relative">
              <div className="sticky top-32">
                <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.05em] leading-[1.05] mb-6">
                  Intelligent <br /> Diagnostic System
                </h2>
                <p className="text-zinc-500 font-light mb-8">
                  Wrench isn't just a directory; it's an AI partner that helps narrow down the problem. By translating your vehicle's symptoms into actionable guidance, we help you find an available mechanic suited to your vehicle.
                </p>
                <p className="text-sm text-zinc-600 font-light mb-12">
                  From dead batteries to engine misfires, our AI helps identify possible causes so you can get the right help without the guesswork.
                </p>

                <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                  {[
                    { icon: Sparkles, label: 'Symptom Translation' },
                    { icon: Box, label: 'Automated Triage' },
                    { icon: Code, label: 'Mechanic Matching' },
                    { icon: Zap, label: 'Actionable Guidance' },
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3 text-zinc-700">
                      <feat.icon className="w-5 h-5 text-zinc-500" />
                      <span className="text-sm font-medium">{feat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Display Card */}
            <div className="lg:col-span-7">
              <div className="w-full aspect-[4/3] bg-zinc-900 rounded-[32px] p-2 relative overflow-hidden group">
                {/* Simulated App Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-black rounded-[28px] overflow-hidden">
                  <div className="w-full h-full p-6 md:p-8 flex flex-col justify-end relative">
                    
                    {/* Realistic Mockup Flow */}
                    <div className="space-y-4 mb-24 w-full max-w-md ml-auto transform transition-transform duration-700 group-hover:-translate-y-2">
                      
                      {/* User message */}
                      <div className="bg-zinc-800 rounded-2xl rounded-tr-sm p-4 ml-12 border border-zinc-700/50 shadow-lg">
                        <p className="text-sm text-white font-medium">My bike won't start.</p>
                      </div>
                      
                      {/* AI message */}
                      <div className="bg-emerald-900/40 rounded-2xl rounded-tl-sm p-4 mr-12 border border-emerald-500/20 shadow-lg">
                        <p className="text-sm text-emerald-50 font-medium mb-3">Let's narrow this down. Are the lights turning on?</p>
                        <div className="flex gap-2">
                           <button className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">Yes, lights work</button>
                           <button className="px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">No, completely dead</button>
                        </div>
                      </div>
                      
                      {/* Diagnostic card */}
                      <div className="glass-panel p-4 mr-12 border border-white/10 shadow-2xl backdrop-blur-md bg-white/5 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                           <Zap className="w-4 h-4 text-emerald-400" />
                           <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">Possible Cause</span>
                        </div>
                        <p className="text-sm text-white font-medium">Battery / Starter Issue</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating System Analysis Glass Widget */}
                <div className="absolute bottom-6 left-6 right-6 md:bottom-8 md:left-8 md:right-8 glass-panel p-4 md:p-6">
                  <div className="flex items-center justify-between mb-4 md:mb-6">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-white/50">Finding Mechanic</span>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-3 md:gap-4">
                       <div className="w-10 h-10 rounded-full bg-zinc-800 border-2 border-emerald-500/50 flex items-center justify-center text-white font-bold">R</div>
                       <div>
                         <p className="text-sm text-white font-medium">Raj Auto Care</p>
                         <p className="text-xs text-emerald-400 font-medium">Available • 2.4 km away</p>
                       </div>
                     </div>
                     <button className="px-4 py-2 bg-white text-zinc-900 text-xs font-bold rounded-full hover:bg-zinc-200 transition-colors">Select</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Recovery Workflow (Dark Mode) */}
        <section className="relative bg-[#18181B] rounded-[40px] mt-8 pt-32 pb-32 px-4 md:px-12 lg:px-24 border border-white/5 overflow-hidden">
          {/* Grayscale Lineart Grid Overlay */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181B] via-transparent to-[#18181B]"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400 mb-4 block">Recovery Workflow</span>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.05em] leading-[1.05] mb-6">
                Built for getting you <br /> back on the road.
              </h2>
              <p className="text-zinc-400 font-light mb-16 max-w-md">
                Wrench connects you directly to available local mechanics. No endless phone calls, no uncertain service states.
              </p>

              <div className="space-y-6 mb-12">
                {[
                  { num: '01', title: "Tell our AI what's wrong", desc: 'Describe the issue.' },
                  { num: '02', title: 'Get Matched', desc: 'We find the closest available mechanic.' },
                  { num: '03', title: 'Live Status', desc: 'Get real-time service status updates.' }
                ].map((step, i) => (
                  <div key={i} className="flex gap-6 items-start">
                    <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-white font-medium">
                      {step.num}
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-1">{step.title}</h4>
                      <p className="text-zinc-500 text-sm font-light">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="glass-panel p-6 max-w-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-emerald-400 text-sm font-medium">Efficiency</span>
                </div>
                <p className="text-zinc-400 text-sm font-light">
                  Find available mechanics without endless phone calls.
                </p>
              </div>
            </div>

            {/* 3D Rotated Mockup Window */}
            <div className="flex items-center justify-center relative perspective-1000 overflow-hidden lg:overflow-visible">
              <JourneyLine />

              <div className="w-full max-w-full lg:w-[120%] aspect-[880/616] lg:max-w-[640px] relative z-10 transform-gpu rotate-x-[2deg] -rotate-y-[3deg] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 glass-panel overflow-hidden flex flex-col">
                  <WrenchLivePanel />
                </div>
                {/* Status Tag */}
                <div className="absolute -bottom-12 right-2 bg-white rounded-full pl-4 pr-6 py-3 flex items-center gap-3 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-1000 border border-zinc-200">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-4 h-4 text-emerald-600" />
                  </div>
                  <span className="text-zinc-900 font-medium text-sm">Mechanic Assisting</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Service Tiers (Light Mode) */}
        <section className="mt-8 pt-32 pb-32 px-4 md:px-12 lg:px-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.05em] leading-[1.05] mb-4">Roadside Assistance, Simplified.</h2>
            <p className="text-zinc-500 font-light">Whether you're a driver in need or a mechanic ready to help, <br /> Wrench is built for you.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { title: 'Vehicle Owners', desc: 'Rapidly request help and get back on the road.', tag: 'Driver', cta: 'Find a Mechanic ↗', features: ['AI Troubleshooting', 'Live Status Updates', 'Secure Booking'] },
              { title: 'Mechanic Partners', desc: 'Expand your reach and manage service requests directly.', tag: 'Mechanic', cta: 'Join as Mechanic ↗', features: ['Service Request Management', 'Availability Toggle', 'Profile Management'] }
            ].map((plan, i) => (
              <div key={i} className="bg-white rounded-[32px] border border-zinc-200 overflow-hidden flex flex-col group hover:shadow-xl transition-shadow duration-500">
                <div className="h-48 relative overflow-hidden bg-zinc-900">
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold uppercase tracking-[0.2em] text-zinc-900 z-10">
                    {plan.tag}
                  </div>
                  <img src={i === 0 ? "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=800&h=400" : "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=800&h=400"} alt="Cover" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                    <h3 className="text-2xl font-semibold text-white tracking-tight">{plan.title}</h3>
                  </div>
                </div>
                <div className="p-8 flex-1 flex flex-col bg-white">
                  <p className="text-sm text-zinc-600 font-light leading-relaxed mb-8">{plan.desc}</p>
                  <div className="space-y-3 mb-auto">
                    {plan.features.map((f, j) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                          <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
                        </div>
                        <span className="text-sm text-zinc-700 font-medium">{f}</span>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-8 py-3 rounded-2xl border border-zinc-200 text-zinc-900 font-medium hover:bg-zinc-50 transition-colors">
                    {plan.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 5. Contact & Footer (Light) */}
        <section className="bg-white rounded-[40px] pt-32 pb-12 px-4 md:px-12 lg:px-24 relative overflow-hidden border border-zinc-200">
          <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-white"></div>

          <div className="relative z-10">
            <div className="text-center mb-24">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 mb-4 block">GET STARTED</span>
              <h2 className="text-5xl md:text-7xl font-semibold tracking-[-0.05em] leading-[1.05] text-zinc-900 mb-6">
                Ready to hit the road <br /> with confidence?
              </h2>
              <p className="text-zinc-600 font-light mb-10 max-w-xl mx-auto">
                Get roadside assistance when you need it.
              </p>
              <div className="flex items-center justify-center gap-6">
                <button className="px-8 py-4 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 transition-colors flex items-center gap-3">
                  Get Assistance <ArrowRight className="w-4 h-4" />
                </button>
                <button className="text-zinc-700 font-medium text-sm flex items-center gap-2 hover:text-zinc-900 transition-colors">
                  Register Now
                </button>
              </div>
            </div>

            {/* Contact Form Section */}
            <div className="bg-white rounded-3xl border border-zinc-200 p-8 md:p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
              <div>
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-100 text-xs font-bold uppercase tracking-[0.2em] text-zinc-600 mb-6">Support</span>
                <h3 className="text-4xl font-semibold tracking-[-0.05em] text-zinc-900 mb-6">Get in touch</h3>
                <p className="text-zinc-600 font-light mb-12">
                  Have questions or need help with a recent service? Our team is ready to assist you.
                </p>

                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center">
                      <span className="font-mono text-zinc-500">&gt;_</span>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 font-medium mb-1">Email Support</p>
                      <p className="text-zinc-900 font-medium">support@wrench.ai</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">First Name</label>
                    <input type="text" placeholder="Alice" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 placeholder:text-zinc-400" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Last Name</label>
                    <input type="text" placeholder="Driver" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 placeholder:text-zinc-400" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Email</label>
                  <input type="email" placeholder="alice@example.com" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 placeholder:text-zinc-400" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Reason / Topic</label>
                  <select className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 appearance-none">
                    <option>General Support</option>
                    <option>Account Issue</option>
                    <option>Billing Question</option>
                    <option>Mechanic Application</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-[0.1em] text-zinc-500">Message / Issue</label>
                  <textarea placeholder="How can we help?" rows={3} className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 placeholder:text-zinc-400 resize-none"></textarea>
                </div>
                <SpecularButton
                  className="w-full h-14 mt-4"
                  tint="#18181B"
                  tintOpacity={1}
                  textColor="#ffffff"
                  lineColor="#525252"
                  baseColor="#09090b"
                  radius={12}
                >
                  <div className="flex items-center justify-center gap-2">
                    Contact Support <ArrowRight className="w-4 h-4" />
                  </div>
                </SpecularButton>
              </div>
            </div>

            {/* Minimal Footer */}
            <div className="pt-8 border-t border-zinc-200 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <WrenchLogo size="sm" compact className="text-zinc-900" />
              </div>
              <div className="flex items-center gap-8 text-sm font-medium text-zinc-600">
                <a href="#" className="hover:text-zinc-900 transition-colors">Manifesto</a>
                <a href="#" className="hover:text-zinc-900 transition-colors">Pricing</a>
                <a href="#" className="hover:text-zinc-900 transition-colors">Changelog</a>
                <a href="#" className="hover:text-zinc-900 transition-colors">Twitter</a>
              </div>
              <div className="text-xs text-zinc-500 font-light">
                © 2026 Wrench Inc. All rights reserved.
              </div>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};

export default App;
