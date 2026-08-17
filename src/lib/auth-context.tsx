import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  api,
  ApiError,
  AuthUser,
  StoredSession,
  readStoredSession,
  writeStoredSession,
  clearStoredSession,
  registerForceLogoutHandler,
} from './api';

interface AuthContextValue {
  session: StoredSession | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'HOST' | 'CLEANER';
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  updateSessionUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** This app supports hosts and cleaners only — admin/support use the web dashboard. */
function dashboardPathForRole(role: AuthUser['role']) {
  if (role === 'HOST') return '/(host-tabs)/dashboard';
  if (role === 'CLEANER') return '/(tabs)/feed';
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    readStoredSession().then((stored) => {
      setSession(stored);
      setIsLoading(false);
    });
  }, []);

  useEffect(() => {
    registerForceLogoutHandler(() => {
      setSession(null);
      router.replace('/login');
    });
  }, [router]);

  const persist = useCallback(async (next: StoredSession) => {
    await writeStoredSession(next);
    setSession(next);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.auth.login(email, password);
      const dashboard = dashboardPathForRole(res.user.role);
      if (!dashboard) {
        await api.auth.logout(res.refreshToken).catch(() => {});
        throw new ApiError(
          403,
          'This app is for hosts and cleaners. Use the DarClean website for admin/support accounts.',
        );
      }
      await persist(res);
      router.replace(dashboard as any);
    },
    [persist, router],
  );

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      role: 'HOST' | 'CLEANER';
      phone?: string;
    }) => {
      const res = await api.auth.register(payload);
      await persist(res);
      if (payload.role === 'HOST') {
        router.replace('/host/property/new');
      } else {
        router.replace('/onboarding');
      }
    },
    [persist, router],
  );

  const logout = useCallback(async () => {
    if (session) {
      try {
        await api.auth.logout(session.refreshToken);
      } catch {
        // Best-effort — clear locally regardless.
      }
    }
    await clearStoredSession();
    setSession(null);
    router.replace('/login');
  }, [session, router]);

  /** Patches fields on the current session's user without a full re-login. */
  const updateSessionUser = useCallback((patch: Partial<AuthUser>) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, ...patch } };
      writeStoredSession(next);
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, register, logout, updateSessionUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
export type { AuthUser };
