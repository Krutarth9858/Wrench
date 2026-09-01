import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { Link, useNavigate } from 'react-router-dom';
import { WrenchLogo } from '../components/ui/WrenchLogo';

const WrenchLogin: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuth((state) => state.login);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [focusField, setFocusField] = useState<'email' | 'password' | null>(null);
  
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s + 1) % 5);
    }, 1900);
    const timeout = setTimeout(() => setStep(1), 900);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  const getStepStyle = (i: number) => {
    const reached = step >= i;
    const active = step === i;
    return {
      opacity: reached ? 1 : 0.18,
      transform: reached ? 'translateY(0)' : 'translateY(8px)',
      border: active ? '1px solid rgba(62,207,142,0.42)' : reached ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(255,255,255,0.05)',
      background: active ? 'rgba(62,207,142,0.07)' : reached ? 'rgba(255,255,255,0.035)' : 'rgba(255,255,255,0.015)'
    };
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07080A] text-[#F0F4F2] font-sans selection:bg-[#3ECF8E]/30">
      {/* Background Layers */}
      <div className="absolute inset-[-120px] pointer-events-none opacity-40"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px),linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)',
          backgroundSize: '96px 96px',
          animation: 'v2-drift 26s linear infinite',
          WebkitMaskImage: 'radial-gradient(110% 95% at 24% 30%, #000 0%, transparent 72%)',
          maskImage: 'radial-gradient(110% 95% at 24% 30%, #000 0%, transparent 72%)'
        }}></div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(100% 78% at 8% 4%, rgba(62,207,142,0.13), transparent 58%),radial-gradient(80% 60% at 96% 92%, rgba(90,130,255,0.06), transparent 62%)' }}></div>
      <div className="absolute left-[6%] top-[-30%] w-[2px] h-[160%] rotate-[15deg] pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent, rgba(62,207,142,0.5), transparent)', animation: 'v2-beam 7s ease-in-out infinite' }}></div>
      <div className="absolute left-[14%] top-[-30%] w-[1px] h-[160%] rotate-[15deg] pointer-events-none" style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.14), transparent)', animation: 'v2-beam 9s ease-in-out 1.4s infinite' }}></div>
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_260px_70px_rgba(0,0,0,0.8)]"></div>

      <div className="relative flex items-stretch min-h-screen flex-col lg:flex-row">
        {/* Left Side: Product Flow */}
        <section className="flex-[1.2] flex flex-col justify-center gap-[clamp(24px,3.4vh,42px)] p-[clamp(34px,4.6vw,78px)_clamp(26px,4.4vw,62px)]">
          <header className="flex items-center gap-3.5" style={{ animation: 'v2-rise 700ms cubic-bezier(.2,.75,.3,1) both' }}>
            <WrenchLogo animated={true} />
            <span className="w-px h-3.5 bg-white/15"></span>
            <span className="font-mono font-medium text-[9.5px] leading-none tracking-[0.26em] text-[#F0F4F2]/40 uppercase">ROADSIDE ASSISTANCE</span>
          </header>

          <div className="flex flex-col gap-[18px]">
            <h1 className="m-0 max-w-[15ch] font-semibold text-[clamp(38px,4.8vw,66px)] leading-[1.02] tracking-[-0.035em] text-wrap-pretty" style={{ animation: 'v2-mask 1100ms cubic-bezier(.16,.9,.2,1) 160ms both' }}>Help is closer than you think.</h1>
            <p className="m-0 max-w-[36ch] font-light text-[clamp(14px,1.05vw,16.5px)] leading-[1.7] text-[#F0F4F2]/55" style={{ animation: 'v2-rise 800ms cubic-bezier(.2,.75,.3,1) 420ms both' }}>Diagnose the problem. Find a nearby mechanic. Get back on the road.</p>
          </div>

          <div className="hidden lg:flex flex-col gap-0 w-full max-w-[432px]" style={{ animation: 'v2-rise 900ms cubic-bezier(.2,.75,.3,1) 560ms both' }}>
            {/* Step 1 */}
            <div className="p-[15px_17px] rounded-2xl transition-all duration-600 ease-in-out" style={getStepStyle(1)}>
              <div className="flex flex-col gap-[7px]">
                <span className="font-mono font-medium text-[9px] leading-none tracking-[0.22em] text-[#F0F4F2]/40">CUSTOMER PROBLEM</span>
                <span className="font-normal text-[15px] leading-[1.4]">“My bike won’t start.”</span>
              </div>
            </div>
            <div className="h-[18px] ml-[24px] w-px" style={{ background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 8px)' }}></div>

            {/* Step 2 */}
            <div className="p-[15px_17px] rounded-2xl transition-all duration-600 ease-in-out" style={getStepStyle(2)}>
              <div className="flex flex-col gap-[7px]">
                <span className="font-mono font-medium text-[9px] leading-none tracking-[0.22em] text-[#3ECF8E]/85">WRENCH AI</span>
                <div className="flex items-center gap-2.5">
                  <span className="font-normal text-[15px] leading-[1.4]">“Let’s check a few things.”</span>
                  <span className="flex gap-[3px]" style={{ opacity: step >= 2 ? 1 : 0.18 }}>
                    <span className="w-1 h-1 rounded-full bg-[#3ECF8E]" style={{ animation: 'v2-beam 1.2s ease-in-out infinite' }}></span>
                    <span className="w-1 h-1 rounded-full bg-[#3ECF8E]" style={{ animation: 'v2-beam 1.2s ease-in-out .2s infinite' }}></span>
                    <span className="w-1 h-1 rounded-full bg-[#3ECF8E]" style={{ animation: 'v2-beam 1.2s ease-in-out .4s infinite' }}></span>
                  </span>
                </div>
              </div>
            </div>
            <div className="h-[18px] ml-[24px] w-px" style={{ background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 8px)' }}></div>

            {/* Step 3 */}
            <div className="p-[15px_17px] rounded-2xl transition-all duration-600 ease-in-out" style={getStepStyle(3)}>
              <div className="flex flex-col gap-[13px]">
                <span className="font-mono font-medium text-[9px] leading-none tracking-[0.22em] text-[#F0F4F2]/40">DIAGNOSTIC</span>
                <div className="flex flex-col gap-[3px]">
                  <span className="font-light text-[11px] leading-none text-[#F0F4F2]/45">Possible issue</span>
                  <span className="font-medium text-[15px] leading-[1.3]">Battery / starter system</span>
                </div>
                <div className="flex flex-col gap-[7px]">
                  <div className="flex justify-between items-baseline">
                    <span className="font-light text-[11px] leading-none text-[#F0F4F2]/45">Confidence</span>
                    <span className="font-mono font-medium text-[11px] leading-none text-[#3ECF8E]">60%</span>
                  </div>
                  <div className="h-[3px] rounded-[2px] bg-white/10 overflow-hidden">
                    <div className="h-full rounded-[2px] transition-all duration-[1400ms] ease-[cubic-bezier(.16,.9,.2,1)]" style={{ background: 'linear-gradient(90deg, rgba(62,207,142,0.45), #3ECF8E)', width: step >= 3 ? '60%' : '0%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="h-[18px] ml-[24px] w-px" style={{ background: 'repeating-linear-gradient(180deg, rgba(255,255,255,0.22) 0 4px, transparent 4px 8px)' }}></div>

            {/* Step 4 */}
            <div className="p-[16px_17px] rounded-2xl transition-all duration-600 ease-in-out shadow-[0_24px_60px_-40px_rgba(0,0,0,0.95)]" style={getStepStyle(4)}>
              <div className="flex flex-col gap-[14px]">
                <span className="font-mono font-medium text-[9px] leading-none tracking-[0.22em] text-[#F0F4F2]/40">MECHANIC MATCH</span>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-[5px]">
                    <span className="font-semibold text-[16px] leading-[1.2]">MV Motors</span>
                    <div className="flex items-center gap-[9px] font-light text-[12px] leading-none text-[#F0F4F2]/50">
                      <span className="text-[#F0F4F2]/80">★ 4.9</span>
                      <span className="w-[3px] h-[3px] rounded-full bg-[#F0F4F2]/25"></span>
                      <span>2.4 km away</span>
                    </div>
                  </div>
                  <span className="flex-none px-2.5 py-1.5 rounded-full bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 font-mono font-medium text-[9px] leading-none tracking-[0.16em] text-[#3ECF8E]">AVAILABLE</span>
                </div>
                <div className="flex items-center gap-[11px] pt-[13px] border-t border-white/5">
                  <div className="relative flex items-center justify-center w-3 h-3 flex-none">
                    <span className="absolute w-3 h-3 rounded-full border border-[#F0F4F2]/50" style={{ animation: 'v2-radar 2.8s cubic-bezier(.2,.7,.3,1) infinite' }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#F0F4F2]"></span>
                  </div>
                  <span className="font-light text-[11px] leading-none text-[#F0F4F2]/60">You</span>
                  <div className="flex-1 h-px" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(62,207,142,0.7) 0 7px, transparent 7px 12px)', animation: 'v2-dash 900ms linear infinite' }}></div>
                  <span className="font-mono font-medium text-[10px] leading-none text-[#F0F4F2]/40">2.4 km</span>
                  <div className="flex-1 h-px" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(62,207,142,0.7) 0 7px, transparent 7px 12px)', animation: 'v2-dash 900ms linear infinite' }}></div>
                  <span className="font-light text-[11px] leading-none text-[#F0F4F2]/80">MV Motors</span>
                  <span className="w-[7px] h-[7px] rounded-[2px] bg-[#3ECF8E] flex-none shadow-[0_0_0_4px_rgba(62,207,142,0.16)]"></span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex lg:hidden items-center gap-[11px] p-[12px_14px] rounded-[14px] bg-white/5 border border-white/10 mt-4">
            <span className="w-[7px] h-[7px] rounded-full bg-[#F0F4F2] flex-none"></span>
            <span className="font-light text-[11px] leading-none text-[#F0F4F2]/55">You</span>
            <div className="flex-1 h-px" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(62,207,142,0.7) 0 7px, transparent 7px 12px)', animation: 'v2-dash 900ms linear infinite' }}></div>
            <span className="font-mono font-medium text-[10px] leading-none text-[#F0F4F2]/40">2.4 km</span>
            <span className="font-light text-[11px] leading-none text-[#F0F4F2]/80">MV Motors</span>
            <span className="w-[7px] h-[7px] rounded-[2px] bg-[#3ECF8E] flex-none"></span>
          </div>
        </section>

        {/* Right Side: Login Form */}
        <section className="flex-1 flex items-center justify-center p-[clamp(30px,4vw,64px)_clamp(22px,3.4vw,56px)] z-10 relative">
          <div className="relative w-full max-w-[416px] rounded-[26px] p-[clamp(26px,2.6vw,36px)] bg-[#16191A]/70 backdrop-blur-[34px] border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),inset_0_-1px_0_0_rgba(0,0,0,0.45),0_46px_100px_-46px_rgba(0,0,0,0.95)]" style={{ animation: 'v2-rise 760ms cubic-bezier(.16,.9,.2,1) both' }}>
            
            <div className="absolute top-0 left-[18%] right-[18%] h-px overflow-hidden pointer-events-none">
              <div className="w-[40%] h-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(124,231,186,0.95), transparent)', animation: 'v2-sweep 5.5s cubic-bezier(.45,0,.55,1) infinite' }}></div>
            </div>

            <div className="flex flex-col gap-[26px]">
              <div className="flex flex-col gap-[7px]" style={{ animation: 'v2-rise 640ms cubic-bezier(.2,.75,.3,1) 120ms both' }}>
                <h2 className="m-0 font-semibold text-[27px] leading-[1.12] tracking-[-0.028em]">Welcome back</h2>
                <p className="m-0 font-light text-[13.5px] leading-[1.5] text-[#F0F4F2]/50">Sign in to Wrench</p>
              </div>

              <form onSubmit={handleLogin} className="flex flex-col gap-[16px]">
                <label className="flex flex-col gap-[8px]" style={{ animation: 'v2-rise 640ms cubic-bezier(.2,.75,.3,1) 220ms both' }}>
                  <span className="font-mono font-medium text-[9px] leading-none tracking-[0.2em] transition-colors duration-300" style={{ color: focusField === 'email' ? '#3ECF8E' : 'rgba(240,244,242,0.45)' }}>EMAIL</span>
                  <div className="relative group">
                    <input type="email" placeholder="Enter your email" autoComplete="email" required
                      value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      onFocus={() => setFocusField('email')} onBlur={() => setFocusField(null)}
                      className="w-full h-[51px] px-[15px] rounded-[14px] bg-white/5 border border-white/10 text-[#F0F4F2] font-light text-[15px] leading-none outline-none transition-all duration-300 hover:border-white/20 focus:border-[#3ECF8E]/60 focus:shadow-[0_0_0_3px_rgba(62,207,142,0.14)] focus:bg-white/10"
                    />
                    <div className="absolute left-[14px] right-[14px] bottom-0 h-px overflow-hidden pointer-events-none transition-opacity duration-300" style={{ opacity: focusField === 'email' ? 1 : 0 }}>
                      <div className="w-[32%] h-full" style={{ background: 'linear-gradient(90deg, transparent, #3ECF8E, transparent)', animation: 'v2-sweep 1500ms cubic-bezier(.45,0,.55,1) infinite' }}></div>
                    </div>
                  </div>
                </label>

                <label className="flex flex-col gap-[8px]" style={{ animation: 'v2-rise 640ms cubic-bezier(.2,.75,.3,1) 300ms both' }}>
                  <span className="font-mono font-medium text-[9px] leading-none tracking-[0.2em] transition-colors duration-300" style={{ color: focusField === 'password' ? '#3ECF8E' : 'rgba(240,244,242,0.45)' }}>PASSWORD</span>
                  <div className="relative group">
                    <input type={showPassword ? 'text' : 'password'} placeholder="Enter your password" autoComplete="current-password" required
                      value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
                      onFocus={() => setFocusField('password')} onBlur={() => setFocusField(null)}
                      className="w-full h-[51px] pl-[15px] pr-[40px] rounded-[14px] bg-white/5 border border-white/10 text-[#F0F4F2] font-light text-[15px] leading-none outline-none transition-all duration-300 hover:border-white/20 focus:border-[#3ECF8E]/60 focus:shadow-[0_0_0_3px_rgba(62,207,142,0.14)] focus:bg-white/10"
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-[14px] top-[17px] text-[#F0F4F2]/50 hover:text-[#F0F4F2] transition-colors">
                      {showPassword ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <div className="absolute left-[14px] right-[14px] bottom-0 h-px overflow-hidden pointer-events-none transition-opacity duration-300" style={{ opacity: focusField === 'password' ? 1 : 0 }}>
                      <div className="w-[32%] h-full" style={{ background: 'linear-gradient(90deg, transparent, #3ECF8E, transparent)', animation: 'v2-sweep 1500ms cubic-bezier(.45,0,.55,1) infinite' }}></div>
                    </div>
                  </div>
                </label>

                <div className="flex justify-end mt-[-4px]" style={{ animation: 'v2-rise 640ms cubic-bezier(.2,.75,.3,1) 360ms both' }}>
                  <a href="#" className="font-light text-[12.5px] leading-none text-[#F0F4F2]/50 hover:text-[#3ECF8E] transition-colors">Forgot password?</a>
                </div>

                {error && (
                  <div role="alert" className="flex items-center gap-[10px] p-[11px_13px] rounded-[12px] bg-[#E07864]/10 border border-[#E07864]/25" style={{ animation: 'v2-rise 260ms ease both' }}>
                    <span className="flex-none w-[5px] h-[5px] rounded-full bg-[#E0806E]"></span>
                    <span className="font-light text-[13px] leading-[1.4] text-[#EFB2A4]">{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading} className="relative overflow-hidden mt-1 h-[53px] border-none rounded-[14px] bg-[#3ECF8E] text-[#052018] font-semibold text-[15px] leading-none flex items-center justify-center gap-[10px] cursor-pointer transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-14px_rgba(62,207,142,0.9)] active:translate-y-0 active:brightness-95 shadow-[0_12px_30px_-14px_rgba(62,207,142,0.8)] disabled:opacity-80 disabled:cursor-not-allowed" style={{ animation: 'v2-rise 640ms cubic-bezier(.2,.75,.3,1) 440ms both' }}>
                  {loading && <span className="w-[14px] h-[14px] rounded-full border-2 border-[#052018]/25 border-t-[#052018]" style={{ animation: 'v2-spin 680ms linear infinite' }}></span>}
                  {loading ? 'Signing in…' : 'Sign In'}
                </button>
              </form>

              <div className="flex flex-col gap-[12px] items-center" style={{ animation: 'v2-rise 640ms cubic-bezier(.2,.75,.3,1) 520ms both' }}>
                <p className="m-0 font-light text-[13px] leading-none text-[#F0F4F2]/50">Don’t have an account? <Link to="/register" className="font-medium text-[#F0F4F2] hover:text-[#3ECF8E] transition-colors">Create account</Link></p>
                <span className="font-light text-[11px] leading-none text-[#F0F4F2]/30">Customer or mechanic account</span>
              </div>
            </div>

          </div>
        </section>
      </div>
    </div>
  );
};

export default WrenchLogin;
