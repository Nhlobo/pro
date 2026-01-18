import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

// Get sync context with page lock awareness

export type ReportStage = 
  | "initial_stage"
  | "preparation_in_progress"
  | "proof_reading"
  | "finalized_awaiting_final_payment"
  | "finalized_awaiting_payment"
  | "report_delivered"
  | "report_delivered_aod"
  | "submitted_without_payment"
  | "submitted_without_full_payment"
  | "report_submitted";

export type ExpertReportTracking = {
  id: string;
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
  report_stage: ReportStage;
  report_submitted_date: string | null;
  stage_updated_date: string | null;
  stage_notes: string | null;
  referring_attorney_id: string;
  created_at: string;
  updated_at: string;
};

export const REPORT_STAGES: { value: ReportStage; label: string; color: string }[] = [
  { value: "initial_stage", label: "Initial Stage", color: "bg-gray-100 text-gray-800" },
  { value: "preparation_in_progress", label: "Preparation in Progress", color: "bg-blue-100 text-blue-800" },
  { value: "proof_reading", label: "Proof Reading Stage", color: "bg-yellow-100 text-yellow-800" },
  { value: "finalized_awaiting_final_payment", label: "Finalized Awaiting Final Payment", color: "bg-purple-100 text-purple-800" },
  { value: "finalized_awaiting_payment", label: "Report Finalized Awaiting Payment", color: "bg-orange-100 text-orange-800" },
  { value: "report_delivered", label: "Report Delivered", color: "bg-green-100 text-green-800" },
  { value: "report_delivered_aod", label: "Report Delivered on AOD", color: "bg-teal-100 text-teal-800" },
  { value: "submitted_without_payment", label: "Report Submitted without Payment", color: "bg-red-100 text-red-800" },
  { value: "submitted_without_full_payment", label: "Report Submitted without Full Payment", color: "bg-pink-100 text-pink-800" },
  { value: "report_submitted", label: "Report Submitted", color: "bg-emerald-100 text-emerald-800" },
];

export const useExpertReportTracking = () => {
  const [reports, setReports] = useState<ExpertReportTracking[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentUpdates, setRecentUpdates] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { lastUpdate, isActiveTab, isPageLocked } = useAppointmentSync();

  const fetchReportTracking = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error: fetchError } = await supabase
        .rpc('get_scheduled_assessments_secure');

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Fetch additional report tracking data
      const appointmentIds = data?.map(item => item.appointment_id) || [];
      const { data: expertReports, error: reportsError } = await supabase
        .from('expert_reports')
        .select(`
          id,
          appointment_id,
          report_status,
          report_submitted_date,
          payment_date,
          created_at,
          updated_at,
          notes
        `)
        .in('appointment_id', appointmentIds);

      if (reportsError) {
        console.error('Expert reports fetch error:', reportsError);
      }

      // Combine data with default report stage
      const combinedData: ExpertReportTracking[] = data?.map(assessment => {
        const expertReport = expertReports?.find(report => report.appointment_id === assessment.appointment_id);
        
        // Check if this appointment was recently updated manually - if so, preserve current state
        const wasRecentlyUpdated = recentUpdates.has(assessment.appointment_id);
        if (wasRecentlyUpdated) {
          const currentReport = reports.find(r => r.appointment_id === assessment.appointment_id);
          if (currentReport) {
            return currentReport; // Keep the manually updated version
          }
        }
        
        // Determine report stage based on current report_status
        let reportStage: ReportStage = "initial_stage";
        if (assessment.report_status) {
          switch (assessment.report_status.toLowerCase()) {
            case 'in_progress':
            case 'pending':
              reportStage = "preparation_in_progress";
              break;
            case 'under_review':
              reportStage = "proof_reading";
              break;
            case 'completed':
            case 'received':
              reportStage = "report_submitted";
              break;
            default:
              reportStage = "initial_stage";
          }
        }

        return {
          id: expertReport?.id || `temp-${assessment.appointment_id}`,
          appointment_id: assessment.appointment_id,
          claimant_auto_id: assessment.claimant_auto_id,
          claimant_name: assessment.claimant_name,
          expert_name: assessment.expert_name,
          expert_type: assessment.expert_type,
          appointment_date: assessment.appointment_date,
          deposit_amount: assessment.deposit_amount,
          payment_date: assessment.payment_date,
          case_status: assessment.case_status,
          referring_attorney: assessment.referring_attorney,
          report_status: assessment.report_status,
          report_stage: reportStage,
          report_submitted_date: assessment.report_submitted_date,
          stage_updated_date: expertReport?.updated_at || null,
          stage_notes: expertReport?.notes || null,
          referring_attorney_id: assessment.referring_attorney_id,
          created_at: expertReport?.created_at || new Date().toISOString(),
          updated_at: expertReport?.updated_at || new Date().toISOString(),
        };
      }) || [];

      setReports(combinedData);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch report tracking data';
      setError(errorMessage);
      toast({
        title: "Access Restricted",
        description: "You can only view reports for your referring attorney.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateReportStage = async (
    appointmentId: string, 
    newStage: ReportStage, 
    notes?: string
  ) => {
    try {
      setLoading(true);
      
      // Find and store original report data for potential rollback
      const originalReport = reports.find(r => r.appointment_id === appointmentId);
      
      if (!originalReport) {
        throw new Error('Report not found for update');
      }
      
      // Mark this appointment as recently updated to prevent fetch override
      setRecentUpdates(prev => new Set([...prev, appointmentId]));
      
      // Clear the recent update flag after 5 seconds
      setTimeout(() => {
        setRecentUpdates(prev => {
          const newSet = new Set(prev);
          newSet.delete(appointmentId);
          return newSet;
        });
      }, 5000);
      
      // Perform optimistic update
      const updatedTimestamp = new Date().toISOString();
      setReports(prev => prev.map(report => 
        report.appointment_id === appointmentId 
          ? { 
              ...report, 
              report_stage: newStage,
              report_status: newStage.replace(/_/g, ' '),
              stage_updated_date: updatedTimestamp,
              stage_notes: notes || report.stage_notes,
              updated_at: updatedTimestamp
            } 
          : report
      ));

      // Check if expert report exists in database
      const { data: existingReport } = await supabase
        .from('expert_reports')
        .select('id, appointment_id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      const reportData = {
        report_status: newStage.replace(/_/g, ' '),
        notes: notes || null,
        updated_at: updatedTimestamp
      };

      let error;
      if (existingReport) {
        // Update existing expert report
        ({ error } = await supabase
          .from('expert_reports')
          .update(reportData)
          .eq('appointment_id', appointmentId));
      } else {
        // Create new expert report - get appointment data
        const { data: appointmentData, error: appointmentError } = await supabase
          .from('appointments')
          .select('expert_id, claimant_id')
          .eq('id', appointmentId)
          .maybeSingle();

        if (appointmentError) {
          throw new Error(`Failed to fetch appointment: ${appointmentError.message}`);
        }

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

      if (error) {
        console.error('Database update failed:', error);
        // Rollback to original state
        setReports(prev => prev.map(report => 
          report.appointment_id === appointmentId ? originalReport : report
        ));
        throw new Error(`Database update failed: ${error.message}`);
      }

      toast({
        title: "Success",
        description: "Report stage updated successfully.",
      });

      return true;
    } catch (error) {
      console.error('Error updating report stage:', error);
      toast({
        title: "Error",
        description: "Failed to update report stage. Changes have been reverted.",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Only refetch when lastUpdate changes AND tab is active AND page is NOT locked
  useEffect(() => {
    if (isActiveTab && !isPageLocked) {
      fetchReportTracking();
    }
  }, [lastUpdate, isActiveTab, isPageLocked]);

  return {
    reports,
    loading,
    error,
    refetch: fetchReportTracking,
    updateReportStage,
  };
};