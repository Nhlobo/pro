import { useState, useEffect, createContext, useContext, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logDeviceLogout } from '@/utils/trustedDevice';
import { markExternalPortalSession, postSignOutPath, EXTERNAL_PORTAL_SIGN_IN_PATH } from '@/utils/externalPortalSession';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isEmailConfirmed: boolean;
  signOut: () => Promise<void>;
  resendConfirmation: () => Promise<{ error?: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmailConfirmed, setIsEmailConfirmed] = useState(false);
  // Tracks the id we've already looked up is_external_portal_user for, so
  // the effect below doesn't re-query on every unrelated re-render.
  const externalCheckedForUserId = useRef<string | null>(null);

  const cleanupAuthState = () => {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    try {
      Object.keys(sessionStorage).forEach((key) => {
        if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch {
      /* sessionStorage may be unavailable in some contexts */
    }
  };

  const resendConfirmation = async () => {
    if (!user?.email) {
      return { error: { message: 'No email found' } };
    }

    try {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
        options: { emailRedirectTo: redirectUrl }
      });

      // If already confirmed, send a magic login link instead
      if (error && (error.message?.toLowerCase().includes('confirm') || error.message?.toLowerCase().includes('already'))) {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email: user.email,
          options: { emailRedirectTo: redirectUrl }
        });
        return { error: otpError };
      }
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    // Read the CACHED flag, not a fresh query — `user` (and the session it
    // depends on) is about to go null as soon as supabase.auth.signOut()
    // fires its SIGNED_OUT event, and every other guard that reacts to
    // "no user" (ProtectedRoute, etc.) does so synchronously on that same
    // state change. An async profiles lookup here loses that race: by the
    // time it resolved, ProtectedRoute had already fired its own
    // navigate('/auth'). Reading the cache is instant, so there's no
    // window where a stale destination can be used.
    const target = postSignOutPath();

    try {
      // Must run BEFORE signOut() — it's a plain authenticated insert, not an
      // edge function, so it needs the still-active session to satisfy RLS.
      await logDeviceLogout(user?.id);
      cleanupAuthState();
      // Deliberately NOT clearing the external-portal-session flag here —
      // see the comment on it in externalPortalSession.ts. It has to
      // survive this sign-out so that a stale Back/bfcache hit on an old
      // protected page still resolves to the right sign-in page.
      await supabase.auth.signOut({ scope: 'global' });
      // replace(), not href=, so the authenticated page this was called
      // from is dropped from history rather than left one Back-press away.
      window.location.replace(target);
    } catch (error) {
      // Force redirect even if signOut fails
      window.location.replace(target);
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Handle sign out - clear everything
        if (event === 'SIGNED_OUT') {
          cleanupAuthState();
          // external-portal-session flag intentionally left in place —
          // see externalPortalSession.ts.
          externalCheckedForUserId.current = null;
          setSession(null);
          setUser(null);
          setIsEmailConfirmed(false);
          setLoading(false);
          return;
        }

        // For TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION events that
        // fire whenever the tab regains focus, only update state if the
        // signed-in user actually changed. Otherwise we generate new object
        // references that cascade into every page re-rendering / refetching
        // (which the user perceives as the page "refreshing" on tab return).
        setUser(prev => {
          const nextUser = newSession?.user ?? null;
          if (prev?.id === nextUser?.id) return prev;
          return nextUser;
        });
        setSession(prev => {
          if (prev?.user?.id === newSession?.user?.id) return prev;
          return newSession;
        });
        setIsEmailConfirmed(newSession?.user?.email_confirmed_at ? true : false);
        setLoading(false);

        // Defer any additional data fetching to prevent deadlocks
        if (event === 'SIGNED_IN' && newSession?.user) {
          setTimeout(() => {
            // Any additional user data fetching can be done here
          }, 0);
        }
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        cleanupAuthState();
        setSession(null);
        setUser(null);
        setIsEmailConfirmed(false);
        setLoading(false);
        // Cached from a previous session if this device belongs to an
        // external-portal user — a broken/expired session should still
        // send them back to their own sign-in page, not the staff one.
        // (Flag intentionally not cleared here — see externalPortalSession.ts.)
        if (window.location.pathname !== '/auth' && window.location.pathname !== EXTERNAL_PORTAL_SIGN_IN_PATH) {
          window.location.replace(postSignOutPath());
        }
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      setIsEmailConfirmed(session?.user?.email_confirmed_at ? true : false);
      setLoading(false);

      // If there is no session, clear any stale auth keys to prevent refresh loops
      if (!session) {
        cleanupAuthState();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // As soon as we know who's signed in, cache whether this is an
  // external-portal account (referring attorney / medical expert) so any
  // later "no user" redirect — sign-out, a session error, etc. — has a
  // synchronous answer instead of needing to query it under time pressure.
  useEffect(() => {
    if (!user?.id) return;
    if (externalCheckedForUserId.current === user.id) return;
    externalCheckedForUserId.current = user.id;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('is_external_portal_user')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        markExternalPortalSession(!!data?.is_external_portal_user);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, session, loading, isEmailConfirmed, signOut, resendConfirmation }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
