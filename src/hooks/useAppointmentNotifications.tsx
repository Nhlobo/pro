import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Calendar, Clock, MapPin } from 'lucide-react';

export const useAppointmentNotifications = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { isAdmin, isReferringAttorney } = usePermissions();
  const channelRef = useRef<any>(null);

  useEffect(() => {
    if (!user) return;

    // Only admins and staff should receive appointment request notifications
    if (!isAdmin() && !isReferringAttorney()) return;

    // Set up real-time subscription for appointment requests
    const channel = supabase
      .channel('appointment-requests-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointment_requests'
        },
        (payload) => {
          const newRequest = payload.new as any;
          
          // Show notification for new appointment request
          toast({
            title: "🔔 New Appointment Request",
            description: (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-kutlwano-blue" />
                  <span className="font-medium">
                    {newRequest.claimant_first_name} {newRequest.claimant_last_name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-kutlwano-teal" />
                  <span className="text-sm text-muted-foreground">
                    {newRequest.expert_type_requested} • {newRequest.matter_type}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-kutlwano-blue" />
                  <span className="text-sm text-muted-foreground">
                    {newRequest.province}
                  </span>
                </div>
              </div>
            ),
            duration: 8000,
            className: "border-kutlwano-blue/20 bg-gradient-card"
          });

          // Play notification sound (optional)
          try {
            const audio = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmMeAjyX2/LNeSsFJHjA8N2QQAoUXrTp66hUFApGnt/yv2MeAzyX2/LNeSsFJHjA8N2QQAoUXrTp66hUFApGnt/yv2MeAzyX2/LNeSsFJHjA8N2QQAoUXrTp66hUFApGnt/yv2Ee");
            audio.volume = 0.1;
            audio.play().catch(() => {
              // Ignore audio errors (autoplay restrictions)
            });
          } catch (error) {
            // Ignore audio errors
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointment_requests'
        },
        (payload) => {
          const oldRequest = payload.old as any;
          const newRequest = payload.new as any;
          
          // Notify when status changes
          if (oldRequest.status !== newRequest.status && newRequest.status === 'approved') {
            toast({
              title: "✅ Appointment Request Approved",
              description: (
                <div className="space-y-1">
                  <div className="font-medium">
                    {newRequest.claimant_first_name} {newRequest.claimant_last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Assessment scheduled for {newRequest.expert_type_requested}
                  </div>
                </div>
              ),
              duration: 5000,
              className: "border-green-500/20 bg-green-50 dark:bg-green-950/20"
            });
          } else if (oldRequest.status !== newRequest.status && newRequest.status === 'rejected') {
            toast({
              title: "❌ Appointment Request Rejected",
              description: (
                <div className="space-y-1">
                  <div className="font-medium">
                    {newRequest.claimant_first_name} {newRequest.claimant_last_name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Request has been declined
                  </div>
                </div>
              ),
              duration: 5000,
              className: "border-red-500/20 bg-red-50 dark:bg-red-950/20"
            });
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup subscription on unmount
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [user, isAdmin, isReferringAttorney, toast]);

  return null;
};