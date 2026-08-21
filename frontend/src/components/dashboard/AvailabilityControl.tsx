import { useState } from 'react';
import { setAvailability as setAvailabilityApi } from '../../lib/mechanic';

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
 * The backend value is authoritative: state is set from the response, never
 * optimistically.
 */
export default function AvailabilityControl({ available, enabled, onChange, onError }: Props) {
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const result = await setAvailabilityApi(!available);
      onChange(result.is_available);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not update availability.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-6 rounded-2xl border border-white/10 bg-white/5 p-6">
      <div>
        <div className="flex items-center gap-2">
          <span
            data-testid="availability-dot"
            className={`w-2 h-2 rounded-full ${available ? 'bg-emerald-400' : 'bg-zinc-500'}`}
          />
          <span data-testid="availability-label" className="text-white font-medium">
            {available ? 'Available' : 'Unavailable'}
          </span>
        </div>
        <p className="text-zinc-500 text-sm font-light mt-1">
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
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          available ? 'bg-emerald-500' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-transform ${
            available ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}
