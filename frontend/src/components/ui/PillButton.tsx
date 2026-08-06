import React from 'react';
import { cn } from '../../lib/utils';
import { ArrowRight } from 'lucide-react';

interface PillButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, children, icon = <ArrowRight className="w-5 h-5 text-white" />, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'group relative inline-flex items-center gap-4 bg-white rounded-full pl-6 pr-2 py-2 text-zinc-900 font-medium transition-transform duration-300 hover:scale-105',
          className
        )}
        {...props}
      >
        <span>{children}</span>
        <div className="w-10 h-10 rounded-full bg-zinc-900 flex items-center justify-center transition-colors duration-300 group-hover:bg-zinc-700">
          {icon}
        </div>
      </button>
    );
  }
);

PillButton.displayName = 'PillButton';
