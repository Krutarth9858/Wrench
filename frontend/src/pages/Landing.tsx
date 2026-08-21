import React, { useEffect } from 'react';
import Lenis from '@studio-freight/lenis';
import { FloatingNavbar } from '../components/ui/FloatingNavbar';
import { HeroVideoScrub } from '../components/features/HeroVideoScrub';
import { JourneyLine } from '../components/features/JourneyLine';
import SpecularButton from '../components/ui/SpecularButton';
import { ArrowRight, Check, Zap, Sparkles, Box, Code } from 'lucide-react';
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
      {/* Global Grain Overlay */}
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-15 mix-blend-overlay"></div>
      
      <FloatingNavbar />

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        
        {/* 1. Hero — scroll-scrubbed 4K sequence */}
        <HeroVideoScrub />

        {/* 2. Feature Grid (Light Mode Transition Wrapper) */}
        <div className="snap-section relative bg-[#F4F4F5] rounded-[40px] mt-8 pt-32 pb-32 px-12 md:px-24 border border-zinc-200 overflow-hidden text-zinc-900">
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-16">
            {/* Left Column: Sticky Header */}
            <div className="lg:col-span-5 relative">
              <div className="sticky top-32">
                <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.05em] leading-[1.05] mb-6">
                  Intelligent <br/> Diagnostic System
                </h2>
                <p className="text-zinc-500 font-light mb-8">
                  Wrench isn't just a network; it's an AI partner that understands your vehicle's language. It maintains context across thousands of vehicle codes while suggesting meaningful repair steps.
                </p>
                <p className="text-sm text-zinc-400 font-light mb-12">
                  From battery voltage scales to accessible fuse maps, our engine ensures every second serves a purpose. Stop fighting with manual dispatch and start driving.
                </p>

                <div className="grid grid-cols-2 gap-y-8 gap-x-4">
                  {[
                    { icon: Sparkles, label: 'Adaptive Diagnostics' },
                    { icon: Box, label: 'Smart Layer Management' },
                    { icon: Code, label: 'Interaction Prototyping' },
                    { icon: Zap, label: 'AI Content Generation' },
                  ].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3 text-zinc-700">
                      <feat.icon className="w-5 h-5 text-zinc-400" />
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
                  <div className="w-full h-full flex items-center justify-center transform transition-transform duration-700 group-hover:scale-105">
                     {/* Abstract Mockup Element */}
                     <div className="w-48 h-48 rounded-3xl bg-gradient-to-br from-emerald-500 to-emerald-900 shadow-2xl flex items-center justify-center">
                        <span className="text-white text-8xl font-bold tracking-tighter">W</span>
                     </div>
                  </div>
                </div>

                {/* Floating System Analysis Glass Widget */}
                <div className="absolute bottom-8 left-8 right-8 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">System Analysis</span>
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                    </div>
                  </div>
                  <div className="w-3/4 h-2 bg-white/10 rounded-full mb-3 overflow-hidden">
                     <div className="h-full bg-white/40 w-[60%] rounded-full animate-pulse"></div>
                  </div>
                  <div className="w-1/2 h-2 bg-white/10 rounded-full mb-8"></div>
                  <div className="flex items-center gap-3">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-zinc-800 flex items-center justify-center text-[10px] text-white font-bold">AI</div>
                      <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-zinc-800 flex items-center justify-center text-[10px] text-white font-bold">W</div>
                    </div>
                    <span className="text-xs text-white/80">Generating 12 mechanics nearby...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Productivity Engine (Dark Mode) */}
        <section className="relative bg-[#18181B] rounded-[40px] mt-8 pt-32 pb-32 px-12 md:px-24 border border-white/5 overflow-hidden">
          {/* Grayscale Lineart Grid Overlay */}
          <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#18181B] via-transparent to-[#18181B]"></div>

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-4 block">Productivity Engine</span>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.05em] leading-[1.05] mb-6">
                Built for the future of <br/> roadside recovery.
              </h2>
              <p className="text-zinc-400 font-light mb-16 max-w-md">
                Wrench integrates seamlessly into your existing dispatch workflow, acting as a force multiplier for your support team. What used to take hours now happens in real-time.
              </p>

              <div className="space-y-6 mb-12">
                {[
                  { num: '01', title: 'Import from OBD2', desc: 'Two-way sync keeps vehicle data updated.' },
                  { num: '02', title: 'Generate Variations', desc: 'Explore divergent mechanic routes instantly.' },
                  { num: '03', title: 'Export Dispatch', desc: 'Clean, semantic, automated routing.' }
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

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 max-w-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-emerald-400 text-sm font-medium">Efficiency Gain</span>
                </div>
                <p className="text-zinc-400 text-sm font-light">
                  Teams using Wrench report a 60% reduction in "phone-tag" time, allowing dispatchers to focus on strategic support problems.
                </p>
              </div>
            </div>

            {/* 3D Rotated Mockup Window */}
            <div className="flex items-center justify-center relative perspective-1000">
               {/* The SVG Journey Line runs vertically through this section, but we'll use a local GSAP drawing effect or just let it weave */}
               <JourneyLine />

               <div className="w-[120%] aspect-square max-w-[600px] relative z-10 transform-gpu rotate-x-[2deg] -rotate-y-[3deg] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)]">
                 <div className="absolute inset-0 bg-zinc-900 rounded-[32px] border border-white/10 overflow-hidden flex flex-col">
                    <div className="h-16 border-b border-white/10 flex items-center px-6 gap-2">
                       <div className="w-8 h-8 rounded-full bg-white/5"></div>
                       <div className="w-24 h-4 rounded-full bg-white/5 ml-auto"></div>
                    </div>
                    <div className="flex-1 p-6 grid grid-cols-2 gap-4">
                       <div className="col-span-2 h-32 rounded-2xl bg-white/5 border border-white/5"></div>
                       <div className="h-24 rounded-2xl bg-white/5 border border-white/5"></div>
                       <div className="h-24 rounded-2xl bg-white/5 border border-white/5"></div>
                    </div>
                 </div>
                 {/* Bouncing Status Tag */}
                 <div className="absolute -bottom-4 -right-4 bg-white rounded-full pl-4 pr-6 py-3 flex items-center gap-3 shadow-2xl animate-bounce border border-zinc-200">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Check className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-zinc-900 font-medium text-sm">Mechanic Dispatched</span>
                 </div>
               </div>
            </div>
          </div>
        </section>

        {/* 4. Pricing Bento Grid (Light Mode) */}
        <section className="mt-8 pt-32 pb-32">
          <div className="text-center mb-16">
             <h2 className="text-4xl md:text-5xl font-semibold tracking-[-0.05em] leading-[1.05] mb-4">Tailored Solutions</h2>
             <p className="text-zinc-400 font-light">Whether you're a single driver or a Fortune 500 fleet, <br/> Wrench scales to meet your complexity.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {[
               { title: 'Standard Driver', desc: 'Rapidly request and validate help. Go from stranded to repaired in one afternoon.', tag: 'Speed', features: ['AI Diagnostics', 'Standard Priority', 'Basic Support'] },
               { title: 'Enterprise Fleet', desc: 'Maintain consistency across hundreds of vehicles. Centralized governance for global teams.', tag: 'Scale', features: ['Fleet Management', 'Permission Controls', 'SLA Guarantee'] },
               { title: 'Mechanic Pro', desc: 'Deliver agency-quality work without the headcount. Impress drivers with speed.', tag: 'Quality', features: ['Direct Routing', 'Asset Export', 'White-labeling'] }
             ].map((plan, i) => (
               <div key={i} className="bg-white rounded-[32px] border border-zinc-100 overflow-hidden flex flex-col group hover:shadow-xl transition-shadow duration-500">
                  <div className="h-48 relative overflow-hidden bg-zinc-900">
                     <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-900 z-10">
                        {plan.tag}
                     </div>
                     <img src={`https://images.unsplash.com/photo-1581092160562-40aa08e78837?auto=format&fit=crop&q=80&w=800&h=400`} alt="Cover" className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" />
                     <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-6">
                       <h3 className="text-2xl font-semibold text-white tracking-tight">{plan.title}</h3>
                     </div>
                  </div>
                  <div className="p-8 flex-1 flex flex-col bg-white">
                     <p className="text-sm text-zinc-500 font-light leading-relaxed mb-8">{plan.desc}</p>
                     <div className="space-y-3 mb-auto">
                        {plan.features.map((f, j) => (
                          <div key={j} className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                              <Check className="w-2.5 h-2.5 text-emerald-600" strokeWidth={3} />
                            </div>
                            <span className="text-sm text-zinc-600 font-medium">{f}</span>
                          </div>
                        ))}
                     </div>
                     <button className="w-full mt-8 py-3 rounded-2xl border border-zinc-200 text-zinc-900 font-medium hover:bg-zinc-50 transition-colors">
                        Start Creating ↗
                     </button>
                  </div>
               </div>
             ))}
          </div>
        </section>

        {/* 5. Contact & Footer (Light) */}
        <section className="bg-white rounded-[40px] pt-32 pb-12 px-12 md:px-24 relative overflow-hidden">
           {/* Soft background gradient for light mode */}
           <div className="absolute inset-0 bg-gradient-to-br from-zinc-50 to-white"></div>
           
           <div className="relative z-10">
              <div className="text-center mb-24">
                 <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400 mb-4 block">LIMITED ACCESS</span>
                 <h2 className="text-5xl md:text-7xl font-semibold tracking-[-0.05em] leading-[1.05] text-zinc-900 mb-6">
                   Ready to design the <br/> impossible?
                 </h2>
                 <p className="text-zinc-500 font-light mb-10 max-w-xl mx-auto">
                   Join 10,000+ drivers who have already accelerated their workflow. Get early access to Wrench 2.0 and start driving today.
                 </p>
                 <div className="flex items-center justify-center gap-6">
                   <button className="px-8 py-4 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 transition-colors flex items-center gap-3">
                     Start Free Trial <ArrowRight className="w-4 h-4" />
                   </button>
                   <button className="text-zinc-600 font-medium text-sm flex items-center gap-2 hover:text-zinc-900 transition-colors">
                     <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                     Download Mac App
                   </button>
                 </div>
                 <p className="text-xs text-zinc-400 mt-6 font-light">No credit card required. 14-day free trial.</p>
              </div>

              {/* Contact Form Section */}
              <div className="bg-white rounded-3xl border border-zinc-100 p-12 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] grid grid-cols-1 lg:grid-cols-2 gap-16 mb-24">
                 <div>
                   <span className="inline-flex items-center px-3 py-1 rounded-full bg-zinc-100 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-6">Contact Sales</span>
                   <h3 className="text-4xl font-semibold tracking-[-0.05em] text-zinc-900 mb-6">Get in touch</h3>
                   <p className="text-zinc-500 font-light mb-12">
                     Have questions about enterprise plans or custom integrations? Our team is ready to help you scale your operations.
                   </p>
                   
                   <div className="space-y-6">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                         <span className="font-mono text-zinc-400">&gt;_</span>
                       </div>
                       <div>
                         <p className="text-xs text-zinc-400 font-medium mb-1">Email Support</p>
                         <p className="text-zinc-900 font-medium">hello@wrench.ai</p>
                       </div>
                     </div>
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                         <Box className="w-5 h-5 text-zinc-400" />
                       </div>
                       <div>
                         <p className="text-xs text-zinc-400 font-medium mb-1">Schedule Demo</p>
                         <p className="text-zinc-900 font-medium">Book a 15-min call</p>
                       </div>
                     </div>
                   </div>
                 </div>

                 {/* Form Fields */}
                 <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">First Name</label>
                       <input type="text" placeholder="Alice" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 placeholder:text-zinc-300" />
                     </div>
                     <div className="space-y-2">
                       <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">Last Name</label>
                       <input type="text" placeholder="Driver" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 placeholder:text-zinc-300" />
                     </div>
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">Work Email</label>
                     <input type="email" placeholder="alice@company.com" className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 placeholder:text-zinc-300" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400">Company Size</label>
                     <select className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all text-zinc-900 appearance-none">
                        <option>1-10 employees</option>
                        <option>11-50 employees</option>
                        <option>50+ employees</option>
                     </select>
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
                       Request Access <ArrowRight className="w-4 h-4" />
                     </div>
                   </SpecularButton>
                 </div>
              </div>

              {/* Minimal Footer */}
              <div className="pt-8 border-t border-zinc-100 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-zinc-900 rounded-md flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                  </div>
                  <span className="text-zinc-900 font-semibold tracking-tight">Wrench.</span>
                </div>
                <div className="flex items-center gap-8 text-sm font-medium text-zinc-500">
                  <a href="#" className="hover:text-zinc-900 transition-colors">Manifesto</a>
                  <a href="#" className="hover:text-zinc-900 transition-colors">Pricing</a>
                  <a href="#" className="hover:text-zinc-900 transition-colors">Changelog</a>
                  <a href="#" className="hover:text-zinc-900 transition-colors">Twitter</a>
                </div>
                <div className="text-xs text-zinc-400 font-light">
                  © 2024 Wrench Inc. All rights reserved.
                </div>
              </div>
           </div>
        </section>

      </main>
    </div>
  );
};

export default App;
