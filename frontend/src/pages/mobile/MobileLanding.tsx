import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin, ShieldCheck, Lightning, Sparkle } from '@phosphor-icons/react';
import { WrenchLogo } from '../../components/ui/WrenchLogo';
import { useAuth } from '../../lib/auth';
import { SAFE_BOTTOM, SAFE_TOP, CARD, PRIMARY_BUTTON, SECONDARY_BUTTON } from '../../components/mobile/mobileTokens';

/**
 * The mobile landing composition.
 *
 * Not the desktop hero stacked: one screen, one promise, two actions. The
 * scroll-driven story and WebGL surfaces of the desktop page are deliberately
 * absent — they cost battery and comprehension on a phone. Identity is carried
 * by the same near-black ground, restrained green and the WRENCH mark.
 */
export default function MobileLanding() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);

  const start = () => navigate(user ? '/dashboard/find' : '/register');

  return (
    <div data-testid="m-landing" className="min-h-[100dvh] bg-[#0A0A0B] text-[#F0F4F2] flex flex-col">
      <header className="flex items-center justify-between px-5"
        style={{ paddingTop: `calc(${SAFE_TOP} + 16px)`, paddingBottom: 8 }}>
        <WrenchLogo animated={false} />
        <Link to={user ? '/dashboard' : '/login'}
          data-testid="m-landing-signin"
          className="text-[13.5px] font-medium text-[#F0F4F2]/70 active:text-[#F0F4F2] px-2 py-2">
          {user ? 'Dashboard' : 'Sign in'}
        </Link>
      </header>

      {/* First viewport: the promise and the two actions. Nothing else. */}
      <section className="flex-1 flex flex-col justify-center px-5 pt-4 pb-6">
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-[#3ECF8E]/25 bg-[#3ECF8E]/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.14em] text-[#3ECF8E]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3ECF8E]" />
          ROADSIDE ASSISTANCE
        </span>

        <h1 className="m-0 mt-5 font-semibold text-[38px] leading-[1.08] tracking-[-0.035em]">
          Help is closer
          <br />than you think.
        </h1>

        <p className="m-0 mt-4 text-[15px] leading-[1.55] text-[#F0F4F2]/55 max-w-[30ch]">
          Break down anywhere and Wrench finds a verified mechanic nearby — with
          live status from the moment they accept.
        </p>

        <div className="mt-8 space-y-2.5">
          <button type="button" onClick={start} data-testid="m-landing-primary"
            className={PRIMARY_BUTTON}>
            Get Assistance
            <ArrowRight weight="bold" className="w-[17px] h-[17px]" />
          </button>
          <button type="button" onClick={() => navigate(user ? '/dashboard/find' : '/login')}
            data-testid="m-landing-secondary" className={SECONDARY_BUTTON}>
            <MapPin weight="regular" className="w-[17px] h-[17px]" />
            Find a Mechanic
          </button>
        </div>
      </section>

      {/* Compact product story below the fold. */}
      <section className="px-5 pb-8 space-y-3" style={{ paddingBottom: `calc(${SAFE_BOTTOM} + 32px)` }}>
        <h2 className="m-0 mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F0F4F2]/35">
          How Wrench works
        </h2>
        {[
          { icon: <Sparkle weight="regular" className="w-[18px] h-[18px] text-[#3ECF8E]" />,
            title: 'Describe the problem', body: 'Wrench AI narrows it down before anyone drives out.' },
          { icon: <MapPin weight="regular" className="w-[18px] h-[18px] text-[#3ECF8E]" />,
            title: 'Match with a mechanic', body: 'Only garages whose service area actually covers you.' },
          { icon: <Lightning weight="regular" className="w-[18px] h-[18px] text-[#3ECF8E]" />,
            title: 'Track it live', body: 'Accepted, on the way, in progress — updated as it happens.' },
          { icon: <ShieldCheck weight="regular" className="w-[18px] h-[18px] text-[#3ECF8E]" />,
            title: 'Or plan ahead', body: 'Book a service at a time you choose and pay securely.' },
        ].map((step) => (
          <div key={step.title} className={`${CARD} p-4 flex gap-3.5`}>
            <span className="shrink-0 mt-0.5">{step.icon}</span>
            <div>
              <p className="m-0 font-medium text-[14.5px]">{step.title}</p>
              <p className="m-0 mt-0.5 text-[12.5px] leading-[1.5] text-[#F0F4F2]/45">{step.body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
