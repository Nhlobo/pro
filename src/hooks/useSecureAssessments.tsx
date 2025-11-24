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
        description: "You can only view assessments for your referring attorney.",
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

      // Update local state immediately for instant UI feedback
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

      // Refetch to ensure data consistency
      await fetchAssessments();

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

  const updatePaymentInfo = async (
    appointmentId: string, 
    depositAmount: number, 
    paymentDate?: string
  ) => {
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

      // Sync with AOD if there's a payment difference
      if (paymentDifference !== 0 && appointment.referring_attorney_id) {
        // Find active AOD document for this attorney
        const { data: aodDoc } = await supabase
          .from('aod_documents')
          .select('id, total_contract_value, payments_made, payment_status')
          .eq('referring_attorney_id', appointment.referring_attorney_id)
          .in('payment_status', ['pending', 'partial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (aodDoc) {
          // Create AOD payment record
          await supabase
            .from('aod_payments')
            .insert({
              aod_document_id: aodDoc.id,
              payment_amount: Math.abs(paymentDifference),
              payment_date: paymentDate || new Date().toISOString(),
              payment_type: paymentDifference > 0 ? 'deposit' : 'refund',
              payment_notes: `Auto-synced from appointment payment update`,
              reports_taken_out: paymentDifference > 0 ? 1 : 0,
            });

          // Update AOD document
          const newPaymentsMade = (aodDoc.payments_made || 0) + paymentDifference;
          const totalValue = aodDoc.total_contract_value || 0;
          let aodPaymentStatus = 'pending';
          if (newPaymentsMade > 0) {
            aodPaymentStatus = newPaymentsMade >= totalValue ? 'paid' : 'partial';
          }

          await supabase
            .from('aod_documents')
            .update({
              payments_made: newPaymentsMade,
              payment_status: aodPaymentStatus,
              last_payment_date: new Date().toISOString(),
            })
            .eq('id', aodDoc.id);
        }
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

      // Refetch to ensure consistency across all systems
      await fetchAssessments();

      toast({
        title: "Success",
        description: "Payment updated and synced across all systems.",
      });

      return true;
    } catch (error) {
      console.error('Error updating payment info:', error);
      toast({
        title: "Error",
        description: "Failed to update payment information.",
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
    updatePaymentInfo,
  };
};