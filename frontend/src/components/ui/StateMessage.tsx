import type { ReactNode } from 'react';
import { describeError } from '../../lib/errors';

interface StateProps {
  title: string;
  message: string;
  /** Primary recovery action. Omit when there is genuinely nothing to do. */
  action?: { label: string; onClick: () => void };
  secondary?: ReactNode;
  testId?: string;
  tone?: 'neutral' | 'error';
}

/**
 * The shared shape for "there is nothing here" and "this went wrong".
 *
 * One component for both because they are the same object visually and
 * differ only in tone — a red accent buys nothing on an empty list. Panels
 * with genuinely specific copy still write their own; this exists so the
 * generic cases stop being reinvented, not to flatten every message into one.
 */
export function StateMessage({
  title, message, action, secondary, testId, tone = 'neutral',
}: StateProps) {
  return (
    <div
      data-testid={testId}
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-2xl border p-6 ${
        tone === 'error'
          ? 'border-red-500/20 bg-red-500/[0.04]'
          : 'border-white/10 bg-white/[0.03]'
      }`}
    >
      <p className={`font-medium mb-1 ${tone === 'error' ? 'text-red-200' : 'text-white'}`}>
        {title}
      </p>
      <p className="text-zinc-400 text-sm font-light">{message}</p>
      {(action || secondary) && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              data-testid={testId ? `${testId}-action` : undefined}
              className="h-10 px-5 inline-flex items-center rounded-2xl bg-emerald-500 text-zinc-950 text-sm font-semibold transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              {action.label}
            </button>
          )}
          {secondary}
        </div>
      )}
    </div>
  );
}

/** Nothing here yet — a normal, calm state, not a failure. */
export function EmptyState(props: Omit<StateProps, 'tone'>) {
  return <StateMessage {...props} tone="neutral" />;
}

/**
 * Something failed. Copy comes from `describeError`, so an offline browser, an
 * expired session and a 500 each say something true and different.
 */
export function ErrorState({
  error, onRetry, testId = 'error-state',
}: { error: unknown; onRetry?: () => void; testId?: string }) {
  const described = describeError(error);
  return (
    <StateMessage
      tone="error"
      testId={testId}
      title={described.title}
      message={described.message}
      action={onRetry && described.retryable && described.action
        ? { label: described.action, onClick: onRetry }
        : undefined}
    />
  );
}
