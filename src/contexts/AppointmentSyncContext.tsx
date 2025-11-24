import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AppointmentSyncContextType {
  lastUpdate: number;
  triggerSync: () => void;
  isConnected: boolean;
}

const AppointmentSyncContext = createContext<AppointmentSyncContextType | undefined>(undefined);

export const AppointmentSyncProvider = ({ children }: { children: ReactNode }) => {
  const [lastUpdate, setLastUpdate] = useState(Date.now());
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const { user, loading } = useAuth();

  const triggerSync = () => {
    setLastUpdate(Date.now());
  };

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
          triggerSync();
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
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
          triggerSync();
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time sync active for appointments, requests, reports, and AOD data');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time sync connection error');
          // Only show error toast if user is authenticated
          if (user) {
            toast({
              title: "Sync Connection Error",
              description: "Real-time updates temporarily unavailable.",
              variant: "destructive",
            });
          }
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, user, loading]);

  return (
    <AppointmentSyncContext.Provider value={{ lastUpdate, triggerSync, isConnected }}>
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
