import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import {
  subscribeToBookings,
  type BookingEvent,
  type BookingEventType,
  type ConnectionState,
} from '../lib/realtime';

type Audience = 'customer' | 'mechanic';

/** Web-only notification copy. No email/SMS/push in this phase. */
const MESSAGES: Record<Audience, Partial<Record<BookingEventType, string>>> = {
  customer: {
    BOOKING_ACCEPTED: 'A mechanic accepted your request',
    BOOKING_REJECTED: 'Your request was declined',
    BOOKING_STARTED: 'The mechanic started the service',
    BOOKING_COMPLETED: 'Service completed',
    BOOKING_CANCELLED: 'Booking cancelled',
  },
  mechanic: {
    BOOKING_CREATED: 'New service request',
    BOOKING_CANCELLED: 'A customer cancelled their booking',
  },
};

/**
 * Subscribe to booking events and refetch through REST on every event and on
 * every (re)connection. The socket never becomes the source of truth.
 */
export function useBookingRealtime(
  audience: Audience,
  refresh: () => void | Promise<void>,
  onState?: (state: ConnectionState) => void,
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    const dispose = subscribeToBookings({
      onEvent: (event: BookingEvent) => {
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
