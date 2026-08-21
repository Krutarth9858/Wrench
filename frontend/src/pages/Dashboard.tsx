import React from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { FloatingNavbar } from '../components/ui/FloatingNavbar';
import ProfileSettings from '../components/dashboard/ProfileSettings';
import MechanicProfilePanel from '../components/dashboard/MechanicProfilePanel';
import FindMechanics from '../components/dashboard/FindMechanics';
import MyBookings from '../components/dashboard/MyBookings';
import MechanicBookings from '../components/dashboard/MechanicBookings';
import { User, MapPin, Wrench, SignOut } from '@phosphor-icons/react';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const isMechanic = user?.role === 'MECHANIC';
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { name: 'My Profile', path: '/dashboard', icon: <User className="w-5 h-5" /> },
    ...(isMechanic
      ? [{ name: 'Bookings', path: '/dashboard/bookings', icon: <Wrench className="w-5 h-5" /> }]
      : [
          { name: 'Find Mechanics', path: '/dashboard/find', icon: <MapPin className="w-5 h-5" /> },
          { name: 'My Bookings', path: '/dashboard/bookings', icon: <Wrench className="w-5 h-5" /> },
        ]),
  ];

  return (
    <div className="bg-[#0A0A0B] min-h-screen text-white font-sans selection:bg-emerald-500/30">
      {/* Grayscale lineart grid — same treatment as the landing page's dark panels */}
      <div className="pointer-events-none fixed inset-0 opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-t from-[#18181B] via-transparent to-[#18181B]"></div>

      <FloatingNavbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="sticky top-28 bg-[#18181B] rounded-[40px] p-6 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
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
                element={isMechanic ? <MechanicProfilePanel /> : <ProfileSettings />}
              />
              <Route path="/find" element={<FindMechanics />} />
              <Route
                path="/bookings"
                element={isMechanic ? <MechanicBookings /> : <MyBookings />}
              />
            </Routes>
          </section>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;
