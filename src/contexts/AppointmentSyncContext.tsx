import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface AppointmentSyncContextType {
  lastUpdate: number;
  triggerSync: (localOnly?: boolean) => void;
  isConnected: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedTable: string | null;
  isActiveTab: boolean;
  isPageLocked: boolean;
  lockPage: () => void;
  unlockPage: () => void;
}

const AppointmentSyncContext = createContext<AppointmentSyncContextType | undefined>(undefined);

// Unique tab ID to prevent cross-tab interference
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Activity timeout - page unlocks after 5 minutes of inactivity
const ACTIVITY_TIMEOUT = 5 * 60 * 1000;

export const AppointmentSyncProvider = ({ children }: { children: ReactNode }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedTable, setLastSyncedTable] = useState<string | null>(null);
  const [isActiveTab, setIsActiveTab] = useState(!document.hidden);
  const [isPageLocked, setIsPageLocked] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingSyncRef = useRef(false);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // Lock the page from auto-refresh
  const lockPage = useCallback(() => {
    setIsPageLocked(true);
    lastActivityRef.current = Date.now();
    
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    // Set new timeout to unlock after inactivity
    activityTimeoutRef.current = setTimeout(() => {
      setIsPageLocked(false);
    }, ACTIVITY_TIMEOUT);
  }, []);

  // Unlock the page (manual unlock)
  const unlockPage = useCallback(() => {
    setIsPageLocked(false);
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = null;
    }
  }, []);

  // Track user activity to auto-lock page when working
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'input', 'scroll', 'touchstart'];
    
    const handleActivity = () => {
      // Lock page on any user activity
      lockPage();
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      if (activityTimeoutRef.current) {
        clearTimeout(activityTimeoutRef.current);
      }
    };
  }, [lockPage]);

  // Track tab visibility to prevent background tab interference
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isNowActive = !document.hidden;
      setIsActiveTab(isNowActive);
      
      // If tab becomes active and there was a pending sync, don't auto-refresh
      // User must manually refresh if needed
      if (isNowActive && pendingSyncRef.current) {
        pendingSyncRef.current = false;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // localOnly = true means don't trigger cross-component refreshes (just update status)
  const triggerSync = useCallback((localOnly: boolean = false) => {
    // If page is locked, queue the sync instead of executing it
    if (isPageLocked && !localOnly) {
      pendingSyncRef.current = true;
      console.log('Page locked - sync queued');
      return;
    }

    // If tab is not active, queue the sync instead of executing it
    if (!isActiveTab && !localOnly) {
      pendingSyncRef.current = true;
      return;
    }

    setSyncStatus('syncing');
    
    // Only update lastUpdate if not localOnly - this prevents cascading refreshes
    if (!localOnly) {
      setLastUpdate(Date.now());
    }
    
    // Reset to synced after a brief delay
    setTimeout(() => {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);
    }, 500);
  }, [isActiveTab, isPageLocked]);

  const setupChannel = useCallback(() => {
    // Clean up existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Create a channel for critical table updates only
    const channel = supabase
      .channel(`sync-channel-${TAB_ID}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        (payload) => {
          console.log('Appointments changed:', payload);
          setLastSyncedTable('appointments');
          triggerSync();
          
          if (payload.eventType === 'INSERT' && !isPageLocked) {
            toast({
              title: "New Appointment",
              description: "A new appointment has been created.",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointment_requests' },
        (payload) => {
          console.log('Appointment requests changed:', payload);
          setLastSyncedTable('appointment_requests');
          triggerSync();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expert_reports' },
        (payload) => {
          console.log('Expert reports changed:', payload);
          setLastSyncedTable('expert_reports');
          triggerSync();
          
          if (payload.eventType === 'UPDATE' && !isPageLocked) {
            const newData = payload.new as any;
            const oldData = payload.old as any;
            
            if (oldData?.report_status !== newData?.report_status) {
              toast({
                title: "Report Status Updated",
                description: `Status changed to ${newData.report_status}.`,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'aod_documents' },
        (payload) => {
          console.log('AOD documents changed:', payload);
          setLastSyncedTable('aod_documents');
          triggerSync();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time sync active');
          setIsConnected(true);
          setSyncStatus('synced');
          retryCountRef.current = 0;
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('⚠️ Real-time sync issue, will retry');
          setIsConnected(false);
          setSyncStatus('error');
          
          // Exponential backoff retry (max 30 seconds)
          const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
          retryCountRef.current++;
          
          if (retryCountRef.current <= 5) {
            retryTimeoutRef.current = setTimeout(() => {
              console.log(`Retrying connection (attempt ${retryCountRef.current})...`);
              setupChannel();
            }, retryDelay);
          } else {
            toast({
              title: "Sync Unavailable",
              description: "Real-time updates paused. Data will refresh on navigation.",
              variant: "destructive",
            });
          }
        } else if (status === 'CLOSED') {
          setIsConnected(false);
        }
      });

    channelRef.current = channel;
  }, [toast, triggerSync, isPageLocked]);

  useEffect(() => {
    // Only establish real-time connection if user is authenticated and not loading
    if (!user || loading) {
      setIsConnected(false);
      return;
    }

    setupChannel();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, loading, setupChannel]);

  return (
    <AppointmentSyncContext.Provider value={{ 
      lastUpdate, 
      triggerSync, 
      isConnected, 
      syncStatus, 
      lastSyncedTable, 
      isActiveTab,
      isPageLocked,
      lockPage,
      unlockPage
    }}>
      {children}
    </AppointmentSyncContext.Provider>
  );
};

export const useAppointmentSync = () => {
  const context = useContext(AppointmentSyncContext);
  if (context === undefined) {
    throw new Error('useAppointmentSync must be used within AppointmentSyncProvider');
  }
  return context;
};
