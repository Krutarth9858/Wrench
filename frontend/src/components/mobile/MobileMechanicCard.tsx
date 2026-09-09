import { Star, MapPin, Lightning } from '@phosphor-icons/react';
import type { NearbyMechanic } from '../../lib/discovery';
import { VEHICLE_TYPE_LABELS } from '../../lib/mechanic';
import { estimateMinutes } from '../../lib/eta';
import { CARD, TAP } from './mobileTokens';

interface Props {
  mechanic: NearbyMechanic;
  selected?: boolean;
  onSelect: () => void;
  onRequest: () => void;
}

export default function MobileMechanicCard({
  mechanic, selected, onSelect, onRequest,
}: Props) {
  const eta = estimateMinutes(mechanic.distance_km);

  return (
    <article
      data-testid={`m-mechanic-${mechanic.id}`}
      data-selected={selected ? 'true' : 'false'}
      className={`${CARD} p-4 transition-colors ${selected ? 'border-[#3ECF8E]/45' : ''}`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full text-left"
        aria-label={`Show ${mechanic.garage_name} on the map`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="m-0 font-semibold text-[16px] leading-tight tracking-[-0.01em] truncate">
            {mechanic.garage_name}
          </h3>
          {mechanic.total_reviews > 0 && (
            <span className="flex items-center gap-1 shrink-0 text-[13px] text-[#F0F4F2]/80">
              <Star weight="fill" className="w-3.5 h-3.5 text-amber-400" />
              {mechanic.average_rating.toFixed(1)}
            </span>
          )}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#F0F4F2]/55">
          <span className="flex items-center gap-1">
            <MapPin weight="regular" className="w-3.5 h-3.5" />
            {mechanic.distance_km} km
          </span>
          <span className="flex items-center gap-1">
            <Lightning weight="regular" className="w-3.5 h-3.5" />
            ~{eta} min
          </span>
          <span className="text-[#F0F4F2]/40">
            {mechanic.supported_vehicle_types
              .map((t) => (t === 'BIKE' ? '2W' : '4W')).join(' + ')}
          </span>
        </div>

        <div className="mt-2.5 flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
              mechanic.is_available
                ? 'bg-[#3ECF8E]/12 text-[#3ECF8E]'
                : 'bg-white/[0.06] text-[#F0F4F2]/45'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              mechanic.is_available ? 'bg-[#3ECF8E]' : 'bg-[#F0F4F2]/40'}`} />
            {mechanic.is_available ? 'Available' : 'Unavailable'}
          </span>
          <span className="text-[11px] text-[#F0F4F2]/35 truncate">
            {mechanic.supported_vehicle_types.map((t) => VEHICLE_TYPE_LABELS[t]).join(', ')}
          </span>
        </div>
      </button>

      <button
        type="button"
        onClick={onRequest}
        disabled={!mechanic.is_available}
        data-testid={`m-request-${mechanic.id}`}
        className="mt-3.5 w-full rounded-[14px] bg-[#3ECF8E] text-[#052018] font-semibold text-[14px] active:brightness-95 transition-all disabled:opacity-40"
        style={{ minHeight: TAP }}
      >
        Request Assistance
      </button>
    </article>
  );
}
