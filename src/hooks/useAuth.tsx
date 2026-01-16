import { useState, useEffect, createContext, useContext } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

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
    try {
      cleanupAuthState();
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = '/auth';
    } catch (error) {
      // Force redirect even if signOut fails
      window.location.href = '/auth';
    }
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // If refresh token is invalid/expired, clear state to prevent infinite refresh + realtime error loops
        if (event === 'TOKEN_REFRESH_FAILED') {
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

        // Defer any additional data fetching to prevent deadlocks
        if (event === 'SIGNED_IN' && session?.user) {
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