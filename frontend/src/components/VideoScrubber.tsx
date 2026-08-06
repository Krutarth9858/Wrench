import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const FRAME_COUNT = 144; // Total video frames

const VideoScrubber: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadedImages: HTMLImageElement[] = [];
    let loadCount = 0;

    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      const number = i.toString().padStart(4, '0');
      img.src = `/frames/frame_${number}.png`;
      img.onload = () => {
        loadCount++;
        if (loadCount === FRAME_COUNT) {
          setLoaded(true);
        }
      };
      loadedImages.push(img);
    }
    setImages(loadedImages);
  }, []);

  useEffect(() => {
    if (!loaded || !canvasRef.current || images.length === 0) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;

    const renderFrame = (index: number) => {
      if (!images[index]) return;
      const img = images[index];

      const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const x = canvas.width / 2 - (img.width / 2) * scale;
      const y = canvas.height / 2 - (img.height / 2) * scale;

      context.fillStyle = '#000';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, x, y, img.width * scale, img.height * scale);
    };

    const playhead = { frame: 0 };
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      renderFrame(Math.round(playhead.frame));
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const st = ScrollTrigger.create({
      trigger: '#main-story',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1,
      onUpdate: (self) => {
        // We stop the video around 60% of the total scroll so it stays static for the bottom sections
        const adjustedProgress = Math.min(1, self.progress * 1.5);
        playhead.frame = adjustedProgress * (FRAME_COUNT - 1);
        requestAnimationFrame(() => renderFrame(Math.round(playhead.frame)));
      },
    });

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      st.kill();
    };
  }, [loaded, images]);

  return (
    <div className="fixed top-0 left-0 w-full h-full z-0">
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 tracking-[0.2em] text-sm uppercase z-10 bg-[#0F172A]">
          Initializing Experience...
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-cover"
        style={{ display: loaded ? 'block' : 'none' }}
      />
      {/* Cinematic vignette / dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/80 via-[#0F172A]/40 to-[#0F172A] pointer-events-none" />
    </div>
  );
};

export default VideoScrubber;
