import { useCallback, useEffect, useState } from 'react';
import type { ExternalPortalType } from '@/types/externalPortal';
import { logoutExternalPortalSession } from '@/services/externalPortal/externalPortalAuthClient';

/**
 * External Portal Module — session storage.
 *
 * This is entirely separate from the main app's Supabase auth session:
 * external users have no auth.users row and no Supabase JWT. The
 * session token here is an opaque value issued by external-portal-auth
 * and only ever validated server-side (against
 * external_portal_sessions.session_token_hash) by this module's own
 * edge/RPC layer in Phase 3/4 — nothing about it flows through
 * `supabase.auth`.
 */

const STORAGE_KEY = 'external_portal_session';

export interface ExternalPortalSession {
  session_token: string;
  portal_type: ExternalPortalType;
  full_name: string;
  email: string;
  expires_at: string;
}

function readStoredSession(): ExternalPortalSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ExternalPortalSession;
    if (!parsed?.session_token || !parsed?.expires_at) return null;
    if (new Date(parsed.expires_at).getTime() <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function useExternalPortalSession() {
  const [session, setSessionState] = useState<ExternalPortalSession | null>(() => readStoredSession());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSessionState(readStoredSession());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setSession = useCallback((next: ExternalPortalSession) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSessionState(next);
  }, []);

  const clearSession = useCallback(async () => {
    const current = readStoredSession();
    localStorage.removeItem(STORAGE_KEY);
    setSessionState(null);
    if (current?.session_token) {
      try {
        await logoutExternalPortalSession(current.session_token);
      } catch {
        /* best-effort revoke — local session is already cleared either way */
      }
    }
  }, []);

  return {
    session,
    isAuthenticated: !!session,
    setSession,
    clearSession,
  };
}
