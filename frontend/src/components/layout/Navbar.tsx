import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-0 left-0 w-full z-50 transition-all duration-500 ease-out border-b',
        scrolled
          ? 'bg-slate-900/80 backdrop-blur-md py-4 border-slate-800 shadow-sm'
          : 'bg-transparent py-6 border-transparent',
      )}
    >
      <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-tight text-slate-50">Wrench</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
          <a href="#" className="hover:text-white transition-colors">
            How it works
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Mechanics
          </a>
          <a href="#" className="hover:text-white transition-colors">
            Company
          </a>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="#"
            className="hidden md:block text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Log in
          </a>
          <Button size="sm">Get the App</Button>
        </div>
      </div>
    </nav>
  );
};
