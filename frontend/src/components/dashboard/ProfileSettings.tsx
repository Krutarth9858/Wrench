import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { MapPin, User, SpinnerGap, Toolbox } from '@phosphor-icons/react';
import SpecularButton from '../ui/SpecularButton';
import gsap from 'gsap';

export default function ProfileSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Common Profile Fields
  const [name, setName] = useState('John Doe');
  const [phone, setPhone] = useState(user?.phone_number || '');
  const [address, setAddress] = useState('123 Main St, Tech City');

  // Mechanic Specific Fields
  const [serviceRadius, setServiceRadius] = useState('15');
  const [hourlyRate, setHourlyRate] = useState('85');
  const [specialties, setSpecialties] = useState('Engine, Brakes, Transmission');

  useEffect(() => {
    gsap.fromTo('.profile-anim', 
      { y: 20, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.1 }
    );
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    
    // MOCK SAVE API
    await new Promise(r => setTimeout(r, 1200));
    
    setLoading(false);
    setMessage('Profile updated successfully.');
    
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="relative overflow-hidden bg-[#18181B] rounded-[40px] p-8 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.5)] profile-anim">
      
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-white tracking-tight">Profile Settings</h2>
        <p className="text-zinc-400 text-sm mt-1">Manage your account information and preferences.</p>
      </div>

      {message && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400 text-sm font-medium profile-anim">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Basic Info */}
        <div className="space-y-4 profile-anim">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 border-b border-white/10 pb-2">Basic Info</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                />
                <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Email Address</label>
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full bg-white/[0.01] border border-white/5 rounded-2xl px-4 py-3 text-zinc-500 cursor-not-allowed"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Primary Address</label>
              <div className="relative">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                />
                <MapPin className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Mechanic Specific Info */}
        {user?.role === 'MECHANIC' && (
          <div className="space-y-4 profile-anim pt-4">
            <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-zinc-500 border-b border-white/10 pb-2">Mechanic Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Service Radius (Miles)</label>
                <input
                  type="number"
                  value={serviceRadius}
                  onChange={(e) => setServiceRadius(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Hourly Rate ($)</label>
                <input
                  type="number"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Specialties (Comma separated)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3 pl-11 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                  />
                  <Toolbox className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="pt-6 profile-anim flex justify-end">
          <SpecularButton
            type="submit"
            disabled={loading}
            className="h-11 px-6"
            tint="#10b981"
            tintOpacity={1}
            textColor="#ffffff"
            lineColor="#a7f3d0"
            baseColor="#047857"
            radius={16}
          >
            <div className="flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <SpinnerGap className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </div>
          </SpecularButton>
        </div>

      </form>
    </div>
  );
}
