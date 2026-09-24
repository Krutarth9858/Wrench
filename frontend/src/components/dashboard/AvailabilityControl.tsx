import { useState } from 'react';
import { toast } from 'sonner';
import { setAvailability as setAvailabilityApi } from '../../lib/mechanic';
import { useAvailability } from '../../lib/availability';

interface Props {
  available: boolean;
  /** False until the mechanic has saved a profile — there is nothing to toggle yet. */
  enabled: boolean;
  onChange: (next: boolean) => void;
  onError?: (message: string) => void;
}

/**
 * The single availability switch. Used by the mechanic profile, the availability
 * page and the dashboard overview so there is only ever one way to change it.
 */
export default function AvailabilityControl({ available, enabled, onChange, onError }: Props) {
  const [busy, setBusy] = useState(false);
  const publish = useAvailability((state) => state.setKnownAvailability);

  const toggle = async () => {
    if (!enabled || busy) return;
    const previous = available;
    const next = !available;
    setBusy(true);

    // Optimistically update local view and shared navbar store for zero-latency feedback
    onChange(next);
    publish(next);

    try {
      const result = await setAvailabilityApi(next);
      onChange(result.is_available);
      publish(result.is_available);
      if (result.is_available) {
        toast.success('You are now Available (Online)', {
          description: 'Customers can now find your garage and send roadside assistance requests.',
        });
      } else {
        toast.info('You are now Unavailable (Offline)', {
          description: 'Your garage will not appear in customer search results.',
        });
      }
    } catch (err) {
      // Revert upon failure
      onChange(previous);
      publish(previous);
      const errMsg = err instanceof Error ? err.message : 'Could not update availability.';
      onError?.(errMsg);
      toast.error('Failed to change status', { description: errMsg });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-6 transition-all duration-200 hover:border-white/15">
      <div>
        <div className="flex items-center gap-2.5">
          <span
            data-testid="availability-dot"
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
              available ? 'bg-emerald-400 ring-4 ring-emerald-400/20' : 'bg-zinc-500'
            }`}
          />
          <span data-testid="availability-label" className="text-white font-medium text-base">
            {available ? 'Available' : 'Unavailable'}
          </span>
          {available && (
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live
            </span>
          )}
        </div>
        <p className="text-zinc-400 text-sm font-light mt-1.5">
          {enabled
            ? 'Customers can only be matched with you while you are available.'
            : 'Save your profile first to control availability.'}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={available}
        aria-label="Toggle availability"
        data-testid="availability-toggle"
        disabled={!enabled || busy}
        onClick={toggle}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 ${
          available ? 'bg-emerald-500 shadow-[0_0_16px_rgba(16,185,129,0.35)]' : 'bg-white/10'
        } ${!enabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-transform duration-300 ease-out flex items-center justify-center ${
            available ? 'translate-x-7' : 'translate-x-1'
          }`}
        >
          {busy && (
            <span className="w-3 h-3 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
          )}
        </span>
      </button>
    </div>
  );
}
