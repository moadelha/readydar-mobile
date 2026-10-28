import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { useHostAccess } from '@/lib/access';
import { api } from '@/lib/api';

/**
 * Which "console" a host account gets — the mobile twin of the web app's
 * usePlanConsole (apps/web/src/lib/plan-console.ts). Pro is read the same
 * way the web does it: the plan includes the guest inbox. The inbox's own
 * unread count lives here too, so the tab badge and the inbox screen share
 * one number instead of each polling for it.
 *
 * There's no push yet, so the count is refreshed on a timer while the app
 * is in the foreground, and whenever it comes back to the foreground.
 */
interface PlanConsoleValue {
  loaded: boolean;
  isPro: boolean;
  businessType: 'RENTALS' | 'HOSTEL';
  /** Pro and allowed to read guest messages (STAFF needs MESSAGES). */
  canMessages: boolean;
  /** Conversations with at least one unread guest message. */
  unreadThreads: number;
  refreshUnread: () => void;
}

const UNREAD_POLL_MS = 60_000;

const PlanConsoleContext = createContext<PlanConsoleValue | null>(null);

export function PlanConsoleProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const { has } = useHostAccess();
  const token = session?.accessToken;
  const isHost = session?.user.role === 'HOST';

  const [loaded, setLoaded] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [businessType, setBusinessType] = useState<'RENTALS' | 'HOSTEL'>('RENTALS');
  const [unreadThreads, setUnreadThreads] = useState(0);

  // Keyed on the user, not the token: a token refresh mustn't refetch the
  // plan or flash the Pro tabs away and back.
  const userId = session?.user.id;
  useEffect(() => {
    setLoaded(false);
    setIsPro(false);
    setBusinessType('RENTALS');
    setUnreadThreads(0);
    if (!token || !isHost) return;
    let cancelled = false;
    api.billing
      .getEntitlements(token)
      .then((e) => {
        if (cancelled) return;
        setIsPro(!!e.features?.inbox);
        setBusinessType(e.businessType ?? 'RENTALS');
        setLoaded(true);
      })
      // Fail closed for Pro screens (unlike the web, which fails open): the
      // inbox calls would only 403 for a host who isn't on Pro.
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isHost]);

  const canMessages = isPro && has('MESSAGES');

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const refreshUnread = useCallback(() => {
    const current = tokenRef.current;
    if (!current || !canMessages) return;
    api.messaging
      .unreadCount(current)
      .then((r) => setUnreadThreads(r.unreadThreads))
      .catch(() => {});
  }, [canMessages]);

  useEffect(() => {
    if (!canMessages) return;
    refreshUnread();
    let timer: ReturnType<typeof setInterval> | null = setInterval(refreshUnread, UNREAD_POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshUnread();
        if (!timer) timer = setInterval(refreshUnread, UNREAD_POLL_MS);
      } else if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    return () => {
      if (timer) clearInterval(timer);
      sub.remove();
    };
  }, [canMessages, refreshUnread]);

  return (
    <PlanConsoleContext.Provider value={{ loaded, isPro, businessType, canMessages, unreadThreads, refreshUnread }}>
      {children}
    </PlanConsoleContext.Provider>
  );
}

export function usePlanConsole() {
  const ctx = useContext(PlanConsoleContext);
  if (!ctx) throw new Error('usePlanConsole must be used within PlanConsoleProvider');
  return ctx;
}
