import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { PillButton } from '../ui/PillButton';
import { Clock, User, Navigation, ShieldAlert } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export const HeroVideoScrub = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlay1Ref = useRef<HTMLDivElement>(null); // Hero Text
  const overlay2Ref = useRef<HTMLDivElement>(null); // Booking / Mechanic Card
  const overlay3Ref = useRef<HTMLDivElement>(null); // ETA / Map Notification
  const overlay4Ref = useRef<HTMLDivElement>(null); // Bottom Text & CTA

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: false });
    const container = containerRef.current;
    if (!canvas || !ctx || !container) return;

    const frameCount = 144;
    const frameSrc = (i: number) => `/frames/frame_${(i + 1).toString().padStart(4, '0')}.jpg`;
    const images: HTMLImageElement[] = [];
    const state = { frame: 0 };
    let drawnFrame = -1;

    // Size the backing store to what is actually on screen, not to the 4K source.
    // Painting 3840x2160 every tick when the canvas displays ~1200x800 wastes ~4x
    // the fill rate and is the single biggest cause of scrub jank.
    const sizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      const w = Math.round(width * dpr);
      const h = Math.round(height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        drawnFrame = -1; // force a repaint at the new size
      }
    };

    // The source is 16:9 but the canvas rarely is, so replicate object-fit: cover
    // manually now that we control the backing-store dimensions.
    const drawCover = (img: HTMLImageElement) => {
      const cw = canvas.width;
      const ch = canvas.height;
      const ir = img.naturalWidth / img.naturalHeight;
      const cr = cw / ch;
      let dw: number, dh: number;
      if (ir > cr) {
        dh = ch;
        dw = ch * ir;
      } else {
        dw = cw;
        dh = cw / ir;
      }
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    };

    // GSAP fires onUpdate every tick, but 144 frames spread over 4000px means many
    // ticks map to the same frame. Redrawing an identical frame is pure waste.
    const render = () => {
      const frameIndex = Math.min(frameCount - 1, Math.max(0, Math.round(state.frame)));
      if (frameIndex === drawnFrame) return;
      const img = images[frameIndex];
      if (!img || !img.complete || !img.naturalWidth) return;
      drawCover(img);
      drawnFrame = frameIndex;
    };

    for (let i = 0; i < frameCount; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.src = frameSrc(i);
      // Paint the opening frame the instant it arrives, rather than waiting on the
      // batched decode pass below — otherwise the hero sits black on first load.
      if (i === 0) {
        img.onload = () => {
          sizeCanvas();
          render();
        };
      }
      images.push(img);
    }

    sizeCanvas();
    render();

    // Decode ahead in small batches. Without this each frame decodes lazily on its
    // first paint, producing a visible hitch on the first pass through the sequence.
    let cancelled = false;
    (async () => {
      for (let i = 0; i < frameCount && !cancelled; i += 8) {
        await Promise.all(
          images.slice(i, i + 8).map((img) => img.decode().catch(() => undefined)),
        );
        if (i === 0) render();
      }
    })();

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: container,
        start: 'top top',
        end: '+=4000',
        // Lower scrub = the canvas tracks the scroll more tightly. At 1.5 the image
        // visibly lags the cursor, which reads as sluggish rather than smooth.
        scrub: prefersReducedMotion ? true : 0.6,
        pin: true,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        fastScrollEnd: true,
      },
    });

    tl.to(state, { frame: frameCount - 1, ease: 'none', onUpdate: render, duration: 10 }, 0);
    tl.fromTo(canvas, { scale: 1 }, { scale: 1.08, ease: 'none', duration: 10 }, 0);
    tl.to(overlay1Ref.current, { opacity: 0, y: -50, duration: 1 }, 0.5);
    tl.to(overlay4Ref.current, { opacity: 0, y: 50, duration: 1 }, 0.5);
    tl.to('.hero-dark-mask', { opacity: 0.3, duration: 2 }, 1);
    tl.fromTo(
      overlay2Ref.current,
      { opacity: 0, y: 30, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 1.5, ease: 'power2.out' },
      2,
    );
    tl.to(overlay2Ref.current, { opacity: 0, y: -30, duration: 1 }, 5);
    tl.fromTo(
      overlay3Ref.current,
      { opacity: 0, x: 50, scale: 0.95 },
      { opacity: 1, x: 0, scale: 1, duration: 1.5, ease: 'power2.out' },
      6,
    );
    tl.to(overlay3Ref.current, { opacity: 0, scale: 0.9, duration: 1 }, 9);
    tl.to('.hero-dark-mask', { opacity: 0.2, duration: 2 }, 8);

    const onResize = () => {
      sizeCanvas();
      render();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, []);

  return (
    <section ref={containerRef} className="relative w-full h-screen bg-black overflow-hidden mt-4 rounded-[40px] border border-white/10">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full origin-center [will-change:transform]" />
      <div className="hero-dark-mask absolute inset-0 bg-black opacity-30 pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_60%,_rgba(0,0,0,0.4)_100%)] pointer-events-none" />

      <div ref={overlay1Ref} className="absolute top-16 md:top-24 w-full flex flex-col items-center justify-start pointer-events-none z-10 px-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-6 backdrop-blur-md">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">Wrench 2.0 Live</span>
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-[-0.05em] leading-[1.05] text-white/80 mb-4 drop-shadow-2xl max-w-3xl">
          Assistance at the speed of thought.
        </h1>
      </div>

      <div ref={overlay4Ref} className="absolute bottom-12 w-full flex flex-col items-center justify-end pointer-events-none z-10 px-6 text-center">
        <p className="text-base text-white/50 font-light max-w-lg mb-8 drop-shadow-md">
          Scroll to experience the future of roadside recovery.
        </p>
        <div className="pointer-events-auto">
          <PillButton className="px-6 py-3 text-sm">See it in action</PillButton>
        </div>
      </div>

      <div ref={overlay2Ref} className="absolute left-8 md:left-[10%] top-[20%] w-72 bg-black/20 backdrop-blur-md rounded-2xl p-5 border border-white/10 shadow-2xl z-20 opacity-0 pointer-events-none">
        <div className="flex items-center justify-between mb-6">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Diagnostic Match</span>
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
          </div>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-black/40 border border-white/10 overflow-hidden flex-shrink-0 flex items-center justify-center">
            <User className="w-6 h-6 text-white/30" />
          </div>
          <div>
            <h4 className="text-white/70 font-medium">David Miller</h4>
            <p className="text-xs text-white/40">Certified Master Tech • 4.9★</p>
          </div>
        </div>
        <div className="w-full h-[1px] bg-white/10 mb-6"></div>
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/40">Issue</span>
            <span className="text-white/70 font-medium">Alternator Fault</span>
          </div>
          <div className="flex justify-between items-center text-sm">
            <span className="text-white/40">Equipment</span>
            <span className="text-white/70 font-medium">Diagnostic Kit, Battery</span>
          </div>
        </div>
      </div>

      <div ref={overlay3Ref} className="absolute right-8 md:right-[10%] bottom-[15%] w-auto pr-6 bg-black/20 backdrop-blur-md rounded-2xl p-2 border border-white/10 shadow-2xl z-30 opacity-0 pointer-events-none flex items-center p-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center flex-shrink-0 mr-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
          <Navigation className="w-5 h-5 text-zinc-950" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-white/50 animate-pulse"></div>
            <h4 className="text-white/70 font-medium text-sm">Mechanic is on the way</h4>
          </div>
          <p className="text-xs text-white/40 font-light">ETA: 4 minutes (1.2 miles away)</p>
        </div>
        <div className="ml-4 pl-4 border-l border-white/10 flex flex-col items-center justify-center">
          <Clock className="w-5 h-5 text-white/30 mb-1" />
          <span className="text-white/80 font-bold text-lg leading-none">4</span>
          <span className="text-[10px] uppercase text-white/30 font-bold tracking-widest">MIN</span>
        </div>
      </div>

    </section>
  );
};
