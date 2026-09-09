import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { maskEmail, requestEmailCode } from '../../lib/authExtras';

interface Props {
  email: string;
  /** Seconds before "Resend code" becomes available again. */
  resendAfterSeconds?: number;
  onVerified: () => void;
  onBack?: () => void;
}

const LENGTH = 6;

/**
 * The email verification step.
 *
 * Six single-character boxes rather than one text field, because the code is
 * read off an email a digit at a time. Paste still works: dropping the whole
 * code into any box fills them all.
 */
export default function OtpVerification({
  email, resendAfterSeconds = 60, onVerified, onBack,
}: Props) {
  const verifyEmailCode = useAuth((s) => s.verifyEmailCode);
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(''));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(resendAfterSeconds);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => { inputs.current[0]?.focus(); }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(c - 1, 0)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const code = digits.join('');


  const submit = useCallback(async (value: string) => {
    if (value.length !== LENGTH || verifying) return;
    setVerifying(true);
    setError('');
    try {
      await verifyEmailCode(email, value);
      onVerified();
    } catch (err) {
      // The server's message already distinguishes wrong / expired / too many
      // attempts without exposing anything about the stored code.
      setError(err instanceof ApiError ? err.message
        : 'We could not verify that code. Please try again.');
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }, [email, onVerified, verifyEmailCode, verifying]);
  /* Submitting is driven by the rendered state rather than by the change
     handler: `setDigits` does not run its updater synchronously, so the handler
     cannot know whether its keystroke completed the code. The ref stops the
     same code being sent twice. */
  const submitted = useRef('');
  useEffect(() => {
    if (code.length === LENGTH && !digits.includes('') && submitted.current !== code) {
      submitted.current = code;
      void submit(code);
    }
    if (code.length < LENGTH) submitted.current = '';
  }, [code, digits, submit]);

  const setDigit = (index: number, raw: string) => {
    const cleaned = raw.replace(/\D/g, '');
    if (!cleaned) {
      setDigits((prev) => prev.map((d, i) => (i === index ? '' : d)));
      return;
    }
    setError('');
    // Built from the latest state, not this render's snapshot: typing six digits
    // fires six changes before React re-renders, and a closed-over `digits`
    // would make every one of them overwrite the last.
    setDigits((prev) => {
      const next = [...prev];
      // A pasted code fills every box from here on.
      for (let i = 0; i < cleaned.length && index + i < LENGTH; i += 1) {
        next[index + i] = cleaned[i];
      }
      return next;
    });
    const landed = Math.min(index + cleaned.length, LENGTH - 1);
    inputs.current[landed]?.focus();
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const resend = async () => {
    setResending(true);
    setError('');
    setNotice('');
    try {
      const result = await requestEmailCode(email);
      setCooldown(result.resend_after_seconds);
      setDigits(Array(LENGTH).fill(''));
      inputs.current[0]?.focus();
      setNotice('We sent a new code. The previous one no longer works.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message
        : 'Could not send a new code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div data-testid="otp-verification" className="flex flex-col gap-[20px]">
      <div className="flex flex-col gap-[7px]">
        <h2 className="m-0 font-semibold text-[27px] leading-[1.12] tracking-[-0.028em]">
          Verify your email
        </h2>
        <p className="m-0 font-light text-[13.5px] leading-[1.5] text-[#F0F4F2]/50">
          We've sent a 6-digit verification code to{' '}
          <span data-testid="otp-email" className="text-[#F0F4F2]/80">{maskEmail(email)}</span>
        </p>
      </div>

      <div className="flex gap-[8px] justify-between" role="group" aria-label="Verification code">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputs.current[index] = el; }}
            data-testid={`otp-digit-${index}`}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            maxLength={LENGTH}
            aria-label={`Digit ${index + 1}`}
            value={digit}
            disabled={verifying}
            onChange={(e) => setDigit(index, e.target.value)}
            onKeyDown={(e) => onKeyDown(index, e)}
            className="w-full h-[56px] rounded-[14px] bg-white/5 border border-white/10 text-[#F0F4F2] text-center font-medium text-[20px] outline-none transition-all duration-300 hover:border-white/20 focus:border-[#3ECF8E]/60 focus:shadow-[0_0_0_3px_rgba(62,207,142,0.14)] focus:bg-white/10 disabled:opacity-60"
          />
        ))}
      </div>

      {error && (
        <div role="alert" data-testid="otp-error"
          className="flex items-center gap-[10px] p-[11px_13px] rounded-[12px] bg-[#E07864]/10 border border-[#E07864]/25">
          <span className="flex-none w-[5px] h-[5px] rounded-full bg-[#E0806E]" />
          <span className="font-light text-[13px] leading-[1.4] text-[#EFB2A4]">{error}</span>
        </div>
      )}

      {notice && !error && (
        <p data-testid="otp-notice" className="m-0 font-light text-[12.5px] text-[#3ECF8E]">
          {notice}
        </p>
      )}

      <button
        type="button"
        data-testid="otp-verify"
        onClick={() => void submit(code)}
        disabled={code.length !== LENGTH || verifying}
        className="relative overflow-hidden h-[53px] border-none rounded-[14px] bg-[#3ECF8E] text-[#052018] font-semibold text-[15px] leading-none flex items-center justify-center gap-[10px] cursor-pointer transition-all duration-200 hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {verifying && (
          <span className="w-[14px] h-[14px] rounded-full border-2 border-[#052018]/25 border-t-[#052018]"
            style={{ animation: 'v2-spin 680ms linear infinite' }} />
        )}
        {verifying ? 'Verifying…' : 'Verify'}
      </button>

      <div className="flex flex-col gap-[10px] items-center">
        <p className="m-0 font-light text-[13px] leading-none text-[#F0F4F2]/50">
          Didn't receive it?{' '}
          {cooldown > 0 ? (
            <span data-testid="otp-cooldown" className="text-[#F0F4F2]/40">
              Resend in {cooldown}s
            </span>
          ) : (
            <button type="button" data-testid="otp-resend" onClick={() => void resend()}
              disabled={resending}
              className="font-medium text-[#F0F4F2] hover:text-[#3ECF8E] transition-colors disabled:opacity-60">
              {resending ? 'Sending…' : 'Resend code'}
            </button>
          )}
        </p>
        {onBack && (
          <button type="button" data-testid="otp-back" onClick={onBack}
            className="font-light text-[12.5px] text-[#F0F4F2]/40 hover:text-[#F0F4F2]/70 transition-colors">
            Use a different email
          </button>
        )}
      </div>
    </div>
  );
}
