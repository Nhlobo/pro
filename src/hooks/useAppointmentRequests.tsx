import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type AppointmentRequest = {
  id: string;
  referring_attorney_name: string;
  claimant_first_name: string;
  claimant_last_name: string;
  is_minor: boolean;
  guardian_name?: string;
  expert_type_requested: string;
  matter_type: string;
  special_requests: string[];
  province: string;
  preferred_date_type: string;
  suggested_date?: string;
  suggested_month?: string;
  additional_notes?: string;
  status: string;
  created_at: string;
  processed_at?: string;
  processed_by?: string;
  approval_notes?: string;
};

export const useAppointmentRequests = () => {
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch appointment requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const processRequest = async (
    requestId: string, 
    status: 'approved' | 'rejected' | 'new_date_proposed', 
    notes?: string,
    proposedDate?: string,
    confirmedAppointmentDate?: string,
    confirmedAppointmentTime?: string
  ) => {
    try {
      const updateData: any = {
        status,
        processed_at: new Date().toISOString(),
        processed_by: (await supabase.auth.getUser()).data.user?.id,
        approval_notes: notes,
        ...(proposedDate && { suggested_date: proposedDate }),
      };

      // If confirming appointment, add the confirmed date and time
      if (status === 'approved' && confirmedAppointmentDate && confirmedAppointmentTime) {
        const confirmedDateTime = `${confirmedAppointmentDate}T${confirmedAppointmentTime}`;
        updateData.confirmed_appointment_date = confirmedDateTime;
      }

      const { error } = await supabase
        .from('appointment_requests')
        .update(updateData)
        .eq('id', requestId);

      if (error) throw error;

      // Create or update response rating when processing
      if (status === 'approved' || status === 'rejected' || status === 'new_date_proposed') {
        const { error: ratingError } = await supabase
          .from('appointment_request_ratings')
          .upsert({
            appointment_request_id: requestId,
            first_response_at: new Date().toISOString(),
          }, {
            onConflict: 'appointment_request_id'
          });

        if (ratingError) {
          console.warn('Failed to create response rating:', ratingError);
        }
      }

      toast({
        title: "Success",
        description: `Request ${status === 'new_date_proposed' ? 'updated with new date proposal' : status} successfully`,
      });

      fetchRequests(); // Refresh the list
    } catch (error: any) {
      toast({
        title: "Error",
        description: `Failed to ${status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'update'} request`,
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  return {
    requests,
    loading,
    fetchRequests,
    processRequest,
  };
};