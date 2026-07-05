import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

/**
 * Offline handling for signed-in staff, entirely client-side.
 *
 * - Goes offline while logged in -> after a short grace period (to ignore
 *   brief connection blips) redirect to /offline, remembering where they
 *   were.
 * - Reconnects within 15 minutes -> automatically returned to the exact
 *   page they were on.
 * - Offline for 15 minutes or more (whether or not they've reconnected
 *   yet) -> treated as a session timeout: signed out and sent to /auth,
 *   same as a normal logout.
 *
 * Does not call any backend RPCs or touch the database — signOut() here is
 * the same client-side sign-out already used everywhere else in the app.
 */
const OFFLINE_GRACE_MS = 3_000;
const OFFLINE_SESSION_LIMIT_MS = 15 * 60 * 1000;
const RETURN_PATH_KEY = 'mlp_offline_return_path';
const OFFLINE_SINCE_KEY = 'mlp_offline_since';

const readSince = (): number | null => {
  try {
    const raw = sessionStorage.getItem(OFFLINE_SINCE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
};

const clearStoredOfflineState = () => {
  try {
    sessionStorage.removeItem(RETURN_PATH_KEY);
    sessionStorage.removeItem(OFFLINE_SINCE_KEY);
  } catch {
    /* sessionStorage unavailable — nothing to clean up */
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
    if (!user) return;

    const forceTimeoutLogout = async () => {
      clearStoredOfflineState();
      await signOut();
    };

    const armSessionLimitTimer = (msRemaining: number) => {
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

    const handleOnline = async () => {
      if (graceTimerRef.current) {
        window.clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }

      const offlineSince = readSince();
      if (offlineSince && Date.now() - offlineSince >= OFFLINE_SESSION_LIMIT_MS) {
        if (limitTimerRef.current) window.clearTimeout(limitTimerRef.current);
        await forceTimeoutLogout();
        return;
      }

      if (limitTimerRef.current) {
        window.clearTimeout(limitTimerRef.current);
        limitTimerRef.current = null;
      }

      if (locationRef.current.pathname === '/offline') {
        let returnPath = '/dashboard';
        try {
          returnPath = sessionStorage.getItem(RETURN_PATH_KEY) || '/dashboard';
        } catch {
          /* fall back to dashboard */
        }
        clearStoredOfflineState();
        navigate(returnPath, { replace: true });
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    // App loaded while already offline (e.g. opened with no connection).
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      handleOffline();
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
