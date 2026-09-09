import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { formatDuration, formatPrice, type ServicePackage } from '../../lib/appointments';

interface Props {
  pkg: ServicePackage;
  selected: boolean;
  onSelect: () => void;
}

/**
 * A priced service offering. Every figure shown here comes from the server's
 * catalogue — this component never contains a price of its own.
 *
 * "What's included" is collapsed by default: the full lists run to nine items
 * and four expanded cards would bury the prices and the CTA.
 */
export default function ServiceCard({ pkg, selected, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const quoted = pkg.price_minor === null;

  return (
    <div
      data-testid={`service-card-${pkg.service_type}`}
      data-selected={selected}
      className={`glass-card p-6 flex flex-col transition-colors ${
        selected ? 'border-emerald-500/50' : 'hover:border-white/25'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-2">
        <h3 className="text-white font-semibold tracking-tight text-lg">{pkg.name}</h3>
        {selected && (
          <span className="shrink-0 rounded-full bg-emerald-500/15 p-1 text-emerald-400">
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </span>
        )}
      </div>

      <p className="text-zinc-400 text-sm font-light">{pkg.description}</p>

      <div className="mt-5 flex items-baseline gap-2">
        <span data-testid={`price-${pkg.service_type}`}
          className="text-2xl font-semibold text-white tracking-tight">
          {formatPrice(pkg.price_minor)}
        </span>
        <span className="text-zinc-500 text-xs">
          {quoted ? 'after the mechanic reviews your request' : formatDuration(pkg.duration_minutes)}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        data-testid={`includes-toggle-${pkg.service_type}`}
        className="mt-5 flex items-center justify-between gap-2 text-left text-zinc-300 text-sm hover:text-white transition-colors"
      >
        <span className="font-medium">What's included</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul data-testid={`includes-${pkg.service_type}`} className="mt-3 space-y-1.5">
          {pkg.included_items.map((item) => (
            <li key={item} className="flex gap-2 text-sm text-zinc-400 font-light">
              <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" />
              {item}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-1 block">
          Best for
        </span>
        <p className="text-zinc-300 text-sm font-light">{pkg.best_for}</p>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onSelect}
        data-testid={`select-${pkg.service_type}`}
        className={`mt-5 h-11 w-full rounded-2xl text-sm font-semibold transition-colors ${
          selected
            ? 'bg-emerald-500 text-zinc-950'
            : 'border border-white/15 text-white hover:bg-white/10'
        }`}
      >
        {selected ? 'Selected' : 'Select service'}
      </button>
    </div>
  );
}
