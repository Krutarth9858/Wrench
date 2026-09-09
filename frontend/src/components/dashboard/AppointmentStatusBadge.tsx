import { STATUS_LABELS, STATUS_TONES, type AppointmentStatus } from '../../lib/appointments';

/** Renders whatever status the backend reports. The UI never derives status itself. */
export default function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      data-testid="appointment-status"
      data-status={status}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${STATUS_TONES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
