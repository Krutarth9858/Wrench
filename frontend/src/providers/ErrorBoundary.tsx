import React from 'react';
import { ErrorBoundary as ReactErrorBoundary, FallbackProps } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-slate-950 p-6 text-center text-slate-50">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 p-8 shadow-xl border border-slate-800">
        <h2 className="mb-4 text-2xl font-semibold text-red-500">Something went wrong</h2>
        <p className="mb-6 text-sm text-slate-400">
          The application encountered an unexpected error.
        </p>
        <pre className="mb-6 overflow-auto rounded-lg bg-slate-950 p-4 text-left text-xs text-red-400 border border-slate-800/50">
          {error.message}
        </pre>
        <button
          onClick={resetErrorBoundary}
          className="w-full rounded-full bg-blue-600 py-3 text-sm font-semibold transition-transform hover:scale-[1.02] hover:bg-blue-700 shadow-lg shadow-blue-600/20"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export function AppErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Reset the state of your app so the error doesn't happen again
        window.location.reload();
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}
