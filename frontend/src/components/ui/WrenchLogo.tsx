import React from 'react';

interface WrenchLogoProps {
  className?: string; // Container classes (e.g., text sizing for wordmark)
  animated?: boolean; // Whether the scan beam animation is active
  compact?: boolean;  // If true, hides the 'WRENCH' wordmark
  size?: 'sm' | 'md' | 'lg'; // Scales the logo dimensions
}

export const WrenchLogo: React.FC<WrenchLogoProps> = ({ 
  className = '', 
  animated = false,
  compact = false,
  size = 'md'
}) => {
  const sizeConfig = {
    sm: { box: 'w-7 h-7 rounded-[8px] text-[12px]', text: 'text-[14px]', border: 'h-[1px]' },
    md: { box: 'w-[30px] h-[30px] rounded-[10px] text-sm', text: 'text-[17px]', border: 'h-[2px]' },
    lg: { box: 'w-10 h-10 rounded-xl text-lg', text: 'text-[22px]', border: 'h-[2px]' },
  };
  
  const current = sizeConfig[size];

  return (
    <div className={`flex items-center gap-3.5 ${className}`}>
      <div className={`relative ${current.box} shrink-0 border border-[#3ECF8E]/50 bg-[#3ECF8E]/10 flex items-center justify-center font-semibold text-[#3ECF8E] overflow-hidden`}>
        W
        <div 
          className={`absolute left-0 right-0 top-0 ${current.border}`}
          style={{ 
            background: 'linear-gradient(90deg, transparent, rgba(62,207,142,0.9), transparent)', 
            animation: animated ? 'v2-scan 4.5s ease-in-out infinite' : undefined 
          }}>
        </div>
      </div>
      {!compact && (
        <span className={`font-semibold ${current.text} leading-none tracking-[0.2em] uppercase`}>
          WRENCH
        </span>
      )}
    </div>
  );
};
