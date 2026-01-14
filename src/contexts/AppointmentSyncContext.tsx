import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AppointmentSyncContextType {
  lastUpdate: number;
  triggerSync: () => void;
  isConnected: boolean;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
  lastSyncedTable: string | null;
}

const AppointmentSyncContext = createContext<AppointmentSyncContextType | undefined>(undefined);

export const AppointmentSyncProvider = ({ children }: { children: ReactNode }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [lastSyncedTable, setLastSyncedTable] = useState<string | null>(null);
  const { toast } = useToast();
  const { user, loading } = useAuth();

  const triggerSync = useCallback(() => {
    setSyncStatus('syncing');
    setLastUpdate(Date.now());
    
    // Reset to synced after a brief delay
    setTimeout(() => {
      setSyncStatus('synced');
      setTimeout(() => setSyncStatus('idle'), 1000);
    }, 500);
  }, []);

  useEffect(() => {
    // Only establish real-time connection if user is authenticated and not loading
    if (!user || loading) {
      setIsConnected(false);
      return;
    }

    // Create a channel for all appointment-related updates
    const channel = supabase
      .channel('appointment-sync-channel')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments'
        },
        (payload) => {
          console.log('Appointments changed:', payload);
          setLastSyncedTable('appointments');
          triggerSync();
          
          // Only show toast for new appointments, not updates (to reduce notification spam)
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Appointment",
              description: "A new appointment has been created. Dashboards updated.",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointment_requests'
        },
        (payload) => {
          console.log('Appointment requests changed:', payload);
          setLastSyncedTable('appointment_requests');
          triggerSync();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expert_reports'
        },
        (payload) => {
          console.log('Expert reports changed:', payload);
          setLastSyncedTable('expert_reports');
          triggerSync();
          
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newData = payload.new as any;
            const statusChanged = payload.eventType === 'UPDATE' && 
              (payload.old as any)?.report_status !== newData.report_status;
            
            if (statusChanged) {
              toast({
                title: "Report Status Updated",
                description: `Report status changed to ${newData.report_status}. Dashboard refreshed.`,
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aod_payments'
        },
        (payload) => {
          console.log('AOD payments changed:', payload);
          setLastSyncedTable('aod_payments');
          triggerSync();
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            toast({
              title: "Payment Recorded",
              description: `AOD payment tracked. All dashboards and debt summaries updated.`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'short_term_agreement_payments'
        },
        (payload) => {
          console.log('Short-term agreement payments changed:', payload);
          setLastSyncedTable('short_term_agreement_payments');
          triggerSync();
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            toast({
              title: "Agreement Payment Recorded",
              description: "Short-term agreement payment tracked. Dashboards updated.",
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'short_term_agreements'
        },
        (payload) => {
          console.log('Short-term agreements changed:', payload);
          setLastSyncedTable('short_term_agreements');
          triggerSync();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'aod_documents'
        },
        (payload) => {
          console.log('AOD documents changed:', payload);
          setLastSyncedTable('aod_documents');
          triggerSync();
          
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            const oldData = payload.old as any;
            
            // Notify on status changes
            if (oldData?.document_status !== newData?.document_status) {
              toast({
                title: "AOD Document Updated",
                description: `Document status changed to ${newData.document_status}. Dashboard refreshed.`,
              });
            }
            
            // Notify on PDF generation
            if (newData?.document_status === 'generated' && oldData?.document_status !== 'generated') {
              toast({
                title: "AOD PDF Generated",
                description: "AOD PDF has been generated successfully.",
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'email_queue'
        },
        (payload) => {
          console.log('Email queue changed:', payload);
          setLastSyncedTable('email_queue');
          triggerSync();
          
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            if (newData?.status === 'sent') {
              toast({
                title: "Email Sent",
                description: "Email has been sent successfully.",
              });
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'audit_logs'
        },
        (payload) => {
          console.log('Audit log added:', payload);
          setLastSyncedTable('audit_logs');
          // Silent sync for audit logs - no toast
          triggerSync();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'referring_attorneys'
        },
        (payload) => {
          console.log('Referring attorneys changed:', payload);
          setLastSyncedTable('referring_attorneys');
          triggerSync();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'claimants'
        },
        (payload) => {
          console.log('Claimants changed:', payload);
          setLastSyncedTable('claimants');
          triggerSync();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'medical_experts'
        },
        (payload) => {
          console.log('Medical experts changed:', payload);
          setLastSyncedTable('medical_experts');
          triggerSync();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time sync active for all core tables');
          setSyncStatus('synced');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time sync connection error');
          setSyncStatus('error');
          // Only show error toast if user is authenticated
          if (user) {
            toast({
              title: "Sync Connection Error",
              description: "Real-time updates temporarily unavailable. Retrying...",
              variant: "destructive",
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, user, loading, triggerSync]);

  return (
    <AppointmentSyncContext.Provider value={{ lastUpdate, triggerSync, isConnected, syncStatus, lastSyncedTable }}>
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
