import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { describeError } from '../../lib/errors';
import { requestEmailCode } from '../../lib/authExtras';
import MobileAuthLayout from '../../components/mobile/MobileAuthLayout';
import GoogleButton from '../../components/auth/GoogleButton';
import AuthDivider from '../../components/auth/AuthDivider';
import { PRIMARY_BUTTON, TAP } from '../../components/mobile/mobileTokens';

const FIELD =
  'w-full rounded-[14px] border border-white/10 bg-white/[0.05] px-4 text-[16px] ' +
  'text-[#F0F4F2] placeholder-[#F0F4F2]/30 outline-none transition-colors ' +
  'focus:border-[#3ECF8E]/55 focus:bg-white/[0.08]';

/** Mobile registration. Identical logic to desktop, including the OTP handoff. */
export default function MobileRegister() {
  const navigate = useNavigate();
  const registerUser = useAuth((s) => s.register);
  const [form, setForm] = useState({
    email: '', password: '', phone_number: '',
    role: 'CUSTOMER' as 'CUSTOMER' | 'MECHANIC',
  });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const change = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await registerUser(form);
      try {
        const result = await requestEmailCode(form.email);
        navigate('/verify-email', {
          replace: true,
          state: { email: form.email, resendAfter: result.resend_after_seconds },
        });
      } catch {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? describeError(err).message : 'Could not create your account.');
      setLoading(false);
    }
  };

  return (
    <MobileAuthLayout
      title="Create your account"
      subtitle="Join Wrench in under a minute"
      footer={
        <p className="m-0 text-[13.5px] text-[#F0F4F2]/45">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-[#F0F4F2] active:text-[#3ECF8E]">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {([
          { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com', mode: 'email' },
          { key: 'phone_number', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210', mode: 'tel' },
        ] as const).map((f) => (
          <label key={f.key} className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0F4F2]/40">
              {f.label}
            </span>
            <input type={f.type} inputMode={f.mode} required value={form[f.key]}
              onChange={change(f.key)} placeholder={f.placeholder}
              className={FIELD} style={{ height: 54 }} />
          </label>
        ))}

        <label className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0F4F2]/40">
            Password
          </span>
          <div className="relative">
            <input type={show ? 'text' : 'password'} autoComplete="new-password" required
              minLength={8} value={form.password} onChange={change('password')}
              placeholder="At least 8 characters" className={`${FIELD} pr-12`} style={{ height: 54 }} />
            <button type="button" onClick={() => setShow((v) => !v)}
              aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#F0F4F2]/45"
              style={{ width: TAP, height: TAP }}>
              {show ? <EyeSlash className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
            </button>
          </div>
        </label>

        <fieldset className="border-0 p-0 m-0">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#F0F4F2]/40 mb-2">
            Account type
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            {(['CUSTOMER', 'MECHANIC'] as const).map((role) => (
              <button key={role} type="button"
                onClick={() => setForm((p) => ({ ...p, role }))}
                aria-pressed={form.role === role}
                data-testid={`m-register-role-${role}`}
                className={`rounded-[14px] border text-[14px] font-medium transition-colors ${
                  form.role === role
                    ? 'border-[#3ECF8E]/60 bg-[#3ECF8E]/12 text-[#3ECF8E]'
                    : 'border-white/10 bg-white/[0.04] text-[#F0F4F2]/60'
                }`} style={{ minHeight: TAP + 4 }}>
                {role === 'CUSTOMER' ? 'Customer' : 'Mechanic'}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="min-h-[20px]">
          {error && (
            <p role="alert" data-testid="m-register-error"
              className="m-0 text-[13px] leading-snug text-[#EFB2A4]">{error}</p>
          )}
        </div>

        <button type="submit" disabled={loading} data-testid="m-register-submit"
          className={PRIMARY_BUTTON}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>
      </form>

      <div className="mt-5 space-y-4">
        <AuthDivider />
        <GoogleButton role={form.role} disabled={loading} onError={setError} />
      </div>
    </MobileAuthLayout>
  );
}
