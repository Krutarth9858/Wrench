import { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../lib/utils';
import { WrenchLogo } from '../ui/WrenchLogo';

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
          <WrenchLogo size="sm" />
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
