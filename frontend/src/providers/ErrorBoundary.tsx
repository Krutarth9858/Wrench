import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';
import { WrenchLogo } from '../components/ui/WrenchLogo';
import { describeError } from '../lib/errors';

/**
 * The last line of defence: a render crash anywhere below this lands here.
 *
 * The raw error is deliberately not shown in production. It can carry a URL, a
 * query fragment or an internal message, none of which help a customer and all
 * of which describe how Wrench is built. It stays in the console, and is shown
 * on screen only during development.
 */
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  const described = describeError(error);
  const technical = error instanceof Error ? error.message : String(error);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-[26px] bg-[#0A0A0B] px-6 py-12 text-[#F0F4F2]">
      <WrenchLogo animated={false} />

      <div className="w-full max-w-[400px] rounded-[22px] border border-white/10 bg-white/[0.03] p-[28px] text-center"
        style={{ backdropFilter: 'blur(28px) saturate(150%)' }}>
        <h1 className="m-0 mb-[10px] font-semibold text-[22px] leading-[1.2] tracking-[-0.02em]">
          {described.title}
        </h1>
        <p className="m-0 mb-[24px] font-light text-[13.5px] leading-[1.55] text-[#F0F4F2]/55">
          {described.message}
        </p>

        {import.meta.env.DEV && (
          <pre className="mb-[20px] max-h-[140px] overflow-auto rounded-[12px] border border-white/10 bg-black/40 p-[12px] text-left text-[11px] leading-[1.5] text-[#EFB2A4]">
            {technical}
          </pre>
        )}

        <button
          type="button"
          onClick={resetErrorBoundary}
          className="h-[48px] w-full rounded-[14px] bg-[#3ECF8E] text-[#052018] font-semibold text-[14.5px] cursor-pointer transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3ECF8E]"
        >
          Reload Wrench
        </button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        // Kept in the console for developers; never rendered in production.
        console.error('Unhandled render error', error);
      }}
      onReset={() => window.location.reload()}
    >
      {children}
    </ReactErrorBoundary>
  );
}
