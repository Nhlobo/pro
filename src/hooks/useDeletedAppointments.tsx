import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type DeletedAppointment = {
  id: string;
  appointment_date: string;
  referring_attorney: string;
  matter_type: string;
  case_status: string;
  service_fee: number;
  deposit_amount: number;
  deleted_at: string;
  deleted_by: string;
  claimant_name: string;
  claimant_auto_id: string;
  expert_name: string;
  expert_type: string;
  deleted_by_email: string;
  law_firm_id: string;
};

export const useDeletedAppointments = () => {
  const [deletedAppointments, setDeletedAppointments] = useState<DeletedAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDeletedAppointments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deleted_appointments_view')
        .select('*')
        .order('deleted_at', { ascending: false });

      if (error) throw error;
      setDeletedAppointments(data || []);
    } catch (error: any) {
      console.error('Error fetching deleted appointments:', error);
      toast({
        title: "Error",
        description: "Failed to fetch deleted appointments",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const restoreAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase.functions.invoke('restore-deleted-appointment', {
        body: { appointmentId }
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Appointment restored successfully",
      });

      // Refresh the list
      await fetchDeletedAppointments();
      
      return true;
    } catch (error: any) {
      console.error('Error restoring appointment:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to restore appointment",
        variant: "destructive",
      });
      return false;
    }
  };

  const permanentlyDelete = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Appointment permanently deleted",
      });

      // Refresh the list
      await fetchDeletedAppointments();
      
      return true;
    } catch (error: any) {
      console.error('Error permanently deleting appointment:', error);
      toast({
        title: "Error",
        description: "Failed to permanently delete appointment",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchDeletedAppointments();
  }, []);

  return {
    deletedAppointments,
    loading,
    fetchDeletedAppointments,
    restoreAppointment,
    permanentlyDelete,
  };
};
