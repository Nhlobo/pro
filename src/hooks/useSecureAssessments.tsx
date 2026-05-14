import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import { useAuditTrail } from "@/hooks/useAuditTrail";
import { syncAppointmentPaymentToAgreements } from "@/hooks/usePaymentSync";

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
  assessment_code: string | null;
  report_notes: string | null;
  sales_consultant_name: string | null;
};

export interface SaveStatus {
  status: 'idle' | 'saving' | 'saved' | 'error';
  lastSaved: Date | null;
  error: string | null;
}

export const useSecureAssessments = () => {
  const [assessments, setAssessments] = useState<SecureAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({
    status: 'idle',
    lastSaved: null,
    error: null
  });
  const { toast } = useToast();
  const { lastUpdate, triggerSync, isActiveTab, isPageLocked } = useAppointmentSync();
  const { logAuditTrail } = useAuditTrail();
  const initialFetchDone = useRef(false);

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
      const assessmentsWithDefaults = (data || []).map((assessment: any) => ({
        ...assessment,
        service_fee: assessment.service_fee ?? null,
        assessment_code: assessment.assessment_code ?? null,
        report_notes: assessment.report_notes ?? null,
        sales_consultant_name: assessment.sales_consultant_name ?? null
      })) as SecureAssessment[];
      setAssessments(assessmentsWithDefaults);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch assessments';
      console.error('Error fetching assessments:', errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const updateAssessmentStatus = useCallback(async (appointmentId: string, newStatus: string) => {
    setSaveStatus({ status: 'saving', lastSaved: null, error: null });

    try {
      const { updateAppointmentCaseStatus } = await import('@/utils/supabaseTypedHelpers');

      // Get current assessment for audit trail
      const currentAssessment = assessments.find(a => a.appointment_id === appointmentId);
      const oldStatus = currentAssessment?.case_status || 'unknown';

      const result = await updateAppointmentCaseStatus(appointmentId, newStatus);
      if (!result.ok) {
        throw new Error((result as { ok: false; error: string }).error);
      }
      const { dbStatus, uiStatus } = result.data;

      // Log to audit trail
      await logAuditTrail(
        'appointments',
        appointmentId,
        'UPDATE',
        'assessment',
        { case_status: oldStatus },
        { case_status: uiStatus },
        `Status changed from "${oldStatus}" to "${uiStatus}"`
      );

      setAssessments(prev => prev.map(assessment =>
        assessment.appointment_id === appointmentId
          ? { ...assessment, case_status: dbStatus }
          : assessment
      ));

      setSaveStatus({
        status: 'saved',
        lastSaved: new Date(),
        error: null
      });

      // Trigger global sync for real-time updates (force broadcast - user-initiated save)
      triggerSync(false, true);
      window.dispatchEvent(new CustomEvent('assessment-status-updated', { detail: { appointmentId, newStatus: dbStatus } }));

      toast({
        title: "Saved successfully",
        description: `Status updated to "${uiStatus}" at ${new Date().toLocaleTimeString()}`,
      });

      return true;
    } catch (err: any) {
      console.error('Error updating status:', err);
      setSaveStatus({ 
        status: 'error', 
        lastSaved: null, 
        error: err.message 
      });
      toast({
        title: "Error",
        description: "Failed to update assessment status. Changes not saved.",
        variant: "destructive",
      });
      return false;
    }
  }, [assessments, logAuditTrail, triggerSync, toast]);

  const updateReportStatus = useCallback(async (appointmentId: string, newReportStatus: string) => {
    setSaveStatus({ status: 'saving', lastSaved: null, error: null });
    
    try {
      const dbReportStatus = newReportStatus.toLowerCase().replace(/ /g, '_');
      
      // Get current assessment for audit trail
      const currentAssessment = assessments.find(a => a.appointment_id === appointmentId);
      const oldReportStatus = currentAssessment?.report_status || 'unknown';
      
      // Statuses that indicate report is submitted/completed - these should get a timestamp
      const submittedStatuses = [
        'received', 
        'completed', 
        'report_submitted', 
        'report_fully_paid_&_submitted',
        'report fully paid & submitted',
        'report_submitted_on_aod',
        'report submitted on aod',
        'report_submitted_without_full_payment',
        'report submitted without full payment'
      ];
      
      const isSubmittedStatus = submittedStatuses.some(status => 
        newReportStatus.toLowerCase().includes(status.replace(/_/g, ' ')) ||
        dbReportStatus.includes(status.replace(/ /g, '_'))
      );
      
      const reportData = {
        report_status: dbReportStatus,
        report_submitted_date: isSubmittedStatus ? new Date().toISOString() : null
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

        const { data: appointment } = await supabase
          .from('appointments')
          .select('claimant_id, expert_id')
          .eq('id', appointmentId)
          .single();

        if (!appointment) {
          throw new Error('Appointment details not found');
        }

        ({ error } = await supabase
          .from('expert_reports')
          .insert({
            appointment_id: appointmentId,
            claimant_id: appointment.claimant_id,
            expert_id: appointment.expert_id,
            ...reportData
          }));
      }

      if (error) throw error;

      // Log to audit trail
      await logAuditTrail(
        'expert_reports',
        appointmentId,
        existingReport ? 'UPDATE' : 'CREATE',
        'assessment',
        { report_status: oldReportStatus },
        { report_status: newReportStatus },
        `Report status changed from "${oldReportStatus}" to "${newReportStatus}"`
      );

      // Update local state immediately for instant UI feedback
      setAssessments(prev => prev.map(assessment => 
        assessment.appointment_id === appointmentId 
          ? { 
              ...assessment, 
              report_status: newReportStatus,
              report_submitted_date: isSubmittedStatus ? new Date().toISOString() : null
            } 
          : assessment
      ));

      setSaveStatus({ 
        status: 'saved', 
        lastSaved: new Date(), 
        error: null 
      });

      // Trigger global sync for real-time updates (force broadcast - user-initiated save)
      triggerSync(false, true);
      window.dispatchEvent(new CustomEvent('report-status-updated', { detail: { appointmentId, newReportStatus } }));

      // Refetch to ensure data consistency
      await fetchAssessments();

      toast({
        title: "Saved successfully",
        description: `Report status updated at ${new Date().toLocaleTimeString()}`,
      });

      return true;
    } catch (err: any) {
      console.error('Error updating report status:', err);
      setSaveStatus({ 
        status: 'error', 
        lastSaved: null, 
        error: err.message 
      });
      toast({
        title: "Error",
        description: "Failed to update report status. Changes not saved.",
        variant: "destructive",
      });
      return false;
    }
  }, [assessments, logAuditTrail, triggerSync, toast, fetchAssessments]);

  const updatePaymentInfo = useCallback(async (
    appointmentId: string, 
    depositAmount: number, 
    paymentDate?: string
  ) => {
    setSaveStatus({ status: 'saving', lastSaved: null, error: null });
    
    try {
      // Get appointment details first
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select('id, service_fee, deposit_amount, referring_attorney_id, payment_status')
        .eq('id', appointmentId)
        .single();

      if (fetchError) throw fetchError;

      const serviceFee = appointment.service_fee || 0;
      const oldDeposit = appointment.deposit_amount || 0;
      const paymentDifference = depositAmount - oldDeposit;

      // Calculate new payment status
      let newPaymentStatus = 'pending';
      if (depositAmount > 0) {
        newPaymentStatus = depositAmount >= serviceFee ? 'full_payment' : 'deposit';
      }

      const updateData: any = {
        deposit_amount: depositAmount,
        payment_status: newPaymentStatus,
        payment_date: paymentDate || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Update appointment
      const { error } = await supabase
        .from('appointments')
        .update(updateData)
        .eq('id', appointmentId);

      if (error) throw error;

      // Log to audit trail
      await logAuditTrail(
        'appointments',
        appointmentId,
        'UPDATE',
        'assessment',
        { deposit_amount: oldDeposit, payment_status: appointment.payment_status },
        { deposit_amount: depositAmount, payment_status: newPaymentStatus },
        `Payment updated: R${oldDeposit.toFixed(2)} → R${depositAmount.toFixed(2)}`
      );

      // Sync with AOD and Short-term agreements bidirectionally
      if (paymentDifference !== 0 && appointment.referring_attorney_id) {
        const syncResults = await syncAppointmentPaymentToAgreements(
          appointmentId,
          appointment.referring_attorney_id,
          paymentDifference,
          paymentDate || new Date().toISOString()
        );
        console.log('Payment sync results:', syncResults);
      }

      // Update local state immediately
      setAssessments(prev => prev.map(assessment => 
        assessment.appointment_id === appointmentId 
          ? { 
              ...assessment, 
              deposit_amount: depositAmount,
              payment_date: paymentDate || assessment.payment_date
            } 
          : assessment
      ));

      setSaveStatus({ 
        status: 'saved', 
        lastSaved: new Date(), 
        error: null 
      });

      // Trigger global sync for real-time updates
      triggerSync();

      // Refetch to ensure consistency across all systems
      await fetchAssessments();

      toast({
        title: "Saved successfully",
        description: `Payment updated and synced at ${new Date().toLocaleTimeString()}`,
      });

      return true;
    } catch (err: any) {
      console.error('Error updating payment info:', err);
      setSaveStatus({ 
        status: 'error', 
        lastSaved: null, 
        error: err.message 
      });
      toast({
        title: "Error",
        description: "Failed to update payment information. Changes not saved.",
        variant: "destructive",
      });
      return false;
    }
  }, [logAuditTrail, triggerSync, toast, fetchAssessments]);

  const updateReportNotes = useCallback(async (appointmentId: string, notes: string) => {
    setSaveStatus({ status: 'saving', lastSaved: null, error: null });
    
    try {
      // Check if expert report exists
      const { data: existingReport } = await supabase
        .from('expert_reports')
        .select('id')
        .eq('appointment_id', appointmentId)
        .maybeSingle();

      let error;
      if (existingReport) {
        ({ error } = await supabase
          .from('expert_reports')
          .update({ notes, updated_at: new Date().toISOString() })
          .eq('appointment_id', appointmentId));
      } else {
        // Create expert report record with notes
        const assessment = assessments.find(a => a.appointment_id === appointmentId);
        if (!assessment) throw new Error('Assessment not found');

        const { data: appointment } = await supabase
          .from('appointments')
          .select('claimant_id, expert_id')
          .eq('id', appointmentId)
          .single();

        if (!appointment) throw new Error('Appointment details not found');

        ({ error } = await supabase
          .from('expert_reports')
          .insert({
            appointment_id: appointmentId,
            claimant_id: appointment.claimant_id,
            expert_id: appointment.expert_id,
            notes,
            report_status: 'not_received'
          }));
      }

      if (error) throw error;

      // Update local state
      setAssessments(prev => prev.map(a => 
        a.appointment_id === appointmentId ? { ...a, report_notes: notes } : a
      ));

      setSaveStatus({ status: 'saved', lastSaved: new Date(), error: null });
      triggerSync();

      toast({
        title: "Comments saved",
        description: `Comments updated at ${new Date().toLocaleTimeString()}`,
      });

      return true;
    } catch (err: any) {
      console.error('Error updating comments:', err);
      setSaveStatus({ status: 'error', lastSaved: null, error: err.message });
      toast({
        title: "Error",
        description: "Failed to save comments.",
        variant: "destructive",
      });
      return false;
    }
  }, [assessments, triggerSync, toast]);

  const updateSalesConsultant = useCallback(async (appointmentId: string, salesConsultantId: string | null) => {
    setSaveStatus({ status: 'saving', lastSaved: null, error: null });
    
    try {
      const currentAssessment = assessments.find(a => a.appointment_id === appointmentId);
      const oldName = currentAssessment?.sales_consultant_name || 'unassigned';

      const { error } = await supabase
        .from('appointments')
        .update({ 
          sales_consultant_id: salesConsultantId,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;

      await logAuditTrail(
        'appointments',
        appointmentId,
        'UPDATE',
        'assessment',
        { sales_consultant_id: oldName },
        { sales_consultant_id: salesConsultantId },
        `Sales consultant changed from "${oldName}"`
      );

      // Auto-attribute deal to pitchlog for sales reports & performance tracking
      if (salesConsultantId && currentAssessment) {
        try {
          // Get consultant name
          const { data: consultantData } = await supabase
            .from('sales_consultants')
            .select('name')
            .eq('id', salesConsultantId)
            .single();

          if (consultantData) {
            const raId = currentAssessment.referring_attorney_id;
            const consultantName = consultantData.name;

            // Check if a pitchlog entry already exists for this attorney by this consultant
            const { data: existingEntry } = await supabase
              .from('attorney_pitchlog')
              .select('id')
              .eq('matched_referring_attorney_id', raId)
              .eq('sales_person', consultantName)
              .limit(1)
              .maybeSingle();

            if (!existingEntry) {
              // Get referring attorney details
              const { data: raDetails } = await supabase
                .from('referring_attorneys')
                .select('name, contact_person, province, email, phone')
                .eq('id', raId)
                .single();

              const apptDate = currentAssessment.appointment_date 
                ? new Date(currentAssessment.appointment_date) 
                : new Date();
              const monthYear = `${apptDate.getFullYear()}-${String(apptDate.getMonth() + 1).padStart(2, '0')}`;

              await supabase.from('attorney_pitchlog').insert({
                law_firm_name: raDetails?.name || currentAssessment.referring_attorney,
                sales_person: consultantName,
                contact_person: raDetails?.contact_person || currentAssessment.referring_attorney,
                province: raDetails?.province || 'Unknown',
                email: raDetails?.email || null,
                telephone: raDetails?.phone || null,
                practice_area: 'RAF',
                attorney_type: 'Plaintiff',
                pitch_status: 'Pitched',
                month_year: monthYear,
                deal_closed: true,
                deal_closed_date: apptDate.toISOString().split('T')[0],
                matched_referring_attorney_id: raId,
                comment: `Auto-attributed from scheduled assessment`,
              });
            }
          }
        } catch (pitchlogErr) {
          console.error('Non-critical: failed to sync pitchlog entry:', pitchlogErr);
        }
      }

      setSaveStatus({ status: 'saved', lastSaved: new Date(), error: null });
      triggerSync();
      await fetchAssessments();

      toast({
        title: "Saved successfully",
        description: `Sales consultant updated at ${new Date().toLocaleTimeString()}`,
      });

      return true;
    } catch (err: any) {
      console.error('Error updating sales consultant:', err);
      setSaveStatus({ status: 'error', lastSaved: null, error: err.message });
      toast({
        title: "Error",
        description: "Failed to update sales consultant.",
        variant: "destructive",
      });
      return false;
    }
  }, [assessments, logAuditTrail, triggerSync, toast, fetchAssessments]);

  useEffect(() => {
    if (!initialFetchDone.current) {
      fetchAssessments();
      initialFetchDone.current = true;
    } else if (isActiveTab && !isPageLocked) {
      fetchAssessments();
    }
  }, [lastUpdate, isActiveTab, isPageLocked]);

  return {
    assessments,
    loading,
    error,
    saveStatus,
    refetch: fetchAssessments,
    updateAssessmentStatus,
    updateReportStatus,
    updatePaymentInfo,
    updateReportNotes,
    updateSalesConsultant,
  };
};