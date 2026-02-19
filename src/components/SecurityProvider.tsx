import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';

interface SecurityContextType {
  isSecureSession: boolean;
  validateAccess: (requiredPermission?: string) => boolean;
  logSecurityEvent: (event: string, details?: any) => void;
  maskSensitiveData: (data: string, type: 'email' | 'phone' | 'address') => string;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isSecureSession, setIsSecureSession] = useState(false);
  const [showCountdown, setShowCountdown] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(50);
  const { toast } = useToast();
  const { signOut } = useAuth();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Session timeout constants (in milliseconds)
  const SESSION_TIMEOUT = 45 * 60 * 1000; // 45 minutes
  const WARNING_TIME = 60 * 1000; // 60 seconds before logout

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

  const handleLogout = useCallback(async () => {
    logSecurityEvent('session_timeout_logout');
    toast({
      title: 'Session Expired',
      description: 'You have been logged out due to inactivity.',
      variant: 'destructive',
    });
    await signOut();
  }, [toast, logSecurityEvent, signOut]);

  const showTimeoutWarning = useCallback(() => {
    setShowCountdown(true);
    setCountdownSeconds(60);
    
    // Start countdown
    let seconds = 60;
    countdownIntervalRef.current = setInterval(() => {
      seconds--;
      setCountdownSeconds(seconds);
      
      if (seconds <= 0) {
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        setShowCountdown(false);
        handleLogout();
      }
    }, 1000);
  }, [handleLogout]);

  const resetSessionTimeout = useCallback(() => {
    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    // Hide countdown if showing
    setShowCountdown(false);

    // Only set timeouts if user is authenticated
    if (isSecureSession) {
      lastActivityRef.current = Date.now();
      
      // Set warning timeout (19 minutes 10 seconds - giving 50 seconds warning)
      warningTimeoutRef.current = setTimeout(() => {
        showTimeoutWarning();
      }, SESSION_TIMEOUT - WARNING_TIME);
    }
  }, [isSecureSession, showTimeoutWarning]);

  const extendSession = useCallback(() => {
    // Clear countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
    setShowCountdown(false);
    
    // Reset session timeout
    resetSessionTimeout();
    
    toast({
      title: 'Session Extended',
      description: 'Your session has been extended for another 45 minutes.',
    });
  }, [resetSessionTimeout, toast]);

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
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
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
        if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
        }
        setShowCountdown(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [logSecurityEvent]);

  // Reset timeout when session becomes secure
  useEffect(() => {
    if (isSecureSession) {
      resetSessionTimeout();
    }
  }, [isSecureSession, resetSessionTimeout]);

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
      
      {/* Session Timeout Countdown Dialog */}
      <AlertDialog open={showCountdown} onOpenChange={() => {}}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">⚠️ Session Expiring</AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              <div className="space-y-4">
                <p>Your session will expire due to inactivity in:</p>
                <div className="text-4xl font-bold text-destructive">
                  {countdownSeconds}
                </div>
                <p className="text-sm text-muted-foreground">
                  Click "Stay Logged In" to extend your session
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                if (countdownIntervalRef.current) {
                  clearInterval(countdownIntervalRef.current);
                }
                setShowCountdown(false);
                handleLogout();
              }}
            >
              Logout Now
            </Button>
            <Button 
              onClick={extendSession}
              className="bg-primary hover:bg-primary/90"
            >
              Stay Logged In
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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