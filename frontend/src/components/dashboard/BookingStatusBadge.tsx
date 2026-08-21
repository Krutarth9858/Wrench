import { STATUS_LABELS, STATUS_TONES, type BookingStatus } from '../../lib/booking';

/** Renders whatever status the backend reports. The UI never derives status itself. */
export default function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      data-testid="booking-status"
      data-status={status}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
