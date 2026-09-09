import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { WrenchLogo } from '../ui/WrenchLogo';
import { SAFE_BOTTOM, SAFE_TOP } from './mobileTokens';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}

/**
 * The mobile auth frame.
 *
 * `min-h-[100dvh]` rather than `100vh`: dvh tracks the mobile browser's
 * collapsing address bar, so the layout does not jump when it hides. The form
 * scrolls in its own region, which is what keeps the submit button reachable
 * once the keyboard is up.
 */
export default function MobileAuthLayout({ title, subtitle, children, footer }: Props) {
  return (
    <div
      data-testid="m-auth"
      className="min-h-[100dvh] bg-[#0A0A0B] text-[#F0F4F2] flex flex-col overflow-x-hidden"
    >
      <header className="px-5 shrink-0" style={{ paddingTop: `calc(${SAFE_TOP} + 18px)` }}>
        <Link to="/" aria-label="Wrench home" className="inline-flex">
          <WrenchLogo animated={false} />
        </Link>
      </header>

      <main className="flex-1 flex flex-col justify-center px-5 py-8">
        <h1 className="m-0 font-semibold text-[28px] leading-[1.12] tracking-[-0.03em]">
          {title}
        </h1>
        <p className="m-0 mt-1.5 mb-7 text-[14px] text-[#F0F4F2]/50">{subtitle}</p>
        {children}
      </main>

      <footer className="px-5 shrink-0 text-center"
        style={{ paddingBottom: `calc(${SAFE_BOTTOM} + 24px)` }}>
        {footer}
      </footer>
    </div>
  );
}
