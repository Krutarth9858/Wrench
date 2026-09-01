import '@testing-library/jest-dom';

// vitest 4's jsdom environment provides `window` and `document` but does not expose
// `localStorage` as a global. Zustand's `persist` middleware needs it, so supply a
// minimal in-memory Storage implementation when the environment lacks one.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, String(value)),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, writable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: memoryStorage, writable: true });
  }
}

// jsdom has no ResizeObserver. Components that measure themselves to fit a
// container need it to exist; a no-op is enough since jsdom reports zero sizes.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class NoopResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(globalThis, 'ResizeObserver', { value: NoopResizeObserver, writable: true });
}
