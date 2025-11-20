import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

  const triggerSync = () => {
    setLastUpdate(Date.now());
  };

  useEffect(() => {
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
          
          // Show toast for significant changes
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Appointment",
              description: "A new appointment has been created. Dashboards updated.",
            });
          } else if (payload.eventType === 'UPDATE') {
            toast({
              title: "Appointment Updated",
              description: "An appointment has been modified. Dashboards refreshed.",
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
          
          if (payload.eventType === 'UPDATE') {
            const newData = payload.new as any;
            if (newData.report_status === 'completed' || newData.report_status === 'taken_out') {
              toast({
                title: "Report Status Updated",
                description: "A report status has been updated. Dashboards refreshed.",
              });
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Real-time sync active for appointments, requests, and reports');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Real-time sync connection error');
          toast({
            title: "Sync Connection Error",
            description: "Real-time updates temporarily unavailable.",
            variant: "destructive",
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

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
