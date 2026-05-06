import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface AppointmentSyncContextType {
  lastUpdate: number;
  triggerSync: (localOnly?: boolean, force?: boolean) => void;
  isConnected: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedTable: string | null;
  isActiveTab: boolean;
  isPageLocked: boolean;
  lockPage: () => void;
  unlockPage: () => void;
  processPendingSync: () => void;
  hasPendingSync: boolean;
}

const AppointmentSyncContext = createContext<AppointmentSyncContextType | undefined>(undefined);

// Unique tab ID to prevent cross-tab interference
const TAB_ID = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Activity timeout - page unlocks after 10 minutes of inactivity (increased from 5)
const ACTIVITY_TIMEOUT = 10 * 60 * 1000;

// Debounce activity events to prevent excessive locking
const ACTIVITY_DEBOUNCE = 500;

export const AppointmentSyncProvider = ({ children }: { children: ReactNode }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedTable, setLastSyncedTable] = useState<string | null>(null);
  const [isActiveTab, setIsActiveTab] = useState(!document.hidden);
  const [isPageLocked, setIsPageLocked] = useState(false);
  const [hasPendingSync, setHasPendingSync] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activityDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const pendingUpdatesRef = useRef<Array<{ table: string; payload: any }>>([]);

  // Lock the page from auto-refresh - enhanced with debouncing
  const lockPage = useCallback(() => {
    // Debounce rapid activity events
    if (activityDebounceRef.current) {
      return; // Already processing activity
    }

    activityDebounceRef.current = setTimeout(() => {
      activityDebounceRef.current = null;
    }, ACTIVITY_DEBOUNCE);

    setIsPageLocked(true);
    lastActivityRef.current = Date.now();
    
    // Clear existing timeout
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
    }
    
    // Set new timeout to unlock after extended inactivity
    activityTimeoutRef.current = setTimeout(() => {
      console.log('Page unlocked due to inactivity');
      setIsPageLocked(false);
      
      // Process any pending updates after unlock
      if (pendingUpdatesRef.current.length > 0) {
        console.log(`Processing ${pendingUpdatesRef.current.length} pending updates after inactivity unlock`);
        setHasPendingSync(true);
      }
    }, ACTIVITY_TIMEOUT);
  }, []);

  // Unlock the page (manual unlock) - also processes pending syncs
  const unlockPage = useCallback(() => {
    setIsPageLocked(false);
    if (activityTimeoutRef.current) {
      clearTimeout(activityTimeoutRef.current);
      activityTimeoutRef.current = null;
    }
    if (activityDebounceRef.current) {
      clearTimeout(activityDebounceRef.current);
      activityDebounceRef.current = null;
    }
    console.log('Page manually unlocked');
  }, []);

  // Process pending sync - call this when user is ready to refresh data
  const processPendingSync = useCallback(() => {
    if (pendingUpdatesRef.current.length > 0 || hasPendingSync) {
      console.log(`Processing ${pendingUpdatesRef.current.length} pending updates`);
      pendingUpdatesRef.current = [];
      setHasPendingSync(false);
      setSyncStatus('syncing');
      setLastUpdate(Date.now());
      setTimeout(() => {
        setSyncStatus('synced');
        setTimeout(() => setSyncStatus('idle'), 1000);
      }, 500);
    }
  }, [hasPendingSync]);

  // Track user activity to auto-lock page when working - enhanced filtering
  useEffect(() => {
    const activityEvents = ['mousedown', 'keydown', 'input', 'touchstart'];
    
    const handleActivity = (e: Event) => {
      // Only lock on meaningful interactions, not passive scrolling
      // Also ignore events from modals/dialogs that might be closing
      const target = e.target as HTMLElement;
      if (target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable ||
        e.type === 'keydown' ||
        e.type === 'mousedown'
      )) {
        lockPage();
      }
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
      if (activityDebounceRef.current) {
        clearTimeout(activityDebounceRef.current);
      }
    };
  }, [lockPage]);

  // Track tab visibility - NEVER auto-refresh when becoming visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isNowActive = !document.hidden;
      setIsActiveTab(isNowActive);
      
      // When tab becomes active, just update state - don't auto-refresh
      // User must manually refresh if needed via processPendingSync
      if (isNowActive && pendingUpdatesRef.current.length > 0) {
        console.log('Tab active - pending updates available but not auto-processing');
        setHasPendingSync(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Prevent browser refresh/navigation when page is locked with unsaved state
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only show warning if page is locked (user is actively working)
      if (isPageLocked) {
        e.preventDefault();
        e.returnValue = 'You have unsaved work in progress. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isPageLocked]);

  // localOnly = true means don't trigger cross-component refreshes (just update status)
  // force = true bypasses lock/inactive guards (use after a confirmed user-initiated save)
  const triggerSync = useCallback((localOnly: boolean = false, force: boolean = false) => {
    // If page is locked, ALWAYS queue the sync - never refresh (unless forced)
    if (isPageLocked && !localOnly && !force) {
      console.log('Page locked - sync queued, no refresh will occur');
      setHasPendingSync(true);
      return;
    }

    // If tab is not active, queue the sync (unless forced)
    if (!isActiveTab && !localOnly && !force) {
      console.log('Tab inactive - sync queued');
      setHasPendingSync(true);
      return;
    }

    setSyncStatus('syncing');
    
    // Only update lastUpdate if not localOnly - this prevents cascading refreshes
    if (!localOnly) {
      setLastUpdate(Date.now());
      // Clear any queued pending state since we just broadcast
      pendingUpdatesRef.current = [];
      setHasPendingSync(false);
    }
    
    // Reset to synced after a brief delay
    setTimeout(() => {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);
    }, 500);
  }, [isActiveTab, isPageLocked]);

  // Handle realtime updates - NEVER trigger refresh when locked or inactive
  const handleRealtimeUpdate = useCallback((table: string, payload: any) => {
    console.log(`${table} changed:`, payload.eventType);
    setLastSyncedTable(table);
    
    // Queue the update for later processing
    pendingUpdatesRef.current.push({ table, payload });
    
    // NEVER trigger sync if page is locked
    if (isPageLocked) {
      console.log(`Page locked - ${table} update queued, preserving current state`);
      setHasPendingSync(true);
      return;
    }
    
    // NEVER trigger sync if tab is not active
    if (!isActiveTab) {
      console.log(`Tab inactive - ${table} update queued`);
      setHasPendingSync(true);
      return;
    }
    
    // Only process if not locked and tab is active
    pendingUpdatesRef.current = []; // Clear since we're processing now
    setHasPendingSync(false);
    triggerSync();
  }, [isPageLocked, isActiveTab, triggerSync]);

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
          handleRealtimeUpdate('appointments', payload);
          
          // Only show toast if page is NOT locked and INSERT event
          if (payload.eventType === 'INSERT' && !isPageLocked && isActiveTab) {
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
          handleRealtimeUpdate('appointment_requests', payload);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expert_reports' },
        (payload) => {
          handleRealtimeUpdate('expert_reports', payload);
          
          // Only show toast if page is NOT locked and relevant UPDATE
          if (payload.eventType === 'UPDATE' && !isPageLocked && isActiveTab) {
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
          handleRealtimeUpdate('aod_documents', payload);
          if (!isPageLocked && isActiveTab) {
            window.dispatchEvent(new CustomEvent('agreement-data-updated', { detail: { agreementType: 'aod' } }));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'short_term_agreements' },
        (payload) => {
          handleRealtimeUpdate('short_term_agreements', payload);
          if (!isPageLocked && isActiveTab) {
            window.dispatchEvent(new CustomEvent('agreement-data-updated', { detail: { agreementType: 'short_term' } }));
          }
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
  }, [toast, handleRealtimeUpdate, isPageLocked, isActiveTab]);

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
      unlockPage,
      processPendingSync,
      hasPendingSync
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
