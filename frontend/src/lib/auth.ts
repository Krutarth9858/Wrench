import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  phone_number: string;
  role: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
  fetchUser: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      setToken: (token) => set({ token }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
      fetchUser: async () => {
        const { token } = get();
        if (!token) return;
        
        // Mocking the backend user fetch
        set({
          user: {
            id: 'mock-id-123',
            email: 'admin@wrench.ai',
            phone_number: '+1234567890',
            role: 'admin'
          }
        });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
