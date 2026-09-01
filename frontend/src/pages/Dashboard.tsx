import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { FloatingNavbar } from '../components/ui/FloatingNavbar';
import ProfileSettings from '../components/dashboard/ProfileSettings';
import MechanicProfilePanel from '../components/dashboard/MechanicProfilePanel';
import BookMechanic from '../components/dashboard/BookMechanic';
import Troubleshoot from '../components/dashboard/Troubleshoot';
import MyBookings from '../components/dashboard/MyBookings';
import MechanicBookings from '../components/dashboard/MechanicBookings';
import MechanicDispatch from '../components/dashboard/MechanicDispatch';
import MechanicSchedule from '../components/dashboard/MechanicSchedule';
import MechanicEarnings from '../components/dashboard/MechanicEarnings';
import NotFoundPanel from '../components/dashboard/NotFoundPanel';
import { User, MapPin, Toolbox, SignOut, SquaresFour, Tray, Clock, ToggleRight, Sparkle } from '@phosphor-icons/react';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const isMechanic = user?.role === 'MECHANIC';
  const location = useLocation();
  const navigate = useNavigate();
  const isMapPage = (location.pathname === '/dashboard/find' && !isMechanic) || (location.pathname === '/dashboard' && isMechanic);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = isMechanic
    ? [
        { name: 'Dashboard', path: '/dashboard', icon: <SquaresFour className="w-5 h-5" /> },
        { name: 'Requests', path: '/dashboard/requests', icon: <Tray className="w-5 h-5" /> },
        { name: 'Active Services', path: '/dashboard/active', icon: <Toolbox className="w-5 h-5" /> },
        { name: 'History', path: '/dashboard/history', icon: <Clock className="w-5 h-5" /> },
        { name: 'Availability', path: '/dashboard/availability', icon: <ToggleRight className="w-5 h-5" /> },
        { name: 'Profile', path: '/dashboard/profile', icon: <User className="w-5 h-5" /> },
      ]
    : [
        { name: 'My Profile', path: '/dashboard', icon: <User className="w-5 h-5" /> },
        { name: 'Troubleshoot', path: '/dashboard/troubleshoot', icon: <Sparkle className="w-5 h-5" /> },
        { name: 'Book a Mechanic', path: '/dashboard/find', icon: <MapPin className="w-5 h-5" /> },
        { name: 'My Bookings', path: '/dashboard/bookings', icon: <Toolbox className="w-5 h-5" /> },
      ];


  return (
    <div
      className={`h-screen overflow-hidden font-sans selection:bg-[#00966B]/30 ${
        isMapPage ? '' : 'bg-[#0A0A0B] pt-28 text-white'
      }`}
      style={isMapPage ? { background: 'linear-gradient(180deg, #EBF3FC, #F5F9FD)' } : undefined}
    >
      {/* Grayscale lineart grid — same treatment as the landing page's dark panels */}
      {!isMapPage && (
        <>
          <div className="pointer-events-none fixed inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
          <div className="pointer-events-none fixed inset-0 bg-gradient-to-t from-[#18181B] via-transparent to-[#18181B]"></div>
        </>
      )}

      <FloatingNavbar />

      {/* Dashboard content scrolls inside its own region *below* the fixed navbar
          rather than the window scrolling underneath it. Without this, any control
          that scrolled into the navbar's band became unclickable — the navbar's own
          pills legitimately own those pixels, so no z-index on the control can help.
          The clearance is padding on the *clipping* parent, not on the scroll box:
          padding inside a scroller scrolls away and stops clearing anything. */}
      <div className={`relative h-full overflow-y-auto ${isMapPage ? '' : 'pb-12'}`}>
        {isMapPage ? (
          <main className="h-full w-full">
            <Routes>
              {isMechanic ? (
                <Route path="/" element={<MechanicDispatch />} />
              ) : (
                <Route path="/find" element={<BookMechanic />} />
              )}
            </Routes>
          </main>
        ) : (
          <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="sticky top-28 glass-panel p-6">
              <div className="mb-8">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400 mb-4 block">
                  Account
                </span>
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-emerald-400 font-semibold text-lg mb-4">
                  {user?.email?.[0].toUpperCase() || 'U'}
                </div>
                <h3 className="font-semibold text-white tracking-tight text-lg">{isMechanic ? 'Mechanic Profile' : 'Customer Profile'}</h3>
                <p className="text-zinc-400 text-sm truncate">{user?.email}</p>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path || (location.pathname === '/dashboard/' && item.path === '/dashboard');
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 ${
                        isActive 
                          ? 'bg-white/10 text-white shadow-sm' 
                          : 'text-zinc-400 hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      {item.icon}
                      <span className="font-medium text-sm">{item.name}</span>
                    </Link>
                  );
                })}

                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors mt-8"
                >
                  <SignOut className="w-5 h-5" />
                  <span className="font-medium text-sm">Sign Out</span>
                </button>
              </nav>
            </div>
          </aside>

          {/* Main Content Area */}
          <section className="flex-1 min-w-0">
            <Routes>
              <Route
                path="/"
                element={isMechanic ? <MechanicDispatch /> : <ProfileSettings />}
              />
              {isMechanic ? (
                <>
                  <Route path="/requests" element={<MechanicBookings view="requests" />} />
                  <Route path="/active" element={<MechanicBookings view="active" />} />
                  <Route path="/history" element={<MechanicBookings view="history" />} />
                  <Route path="/availability" element={<MechanicProfilePanel />} />
                  <Route path="/profile" element={<MechanicProfilePanel />} />
                  <Route path="/bookings" element={<MechanicBookings />} />
                  <Route path="/schedule" element={<MechanicSchedule />} />
                  <Route path="/earnings" element={<MechanicEarnings />} />
                </>
              ) : (
                <>
                  <Route path="/troubleshoot" element={<Troubleshoot />} />
                  <Route path="/bookings" element={<MyBookings />} />
                </>
              )}
              <Route path="*" element={<NotFoundPanel />} />
            </Routes>
          </section>

          </div>
        </main>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
