import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SecurityContextType {
  isSecureSession: boolean;
  validateAccess: (requiredPermission?: string) => boolean;
  logSecurityEvent: (event: string, details?: any) => void;
  maskSensitiveData: (data: string, type: 'email' | 'phone' | 'address') => string;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

/**
 * Security context: session-validity flag, access checks, audit logging, and
 * data masking helpers used by SecureDataDisplay and others.
 *
 * NOTE: this used to ALSO run its own idle-timeout countdown ("Session
 * Expiring" dialog, 45 min). That duplicated `IdleLogoutGuard.tsx`, which
 * runs its own independent 15-min idle timer with its own countdown dialog.
 * Both were mounted globally at the same time, so staff would randomly see
 * two different-looking "you're about to be logged out" popups depending on
 * which timer happened to fire first — reported as a confusing/unrecognized
 * duplicate UI. IdleLogoutGuard is the one canonical inactivity-logout
 * experience now; the timeout/countdown logic here has been removed so
 * there is exactly one idle-logout system in the app.
 */
export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSecureSession, setIsSecureSession] = useState(false);

  const normalizeAuditAction = (event: string): 'CREATE' | 'UPDATE' | 'DELETE' | 'DELETE_ALL' | 'SELECT' | 'INSERT' => {
    const e = event.toLowerCase();

    if (e.includes('permission') || e.includes('view') || e.includes('read') || e.includes('access')) return 'SELECT';
    if (e.includes('update') || e.includes('edit')) return 'UPDATE';
    if (e.includes('delete')) return 'DELETE';

    // Default to INSERT for login/logout/security events
    return 'INSERT';
  };

  const logSecurityEvent = useCallback(async (event: string, details?: any) => {
    try {
      await supabase.rpc('log_sensitive_data_access', {
        accessed_table: 'security_events',
        accessed_record_id: crypto.randomUUID(),
        access_type: normalizeAuditAction(event)
      });
    } catch (error) {
      console.warn('Failed to log security event:', error);
    }
  }, []);

  useEffect(() => {
    validateSession();

    // Monitor auth state changes for security
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        validateSession();
        logSecurityEvent('user_login', { userId: session?.user?.id });
      } else if (event === 'SIGNED_OUT') {
        setIsSecureSession(false);
        logSecurityEvent('user_logout');
      }
    });

    return () => subscription.unsubscribe();
  }, [logSecurityEvent]);

  const validateSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setIsSecureSession(true);
      } else {
        setIsSecureSession(false);
      }
    } catch (error) {
      console.error('Security validation error:', error);
      setIsSecureSession(false);
    }
  };

  const validateAccess = useCallback((requiredPermission?: string): boolean => {
    if (!isSecureSession) {
      return false;
    }

    // Additional permission checks can be added here
    if (requiredPermission) {
      logSecurityEvent('permission_check', { permission: requiredPermission });
    }

    return true;
  }, [isSecureSession, logSecurityEvent]);

  const maskSensitiveData = (data: string, type: 'email' | 'phone' | 'address'): string => {
    if (!data) return '[Protected]';

    switch (type) {
      case 'email':
        if (data.includes('@')) {
          const [local, domain] = data.split('@');
          return `${local.slice(0, 2)}***@${domain}`;
        }
        return '***';
      case 'phone':
        if (data.length > 6) {
          return `${data.slice(0, 3)}***${data.slice(-3)}`;
        }
        return '***';
      case 'address':
        if (data.length > 10) {
          return `${data.slice(0, 5)}...[Protected]`;
        }
        return '[Protected]';
      default:
        return '[Protected]';
    }
  };

  const value: SecurityContextType = {
    isSecureSession,
    validateAccess,
    logSecurityEvent,
    maskSensitiveData,
  };

  return (
    <SecurityContext.Provider value={value}>
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider');
  }
  return context;
};
