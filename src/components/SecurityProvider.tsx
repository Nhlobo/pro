import React, { createContext, useContext, useEffect, useState } from 'react';
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
  }, []);

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