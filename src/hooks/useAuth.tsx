import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logDeviceLogout } from '@/utils/trustedDevice';

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
    // Determine BEFORE any cleanup/signOut call — both need the still-active
    // session/user id. An external-portal user (referring attorney or medical
    // expert who logged in via the emailed link + OTP, not a staff password)
    // must land back on their own sign-in page, never on the internal /auth
    // staff login. Defaults to false (→ /auth) if the lookup fails, since a
    // real staff account is the common case and profiles is queryable with
    // the still-active session at this point.
    let isExternalPortalUser = false;
    try {
      if (user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_external_portal_user')
          .eq('id', user.id)
          .maybeSingle();
        isExternalPortalUser = !!profile?.is_external_portal_user;
      }
    } catch {
      /* fall back to /auth below */
    }

    const postSignOutPath = isExternalPortalUser ? '/external-portal/sign-in' : '/auth';

    try {
      // Must run BEFORE signOut() — it's a plain authenticated insert, not an
      // edge function, so it needs the still-active session to satisfy RLS.
      await logDeviceLogout(user?.id);
      cleanupAuthState();
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = postSignOutPath;
    } catch (error) {
      // Force redirect even if signOut fails
      window.location.href = postSignOutPath;
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Handle sign out - clear everything
        if (event === 'SIGNED_OUT') {
          cleanupAuthState();
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
        if (window.location.pathname !== '/auth') {
          window.location.href = '/auth';
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
