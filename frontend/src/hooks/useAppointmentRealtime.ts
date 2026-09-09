import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  subscribeToBookings,
  type AppointmentEvent,
  type AppointmentEventType,
  type ConnectionState,
} from '../lib/realtime';

type Audience = 'customer' | 'mechanic';

const MESSAGES: Record<Audience, Partial<Record<AppointmentEventType, string>>> = {
  customer: {
    APPOINTMENT_QUOTED: 'Your quotation is ready',
    APPOINTMENT_CONFIRMED: 'Your appointment is confirmed',
    APPOINTMENT_STARTED: 'Your service has started',
    APPOINTMENT_COMPLETED: 'Your service is complete',
    APPOINTMENT_DECLINED: 'The mechanic declined your appointment',
    APPOINTMENT_CANCELLED: 'Appointment cancelled',
  },
  mechanic: {
    APPOINTMENT_REQUESTED: 'New service appointment',
    APPOINTMENT_PAYMENT_CONFIRMED: 'An appointment has been paid for',
    APPOINTMENT_CANCELLED: 'A customer cancelled an appointment',
  },
};

/**
 * Subscribe to Scheduled Service events on the *existing* booking socket and
 * refetch over REST on every event and every (re)connection. There is no second
 * realtime architecture and no polling; the socket never becomes the source of
 * truth.
 */
export function useAppointmentRealtime(
  audience: Audience,
  refresh: () => void | Promise<void>,
  onState?: (state: ConnectionState) => void,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const dispose = subscribeToBookings({
      // Emergency booking traffic is not this view's concern.
      onEvent: () => {},
      onAppointmentEvent: (event: AppointmentEvent) => {
        const message = MESSAGES[audience][event.type];
        if (message) toast(message);
        void refreshRef.current();
      },
      onResync: () => void refreshRef.current(),
      onStateChange: onState,
    });
    return dispose;
    // `refresh` is held in a ref so a new callback identity never resubscribes.
  }, [audience, onState]);
}
