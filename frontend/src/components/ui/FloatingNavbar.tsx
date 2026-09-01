import React from 'react';
import { cn } from '../../lib/utils';
import { PillButton } from './PillButton';
import { ArrowUpRight, MapPin, Calendar, Headphones, ChevronDown } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { WrenchLogo } from './WrenchLogo';
import { NotificationBell } from './NotificationBell';

const BRAND = '#00966B';

interface FloatingNavbarProps extends React.HTMLAttributes<HTMLDivElement> { }

export const FloatingNavbar = React.forwardRef<HTMLDivElement, FloatingNavbarProps>(
  ({ className, ...props }, ref) => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const isMechanic = user?.role === 'MECHANIC';
    const isMapPage = (location.pathname === '/dashboard/find' && !isMechanic) || 
                      (location.pathname.startsWith('/booking/') && !isMechanic) || 
                      (location.pathname === '/dashboard' && isMechanic);
    const usePremiumNavbar = isMapPage || isMechanic;
    const isDark = !isMapPage;

    const [isOnline, setIsOnline] = React.useState<boolean | null>(null);
    const [mechanicProfile, setMechanicProfile] = React.useState<{ garage_name: string } | null>(null);

    React.useEffect(() => {
      if (isMechanic) {
        import('../../lib/mechanic').then(({ getAvailability, getMechanicProfile }) => {
          getAvailability().then(res => setIsOnline(res.is_available)).catch(() => {});
          getMechanicProfile().then(res => setMechanicProfile({ garage_name: res.garage_name })).catch(() => {});
        });
      }
    }, [isMechanic]);

    const handleLogout = () => {
      void logout();
      navigate('/');
    };

    const navLinks = isMechanic ? [
      { to: '/dashboard', icon: Calendar, label: 'Bookings' },
      { to: '/dashboard/schedule', icon: Calendar, label: 'Schedule' },
      { to: '/dashboard/earnings', icon: Calendar, label: 'Earnings' },
      { to: '/dashboard/profile', icon: MapPin, label: 'Profile' }
    ] : [
      { to: '/dashboard/find', icon: MapPin, label: 'Find Mechanic' },
      { to: '/dashboard/bookings', icon: Calendar, label: 'My Bookings' },
      { to: '#', icon: Headphones, label: 'Help', isButton: true },
    ];

    /* ── Premium floating glass bar ── */
    if (usePremiumNavbar) {
      return (
        <div
          ref={ref}
          className={cn(
            'fixed top-4 left-4 right-4 z-[500] flex items-center justify-between h-[56px] px-5 rounded-[20px] transition-colors duration-300',
            className
          )}
          style={{
            background: isDark ? 'rgba(20,20,22,0.75)' : 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px) saturate(140%)',
            WebkitBackdropFilter: 'blur(20px) saturate(140%)',
            border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.7)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}
          {...props}
        >
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <WrenchLogo size="sm" compact className={isDark ? "text-white" : "text-gray-900"} />
          </Link>

          {/* Center Nav */}
          <nav className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.to;
              const Icon = link.icon;
              const El = link.isButton ? 'button' : Link;
              const elProps = link.isButton ? {} : { to: link.to };

              return (
                <El key={link.label} {...(elProps as any)}
                  className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                  style={isActive ? {
                    background: isDark ? `${BRAND}15` : `${BRAND}0c`,
                    color: isDark ? '#34d399' : BRAND,
                    border: `1px solid ${BRAND}20`,
                  } : {
                    color: isDark ? '#9CA3AF' : '#6B7280',
                    border: '1px solid transparent',
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {link.label}
                </El>
              );
            })}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-3 shrink-0">
            {user ? (
              <>
                <NotificationBell dark={isDark} />
                <div className="flex items-center gap-2 pl-2 cursor-pointer group"
                  style={{ borderLeft: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.06)' }}
                  onClick={handleLogout} title="Log Out">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ background: BRAND }}>
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium group-hover:opacity-70 transition-opacity hidden sm:inline" style={{ color: isDark ? '#FFFFFF' : '#111827' }}>
                    {isMechanic && mechanicProfile ? mechanicProfile.garage_name : user.email.split('@')[0]}
                    {isMechanic && isOnline !== null && (
                      <span className="block text-[11px] font-normal" style={{ color: isOnline ? (isDark ? '#34d399' : BRAND) : '#9CA3AF', marginTop: '-2px' }}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    )}
                  </span>
                  <ChevronDown className="w-4 h-4 hidden sm:block" style={{ color: '#9CA3AF' }} />
                </div>
              </>
            ) : (
              <>
                <Link to="/login">
                  <button className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white hover:bg-white/10 transition-colors">
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

    /* ── Non-map pages: existing dark floating nav ── */
    return (
      <div
        ref={ref}
        className={cn(
          'fixed top-6 left-1/2 -translate-x-1/2 z-[500] flex items-center justify-between w-full max-w-[1400px] px-8 pointer-events-none',
          className
        )}
        {...props}
      >
        <Link to="/" className="flex items-center gap-2 pointer-events-auto cursor-pointer">
          <WrenchLogo size="sm" className="text-white" />
        </Link>

        <div className="pointer-events-auto flex items-center gap-2 glass-nav rounded-full p-2 border border-white/10 bg-black/20 backdrop-blur-md">
          <Link to="/dashboard/find" className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-colors">
            <MapPin className="w-4 h-4" />
            Find Mechanic
          </Link>
          <Link to="/dashboard/bookings" className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <Calendar className="w-4 h-4" />
            My Bookings
          </Link>
          <button className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors">
            <Headphones className="w-4 h-4" />
            Help
          </button>
        </div>

        <div className="pointer-events-auto flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-4">
              <NotificationBell />
              <div className="flex items-center gap-3 pl-4 border-l border-white/10 cursor-pointer group" onClick={handleLogout} title="Log Out">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-800 border border-white/10 text-sm font-semibold text-white group-hover:border-red-500/50 transition-colors">
                  {user.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-2 hidden sm:flex">
                  <span className="text-sm font-medium text-white group-hover:text-red-400 transition-colors">
                    {user.email.split('@')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4 text-zinc-500 group-hover:text-red-400 transition-colors" />
                </div>
              </div>
            </div>
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
