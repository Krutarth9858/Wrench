import { create } from 'zustand';

/**
 * The mechanic's current availability, shared by everything that displays it.
 *
 * The navbar lives outside the dashboard's `<Routes>`, so it mounts once per
 * session and its own fetch never runs again — it previously showed whatever
 * the server said at login for the rest of the session. This holds the one
 * value all of those views read instead.
 *
 * It is a cache of a server fact, never a guess: `AvailabilityControl` publishes
 * the value the server returned, and only when the call succeeded. Nothing here
 * talks to the network, so no view is ever tempted to poll to stay in sync.
 */
interface AvailabilityState {
  /** `null` until the server has actually said — not "unavailable". */
  isAvailable: boolean | null;
  setKnownAvailability: (value: boolean | null) => void;
}

export const useAvailability = create<AvailabilityState>((set) => ({
  isAvailable: null,
  setKnownAvailability: (isAvailable) => set({ isAvailable }),
}));
