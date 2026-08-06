import React from 'react';
import { cn } from '../../lib/utils';

interface GlassMetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  metric: string;
  description: string;
  icon?: React.ReactNode;
}

export const GlassMetricCard = React.forwardRef<HTMLDivElement, GlassMetricCardProps>(
  ({ className, metric, description, icon, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'w-72 rounded-2xl bg-white/5 backdrop-blur-[12px] border border-white/10 p-5 flex flex-col justify-end transition-transform duration-300',
          className
        )}
        {...props}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-3xl font-semibold text-white tracking-tight">{metric}</span>
          {icon && <div className="text-white/60">{icon}</div>}
        </div>
        <p className="text-sm text-white/60 font-light leading-relaxed">
          {description}
        </p>
      </div>
    );
  }
);

GlassMetricCard.displayName = 'GlassMetricCard';
