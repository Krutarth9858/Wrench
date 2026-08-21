import React from 'react';
import { cn } from '../../lib/utils';
import { PillButton } from './PillButton';
import { ArrowUpRight, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';

interface FloatingNavbarProps extends React.HTMLAttributes<HTMLDivElement> {}

export const FloatingNavbar = React.forwardRef<HTMLDivElement, FloatingNavbarProps>(
  ({ className, ...props }, ref) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
      void logout();
      navigate('/');
    };

    return (
      <div
        ref={ref}
        className={cn(
          'fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between w-full max-w-[1400px] px-8 pointer-events-none',
          className
        )}
        {...props}
      >
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2 pointer-events-auto cursor-pointer">
          <div className="w-8 h-8 bg-white/10 rounded-md border border-white/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
          </div>
          <span className="text-white font-medium text-lg tracking-tight">Wrench.</span>
        </Link>

        {/* Center Pill Nav */}
        <div className="pointer-events-auto flex items-center gap-1 bg-white/5 backdrop-blur-[20px] border border-white/10 rounded-full p-[1.5px]">
          {['Capabilities', 'Network', 'Mechanics', 'Pricing'].map((item) => (
            <button
              key={item}
              className="px-6 py-2 rounded-full text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white transition-colors"
            >
              {item}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div className="pointer-events-auto flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-white/80 hidden md:block">
                {user.email}
              </span>
              <button 
                onClick={handleLogout}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-colors"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
              <Link to="/dashboard">
                <PillButton icon={<ArrowUpRight className="w-5 h-5 text-white" />}>
                  Dashboard
                </PillButton>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login">
                <button className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
                  <span className="font-mono text-xs">&gt;_</span>
                </button>
              </Link>
              <Link to="/register">
                <PillButton icon={<ArrowUpRight className="w-5 h-5 text-white" />}>
                  Request Assistance
                </PillButton>
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }
);

FloatingNavbar.displayName = 'FloatingNavbar';
