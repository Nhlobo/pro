import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

export type SecureAssessment = {
  appointment_id: string;
  claimant_auto_id: string;
  claimant_name: string;
  expert_name: string;
  expert_type: string;
  appointment_date: string;
  deposit_amount: number;
  payment_date: string | null;
  case_status: string;
  referring_attorney: string;
  report_status: string;
  report_submitted_date: string | null;
  referring_attorney_id: string;
  service_fee: number | null;
};

export const useSecureAssessments = () => {
  const [assessments, setAssessments] = useState<SecureAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { lastUpdate } = useAppointmentSync();

  const fetchAssessments = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_scheduled_assessments_secure');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Ensure service_fee is included, default to null if not present
      const assessmentsWithServiceFee = (data || []).map((assessment: any) => ({
        ...assessment,
        service_fee: assessment.service_fee ?? null
      })) as SecureAssessment[];
      setAssessments(assessmentsWithServiceFee);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch assessments';
      setError(errorMessage);
      toast({
        title: "Access Restricted",
        description: "You can only view assessments for your law firm.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateAssessmentStatus = async (appointmentId: string, newStatus: string) => {
    try {
      const dbStatus = newStatus.toLowerCase();
      
      const { error } = await supabase
        .from('appointments')
        .update({ case_status: dbStatus })
        .eq('id', appointmentId);

      if (error) throw error;

      setAssessments(prev => prev.map(assessment => 
        assessment.appointment_id === appointmentId 
          ? { ...assessment, case_status: newStatus } 
          : assessment
      ));

      toast({
        title: "Success",
        description: "Assessment status updated successfully.",
      });

      return true;
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Failed to update assessment status.",
        variant: "destructive",
      });
      return false;
    }
  };

  const updateReportStatus = async (appointmentId: string, newReportStatus: string) => {
    try {
      const dbReportStatus = newReportStatus.toLowerCase().replace(/ /g, '_');
      
      const reportData = {
        report_status: dbReportStatus,
        report_submitted_date: ['received', 'completed'].includes(newReportStatus.toLowerCase()) 
          ? new Date().toISOString() 
          : null
      };

      // Check if expert report exists
      const { data: existingReport } = await supabase
        .from('expert_reports')
        .select('id, appointment_id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      let error;
      if (existingReport) {
        ({ error } = await supabase
          .from('expert_reports')
          .update(reportData)
          .eq('appointment_id', appointmentId));
      } else {
        // Get appointment details to create new expert report
        const assessment = assessments.find(a => a.appointment_id === appointmentId);
        if (!assessment) {
          throw new Error('Assessment not found');
        }

        // We need to get the actual expert_id and claimant_id from appointments
        const { data: appointmentData } = await supabase
          .from('appointments')
          .select('expert_id, claimant_id')
          .eq('id', appointmentId)
          .single();

        if (!appointmentData) {
          throw new Error('Appointment data not found');
        }

        ({ error } = await supabase
          .from('expert_reports')
          .insert([{
            appointment_id: appointmentId,
            expert_id: appointmentData.expert_id,
            claimant_id: appointmentData.claimant_id,
            ...reportData
          }]));
      }

      if (error) throw error;

      setAssessments(prev => prev.map(assessment => 
        assessment.appointment_id === appointmentId 
          ? { 
              ...assessment, 
              report_status: newReportStatus,
              report_submitted_date: ['received', 'completed'].includes(newReportStatus.toLowerCase())
                ? new Date().toISOString()
                : null
            } 
          : assessment
      ));

      toast({
        title: "Success",
        description: "Report status updated successfully.",
      });

      return true;
    } catch (error) {
      console.error('Error updating report status:', error);
      toast({
        title: "Error",
        description: "Failed to update report status.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    fetchAssessments();
  }, [lastUpdate]);

  return {
    assessments,
    loading,
    error,
    refetch: fetchAssessments,
    updateAssessmentStatus,
    updateReportStatus,
  };
};