import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { get, post, tokenStore } from '../api/client';
import type { Me } from '../api/types';

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone: string; city: string }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await get<{ user: Me }>('/api/auth/me');
      setUser(res.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => setUser(null);
    window.addEventListener('shareon:logout', onLogout);
    return () => window.removeEventListener('shareon:logout', onLogout);
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await post<{ token: string }>('/api/auth/login', { email, password });
      tokenStore.set(res.token);
      await refresh();
    },
    [refresh],
  );

  const register = useCallback<AuthState['register']>(
    async (data) => {
      const res = await post<{ token: string }>('/api/auth/register', data);
      tokenStore.set(res.token);
      await refresh();
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await post('/api/auth/logout');
    } catch {
      /* token may already be invalid */
    }
    tokenStore.set(null);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
};
