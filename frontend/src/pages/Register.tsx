import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { Eye, GoogleLogo, GithubLogo } from '@phosphor-icons/react';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { FloatingNavbar } from '../components/ui/FloatingNavbar';
import { AIGradientBorder } from '../components/ui/AIGradientBorder';
import SpecularButton from '../components/ui/SpecularButton';
import gsap from 'gsap';

const WrenchRegister: React.FC = () => {
  const navigate = useNavigate();
  const registerUser = useAuth((state) => state.register);
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    phone_number: '',
    role: 'CUSTOMER' as 'CUSTOMER' | 'MECHANIC',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    gsap.fromTo('.auth-card', 
      { y: 40, opacity: 0, scale: 0.95 },
      { y: 0, opacity: 1, scale: 1, duration: 1, ease: 'power3.out' }
    );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await registerUser(formData);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create your account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#000000] min-h-screen text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      <div className="grain-overlay pointer-events-none fixed inset-0 z-[100] opacity-15 mix-blend-overlay"></div>
      
      <FloatingNavbar />

      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-24 flex items-center justify-center">
        <section className="relative w-full min-h-[85vh] py-12 rounded-[40px] overflow-hidden bg-gradient-to-t from-black to-zinc-900 border border-white/10 flex items-center justify-center">
          
          {/* Landing Page Theme Background */}
          <div className="absolute inset-0 opacity-60 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-zinc-950 to-black"></div>
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[22vw] font-bold text-white opacity-5 blur-[2px] select-none pointer-events-none tracking-tighter w-full text-center">
            RESCUE
          </div>

          <div className="relative z-10 w-[50%] max-w-md auth-card opacity-0 min-w-[320px]">
            <AIGradientBorder className="rounded-[40px] border border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
              <div className="relative bg-zinc-950/[0.8] backdrop-blur-[40px] rounded-[40px] p-10">
              
              <div className="mb-10 text-center">
                <h2 className="text-3xl font-semibold text-white mb-2 tracking-tight">Create an account</h2>
                <p className="text-zinc-400 text-sm">Get started with Wrench for free.</p>
              </div>

              <div className="flex gap-4 mb-8">
                <button type="button" className="flex-1 h-11 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <GoogleLogo weight="bold" className="w-4 h-4" />
                  <span className="text-sm font-medium">Google</span>
                </button>
                <button type="button" className="flex-1 h-11 bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 rounded-xl flex items-center justify-center gap-2 transition-colors">
                  <GithubLogo weight="bold" className="w-4 h-4" />
                  <span className="text-sm font-medium">GitHub</span>
                </button>
              </div>

              <div className="flex items-center gap-4 mb-8">
                <div className="h-[1px] flex-1 bg-white/10"></div>
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Or with email</span>
                <div className="h-[1px] flex-1 bg-white/10"></div>
              </div>

              <form onSubmit={handleRegister} className="space-y-6">
                
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex flex-col items-center justify-center text-center">
                    <p className="text-red-400 text-sm font-medium">{error}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                    placeholder="name@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Phone</label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    required
                    pattern="\+?[1-9]\d{1,14}"
                    title="International format, e.g. +11234567890"
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all"
                    placeholder="+1234567890"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">I am a</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(['CUSTOMER', 'MECHANIC'] as const).map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, role: option }))}
                        className={`h-11 rounded-2xl border text-sm font-medium transition-colors ${
                          formData.role === option
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                            : 'bg-white/[0.03] border-white/10 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {option === 'CUSTOMER' ? 'Vehicle owner' : 'Mechanic'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500">Password</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl px-4 py-3.5 text-white placeholder-zinc-600 focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.05] transition-all pr-12"
                    placeholder="••••••••"
                  />
                  <button type="button" className="absolute right-4 top-[34px] text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-2 w-full">
                  <SpecularButton
                    type="submit"
                    disabled={loading}
                    className="w-full h-12"
                    tint="#10b981"
                    tintOpacity={1}
                    textColor="#ffffff"
                    lineColor="#a7f3d0"
                    baseColor="#047857"
                    radius={16}
                  >
                    <div className="flex items-center justify-center gap-2">
                      {loading ? 'Creating...' : 'Join Wrench'} <ArrowRight className="w-4 h-4" />
                    </div>
                  </SpecularButton>
                </div>
              </form>

              <div className="mt-8 text-center">
                <p className="text-zinc-500 text-sm">
                  Already have an account?{' '}
                  <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          </AIGradientBorder>
          </div>
        </section>
      </main>
    </div>
  );
};

export default WrenchRegister;
