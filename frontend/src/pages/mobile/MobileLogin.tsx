import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { describeError } from '../../lib/errors';
import MobileAuthLayout from '../../components/mobile/MobileAuthLayout';
import GoogleButton from '../../components/auth/GoogleButton';
import AuthDivider from '../../components/auth/AuthDivider';
import { PRIMARY_BUTTON, TAP } from '../../components/mobile/mobileTokens';

const FIELD =
  'w-full rounded-[14px] border border-white/10 bg-white/[0.05] px-4 text-[16px] ' +
  'text-[#F0F4F2] placeholder-[#F0F4F2]/30 outline-none transition-colors ' +
  'focus:border-[#3ECF8E]/55 focus:bg-white/[0.08]';

/**
 * Mobile sign-in.
 *
 * Same `useAuth().login` as desktop — only the presentation differs. Inputs are
 * 16px because anything smaller makes iOS Safari zoom the page on focus, which
 * is what causes the classic horizontal-overflow-on-focus bug.
 */
export default function MobileLogin() {
  const navigate = useNavigate();
  const login = useAuth((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err).message : 'Could not sign you in.');
      setLoading(false);
    }
  };

  return (
    <MobileAuthLayout
      title="Welcome back"
      subtitle="Sign in to Wrench"
      footer={
        <p className="m-0 text-[13.5px] text-[#F0F4F2]/45">
          New to Wrench?{' '}
          <Link to="/register" className="font-medium text-[#F0F4F2] active:text-[#3ECF8E]">
            Create account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0F4F2]/40">
            Email
          </span>
          <input type="email" inputMode="email" autoComplete="email" required
            value={email} onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="you@example.com" className={FIELD} style={{ height: 54 }} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0F4F2]/40">
            Password
          </span>
          <div className="relative">
            <input type={show ? 'text' : 'password'} autoComplete="current-password" required
              value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Your password" className={`${FIELD} pr-12`} style={{ height: 54 }} />
            <button type="button" onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#F0F4F2]/45"
              style={{ width: TAP, height: TAP }}>
              {show ? <EyeSlash className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </label>

        {/* Reserved space, so showing an error never shifts the button under a thumb. */}
        <div className="min-h-[20px]">
          {error && (
            <p role="alert" data-testid="m-login-error"
              className="m-0 text-[13px] leading-snug text-[#EFB2A4]">
              {error}
            </p>
          )}
        </div>

        <button type="submit" disabled={loading} data-testid="m-login-submit"
          className={PRIMARY_BUTTON}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      <div className="mt-5 space-y-4">
        <AuthDivider />
        <GoogleButton disabled={loading} onError={setError} />
      </div>
    </MobileAuthLayout>
  );
}
