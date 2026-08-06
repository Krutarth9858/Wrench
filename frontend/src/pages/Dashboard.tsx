import React, { useState } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { FloatingNavbar } from '../components/ui/FloatingNavbar';
import ProfileSettings from '../components/dashboard/ProfileSettings';
import VehicleManager from '../components/dashboard/VehicleManager';
import { User, Car, SignOut } from '@phosphor-icons/react';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = [
    { name: 'My Profile', path: '/dashboard', icon: <User className="w-5 h-5" /> },
    { name: 'My Vehicles', path: '/dashboard/vehicles', icon: <Car className="w-5 h-5" /> },
  ];

  return (
    <div className="bg-[#000000] min-h-screen text-white font-sans selection:bg-emerald-500/30">
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-15 mix-blend-overlay"></div>
      
      {/* Background gradients */}
      <div className="fixed inset-0 opacity-40 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-black pointer-events-none"></div>

      <FloatingNavbar />

      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="sticky top-28 bg-white/[0.02] backdrop-blur-[40px] rounded-[32px] p-6 border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.5)]">
              <div className="mb-8">
                <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 font-semibold text-lg mb-4">
                  {user?.email?.[0].toUpperCase() || 'U'}
                </div>
                <h3 className="font-semibold text-white tracking-tight text-lg">{user?.role === 'mechanic' ? 'Mechanic Profile' : 'Customer Profile'}</h3>
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
              <Route path="/" element={<ProfileSettings />} />
              <Route path="/vehicles" element={<VehicleManager />} />
            </Routes>
          </section>

        </div>
      </main>
    </div>
  );
};

export default Dashboard;
