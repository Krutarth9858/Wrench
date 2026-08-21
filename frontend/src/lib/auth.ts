import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiError, apiFetchData, setAuthToken } from './api';

export type UserRole = 'CUSTOMER' | 'MECHANIC' | 'ADMIN';

export interface User {
  id: string;
  email: string;
  phone_number: string;
  role: UserRole;
  is_active: boolean;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterInput {
  email: string;
  phone_number: string;
  password: string;
  role?: Extract<UserRole, 'CUSTOMER' | 'MECHANIC'>;
}

interface AuthState {
  /** Kept in memory only — never persisted. See `partialize` below. */
  accessToken: string | null;
  /** Persisted so a page reload can mint a fresh access token. */
  refreshToken: string | null;
  user: User | null;
  status: 'idle' | 'loading' | 'ready';

  register: (input: RegisterInput) => Promise<User>;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  loadSession: () => Promise<void>;
}

/**
 * Refresh-token rotation makes `loadSession` unsafe to run concurrently: two callers
 * would both read the same token, the first would rotate it, and the second would
 * replay a revoked token and be signed out. React StrictMode invokes the boot effect
 * twice, so this is reachable in normal development. Share one in-flight exchange.
 */
let sessionLoad: Promise<void> | null = null;

const applyTokens = (
  set: (partial: Partial<AuthState>) => void,
  tokens: TokenPair,
): void => {
  setAuthToken(tokens.access_token);
  set({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
};

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: 'idle',

      register: async (input) => {
        await apiFetchData<User>('/auth/register', { method: 'POST', body: input });
        return get().login(input.email, input.password);
      },

      login: async (email, password) => {
        const tokens = await apiFetchData<TokenPair>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        applyTokens(set, tokens);
        const user = await apiFetchData<User>('/auth/me');
        set({ user, status: 'ready' });
        return user;
      },

      logout: async () => {
        const { refreshToken } = get();
        if (refreshToken) {
          // Best effort: revoke server-side, but always clear locally.
          await apiFetchData('/auth/logout', {
            method: 'POST',
            body: { refresh_token: refreshToken },
          }).catch(() => undefined);
        }
        setAuthToken(null);
        set({ accessToken: null, refreshToken: null, user: null, status: 'ready' });
      },

      /**
       * Restore a session on boot. Only the refresh token survives a reload, so
       * exchange it for a fresh access token before fetching the user.
       */
      loadSession: async () => {
        if (sessionLoad) return sessionLoad;
        const { refreshToken } = get();
        if (!refreshToken) {
          set({ status: 'ready' });
          return;
        }
        set({ status: 'loading' });
        sessionLoad = (async () => {
        try {
          const tokens = await apiFetchData<TokenPair>('/auth/refresh', {
            method: 'POST',
            body: { refresh_token: refreshToken },
          });
          applyTokens(set, tokens);
          const user = await apiFetchData<User>('/auth/me');
          set({ user, status: 'ready' });
        } catch (error) {
          // An expired or revoked refresh token is a normal signed-out state.
          if (!(error instanceof ApiError)) throw error;
          setAuthToken(null);
          set({ accessToken: null, refreshToken: null, user: null, status: 'ready' });
        }
        })().finally(() => {
          sessionLoad = null;
        });
        return sessionLoad;
      },
    }),
    {
      name: 'auth-storage',
      // Persist the refresh token only. The access token stays in memory so it is
      // not readable from storage; it is re-minted on boot via loadSession().
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
);
