import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { WrenchLogo } from '../components/ui/WrenchLogo';

/**
 * Where Google returns the browser. The `code` here is opaque — it is posted
 * to Wrench, which exchanges it with Google server-side. This page never sees
 * or sends an identity.
 */
export default function GoogleCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const signInWithGoogle = useAuth((s) => s.signInWithGoogle);
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    // An authorization code is single-use; StrictMode's double effect must not
    // spend it twice.
    if (ran.current) return;
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const denied = params.get('error');

    if (denied) {
      setError(denied === 'access_denied'
        ? 'Sign-in was cancelled.'
        : 'Google could not complete this sign-in.');
      return;
    }
    if (!code || !state) {
      setError('This sign-in link is incomplete. Please try again.');
      return;
    }

    signInWithGoogle(code, state)
      .then((user) => navigate('/dashboard', { replace: true, state: { role: user.role } }))
      .catch((err) => setError(err instanceof ApiError ? err.message
        : 'Could not complete sign-in. Please try again.'));
  }, [params, navigate, signInWithGoogle]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-[22px] bg-[#0A0A0B] text-[#F0F4F2] px-6">
      <WrenchLogo animated={false} />
      {error ? (
        <div data-testid="google-callback-error" className="flex flex-col items-center gap-[16px]">
          <p className="m-0 font-light text-[14px] text-[#EFB2A4] text-center max-w-[320px]">
            {error}
          </p>
          <button type="button" onClick={() => navigate('/login', { replace: true })}
            className="h-[46px] px-[22px] rounded-[14px] bg-[#3ECF8E] text-[#052018] font-semibold text-[14px] cursor-pointer hover:brightness-110 transition-all">
            Back to sign in
          </button>
        </div>
      ) : (
        <div data-testid="google-callback-pending" className="flex items-center gap-[10px]">
          <span className="w-[14px] h-[14px] rounded-full border-2 border-[#F0F4F2]/25 border-t-[#3ECF8E]"
            style={{ animation: 'v2-spin 680ms linear infinite' }} />
          <span className="font-light text-[14px] text-[#F0F4F2]/60">Completing sign-in…</span>
        </div>
      )}
    </div>
  );
}
