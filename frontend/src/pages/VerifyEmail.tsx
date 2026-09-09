import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { WrenchLogo } from '../components/ui/WrenchLogo';
import OtpVerification from '../components/auth/OtpVerification';

interface VerifyState {
  email?: string;
  resendAfter?: number;
}

/**
 * The email verification step.
 *
 * Its own route rather than a panel inside Register, because registration signs
 * the account in and the `PublicOnly` guard would immediately redirect away
 * from it. The account is real and usable by this point — verification is a
 * flag on it, not a gate in front of it — so leaving here is never a dead end.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const state = (useLocation().state as VerifyState | null) ?? {};
  const email = state.email ?? user?.email ?? '';

  if (!email) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-[18px] bg-[#0A0A0B] text-[#F0F4F2] px-6">
        <WrenchLogo animated={false} />
        <p className="m-0 font-light text-[14px] text-[#F0F4F2]/60">
          There is nothing to verify here.
        </p>
        <button type="button" onClick={() => navigate('/login', { replace: true })}
          className="h-[46px] px-[22px] rounded-[14px] bg-[#3ECF8E] text-[#052018] font-semibold text-[14px] cursor-pointer hover:brightness-110 transition-all">
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-[28px] bg-[#0A0A0B] text-[#F0F4F2] px-6 py-12">
      <WrenchLogo animated={false} />
      <div className="w-full max-w-[380px] rounded-[22px] border border-white/10 bg-white/[0.03] p-[28px]"
        style={{ backdropFilter: 'blur(28px) saturate(150%)' }}>
        <OtpVerification
          email={email}
          resendAfterSeconds={state.resendAfter ?? 60}
          onVerified={() => navigate('/dashboard', { replace: true })}
          onBack={() => navigate('/dashboard', { replace: true })}
        />
      </div>
      <button type="button" data-testid="verify-later"
        onClick={() => navigate('/dashboard', { replace: true })}
        className="font-light text-[12.5px] text-[#F0F4F2]/40 hover:text-[#F0F4F2]/70 transition-colors">
        Skip for now
      </button>
    </div>
  );
}
