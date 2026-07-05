import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Offline handling for the whole app, entirely client-side — applies
 * whether the visitor is signed in or signed out.
 *
 * - Goes offline -> after a short grace period (to ignore brief connection
 *   blips) redirect to /offline, remembering where they were.
 * - Reconnects -> automatically returned to the exact page they were on
 *   (signed in or not).
 * - Signed-in users only: offline for 15 minutes or more (whether or not
 *   they've reconnected yet) is treated as a session timeout — signed out
 *   and sent to /auth, same as a normal logout. Signed-out visitors have no
 *   session to expire, so they're simply returned to where they were,
 *   however long it takes.
 *
 * Does not call any backend RPCs or touch the database — signOut() here is
 * the same client-side sign-out already used everywhere else in the app.
 */
const OFFLINE_GRACE_MS = 3_000;
const OFFLINE_SESSION_LIMIT_MS = 15 * 60 * 1000;
export const RETURN_PATH_KEY = 'mlp_offline_return_path';
export const OFFLINE_SINCE_KEY = 'mlp_offline_since';

const readSince = (): number | null => {
  try {
    const raw = sessionStorage.getItem(OFFLINE_SINCE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
};

export const clearStoredOfflineState = () => {
  try {
    sessionStorage.removeItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(OFFLINE_SINCE_KEY);
  } catch {
    /* sessionStorage unavailable — nothing to clean up */
  }
};

export const readStoredReturnPath = (fallback: string): string => {
  try {
    return sessionStorage.getItem(RETURN_PATH_KEY) || fallback;
  } catch {
    return fallback;
  }
};

export function useOfflineRedirect() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const graceTimerRef = useRef<number | null>(null);
  const limitTimerRef = useRef<number | null>(null);
  const locationRef = useRef(location);
  locationRef.current = location;

  useEffect(() => {
    const defaultReturnPath = user ? '/dashboard' : '/auth';

    const forceTimeoutLogout = async () => {
      clearStoredOfflineState();
      if (limitTimerRef.current) {
        window.clearTimeout(limitTimerRef.current);
        limitTimerRef.current = null;
      }
      if (user) await signOut();
      navigate('/auth', { replace: true });
    };

    const armSessionLimitTimer = (msRemaining: number) => {
      if (!user) return;
      if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
      limitTimerRef.current = window.setTimeout(() => {
        void forceTimeoutLogout();
      }, Math.max(0, msRemaining));
    };

    const goOffline = () => {
      if (locationRef.current.pathname === '/offline') return;
      try {
        sessionStorage.setItem(
          RETURN_PATH_KEY,
          locationRef.current.pathname + locationRef.current.search
        );
        sessionStorage.setItem(OFFLINE_SINCE_KEY, String(Date.now()));
      } catch {
        /* proceed without remembering the return path */
      }
      armSessionLimitTimer(OFFLINE_SESSION_LIMIT_MS);
      navigate('/offline');
    };

    const handleOffline = () => {
      if (graceTimerRef.current) window.clearTimeout(graceTimerRef.current);
      graceTimerRef.current = window.setTimeout(goOffline, OFFLINE_GRACE_MS);
    };

    const returnFromOfflinePage = () => {
      const returnPath = readStoredReturnPath(defaultReturnPath);
      clearStoredOfflineState();
      navigate(returnPath, { replace: true });
    };

    const handleOnline = async () => {
      if (graceTimerRef.current) {
        window.clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }

      const offlineSince = readSince();
      if (user && offlineSince && Date.now() - offlineSince >= OFFLINE_SESSION_LIMIT_MS) {
        await forceTimeoutLogout();
        return;
      }

      if (limitTimerRef.current) {
        window.clearTimeout(limitTimerRef.current);
        limitTimerRef.current = null;
      }

      if (locationRef.current.pathname === '/offline') {
        returnFromOfflinePage();
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOffline();
    } else if (locationRef.current.pathname === '/offline') {
      const offlineSince = readSince();
      if (user && offlineSince && Date.now() - offlineSince >= OFFLINE_SESSION_LIMIT_MS) {
        void forceTimeoutLogout();
      } else {
        returnFromOfflinePage();
      }
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (graceTimerRef.current) window.clearTimeout(graceTimerRef.current);
      if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
    };
  }, [user, navigate, signOut]);
}

export const OfflineRedirectGuard = () => {
  useOfflineRedirect();
  return null;
};
