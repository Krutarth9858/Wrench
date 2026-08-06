import React, { useEffect } from "react";
import { animate, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { twMerge } from "tailwind-merge";

interface AIGradientBorderProps {
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

export const AIGradientBorder: React.FC<AIGradientBorderProps> = ({
  children,
  className,
  duration = 4,
}) => {
  const turn = useMotionValue(0);

  useEffect(() => {
    animate(turn, 1, {
      ease: "linear",
      duration,
      repeat: Infinity,
    });
  }, [duration, turn]);

  // Updated gradient to match the emerald theme of the Wrench app, mixed with the original neon colors for a premium effect
  const gradient = useMotionTemplate`conic-gradient(from ${turn}turn, transparent 0%, rgba(16, 185, 129, 0) 5%, rgba(16, 185, 129, 1) 10%, rgba(52, 211, 153, 1) 18%, rgba(45, 212, 191, 1) 26%, rgba(56, 189, 248, 1) 34%, rgba(16, 185, 129, 1) 42%, rgba(20, 184, 166, 1) 46%, rgba(20, 184, 166, 0) 52%, transparent 56%)`;

  return (
    <div className={twMerge("relative p-px rounded-[40px]", className)}>
      <motion.div
        style={{ backgroundImage: gradient }}
        className="absolute inset-0 rounded-[inherit]"
      />

      <div className="relative rounded-[inherit] overflow-hidden h-full">
        <div className="relative h-full z-20">{children}</div>

        <motion.div
          className="opacity-70 blur-2xl pointer-events-none absolute inset-[-40%] z-10 overflow-hidden"
          style={{
            backgroundImage: gradient,
            WebkitMaskImage: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, black 100%)",
            maskImage: "radial-gradient(ellipse 100% 100% at 50% 50%, transparent 50%, black 100%)"
          }}
        ></motion.div>
      </div>
    </div>
  );
};
