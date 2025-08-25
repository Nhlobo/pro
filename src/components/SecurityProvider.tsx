import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SecurityContextType {
  isSecureSession: boolean;
  validateAccess: (requiredPermission?: string) => boolean;
  logSecurityEvent: (event: string, details?: any) => void;
  maskSensitiveData: (data: string, type: 'email' | 'phone' | 'address') => string;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSecureSession, setIsSecureSession] = useState(false);
  const { toast } = useToast();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Session timeout constants (in milliseconds)
  const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  const WARNING_TIME = 5 * 60 * 1000; // 5 minutes before logout

  const logSecurityEvent = async (event: string, details?: any) => {
    try {
      await supabase.rpc('log_sensitive_data_access', {
        accessed_table: 'security_events',
        accessed_record_id: crypto.randomUUID(),
        access_type: event
      });
    } catch (error) {
      console.warn('Failed to log security event:', error);
    }
  };

  const handleLogout = useCallback(async () => {
    logSecurityEvent('session_timeout_logout');
    toast({
      title: 'Session Expired',
      description: 'You have been logged out due to inactivity.',
      variant: 'destructive',
    });
    await supabase.auth.signOut();
    window.location.href = '/auth';
  }, [toast]);

  const showTimeoutWarning = useCallback(() => {
    toast({
      title: 'Session Expiring Soon',
      description: 'Your session will expire in 5 minutes due to inactivity.',
      variant: 'destructive',
    });
  }, [toast]);

  const resetSessionTimeout = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    // Only set timeouts if user is authenticated
    if (isSecureSession) {
      lastActivityRef.current = Date.now();
      
      // Set warning timeout (25 minutes)
      warningTimeoutRef.current = setTimeout(() => {
        showTimeoutWarning();
      }, SESSION_TIMEOUT - WARNING_TIME);

      // Set logout timeout (30 minutes)
      timeoutRef.current = setTimeout(() => {
        handleLogout();
      }, SESSION_TIMEOUT);
    }
  }, [isSecureSession, handleLogout, showTimeoutWarning]);

  // Track user activity
  const handleUserActivity = useCallback(() => {
    if (isSecureSession) {
      resetSessionTimeout();
    }
  }, [isSecureSession, resetSessionTimeout]);

  useEffect(() => {
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    // Add event listeners for user activity
    activityEvents.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    return () => {
      // Clean up event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
      
      // Clear timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
    };
  }, [handleUserActivity]);

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
        // Clear timeouts on logout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        if (warningTimeoutRef.current) {
          clearTimeout(warningTimeoutRef.current);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Reset timeout when session becomes secure
  useEffect(() => {
    if (isSecureSession) {
      resetSessionTimeout();
    }
  }, [isSecureSession, resetSessionTimeout]);

  const validateSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsSecureSession(false);
        return;
      }

      // Validate user session using secure function
      const { data: isValid, error } = await supabase
        .rpc('validate_user_session');

      if (error || !isValid) {
        setIsSecureSession(false);
        toast({
          title: 'Security Alert',
          description: 'Session validation failed. Please log in again.',
          variant: 'destructive',
        });
        await supabase.auth.signOut();
        return;
      }

      setIsSecureSession(true);
    } catch (error) {
      console.error('Security validation error:', error);
      setIsSecureSession(false);
    }
  };

  const validateAccess = (requiredPermission?: string): boolean => {
    if (!isSecureSession) {
      return false;
    }

    // Additional permission checks can be added here
    if (requiredPermission) {
      logSecurityEvent('permission_check', { permission: requiredPermission });
    }

    return true;
  };

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