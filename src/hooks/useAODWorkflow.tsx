import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateAODParams {
  referringAttorneyId: string;
  appointmentId?: string;
  paymentTerms: string;
  serviceFee: number;
  depositAmount: number;
  agreementDurationMonths: number;
  appointmentDate: string;
  discountAmount?: number;
  discountRate?: number;
  discountType?: string;
}

export const useAODWorkflow = () => {
  const [creating, setCreating] = useState(false);
  const [aodId, setAodId] = useState<string | null>(null);

  const createAODFromAppointment = async (params: CreateAODParams) => {
    setCreating(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Calculate contract dates
      const startDate = new Date(params.appointmentDate);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + params.agreementDurationMonths);

      // Get month boundaries for checking existing AOD
      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).toISOString().split('T')[0];

      // Check for existing AOD in the same month for the same attorney
      const { data: existing, error: checkError } = await supabase
        .from('aod_documents')
        .select('*')
        .eq('referring_attorney_id', params.referringAttorneyId)
        .gte('contract_start_date', monthStart)
        .lte('contract_start_date', monthEnd)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking for existing AOD:", checkError);
      }

      let aod;

      if (existing) {
        // Update existing AOD document
        const updatedValue = (existing.total_contract_value || 0) + params.serviceFee;
        const updatedDeposit = (existing.deposit_amount || 0) + params.depositAmount;
        const updatedReports = (existing.total_reports_agreed || 0) + 1;
        const appointmentNote = params.appointmentId 
          ? `\nAppointment ID: ${params.appointmentId} (R${params.serviceFee.toFixed(2)}, Deposit: R${params.depositAmount.toFixed(2)})`
          : `\nAssessment (R${params.serviceFee.toFixed(2)}, Deposit: R${params.depositAmount.toFixed(2)})`;

        const { data: updated, error } = await supabase
          .from('aod_documents')
          .update({
            total_contract_value: updatedValue,
            deposit_amount: updatedDeposit,
            total_reports_agreed: updatedReports,
            payment_status: updatedDeposit >= updatedValue ? 'paid' : existing.payment_status,
            notes: `${existing.notes || ''}${appointmentNote}`,
            contract_description: `AOD for ${startDate.getMonth() + 1}/${startDate.getFullYear()} (${updatedReports} assessments)`,
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;

        aod = updated;
        setAodId(updated.id);
        toast.success("AOD document updated - ready for review");
      } else {
        // Calculate payment due date (typically at end of contract)
        const paymentDueDate = new Date(endDate);

        // Determine payment plan structure based on duration
        let paymentPlanStructure = "";
        if (params.agreementDurationMonths <= 3) {
          paymentPlanStructure = "Single payment due at end of 3-month period";
        } else if (params.agreementDurationMonths <= 6) {
          paymentPlanStructure = "Quarterly payments over 6-month period";
        } else if (params.agreementDurationMonths <= 12) {
          paymentPlanStructure = "Quarterly payments over 12-month period";
        }

        const appointmentNote = params.appointmentId 
          ? `Appointment ID: ${params.appointmentId} (R${params.serviceFee.toFixed(2)}, Deposit: R${params.depositAmount.toFixed(2)})`
          : `Assessment (R${params.serviceFee.toFixed(2)}, Deposit: R${params.depositAmount.toFixed(2)})`;

        // Create new AOD document
        const { data: created, error } = await supabase
          .from('aod_documents')
          .insert({
            referring_attorney_id: params.referringAttorneyId,
            uploaded_by: userData.user.id,
            file_name: `AOD_${startDate.getFullYear()}_${String(startDate.getMonth() + 1).padStart(2, '0')}_${params.referringAttorneyId}.pdf`,
            document_url: '',
            contract_start_date: startDate.toISOString().split('T')[0],
            contract_end_date: endDate.toISOString().split('T')[0],
            payment_due_date: paymentDueDate.toISOString().split('T')[0],
            total_contract_value: params.serviceFee,
            deposit_amount: params.depositAmount,
            total_reports_agreed: 1,
            payment_plan_structure: paymentPlanStructure,
            payment_status: 'pending',
            contract_description: `AOD for ${startDate.getMonth() + 1}/${startDate.getFullYear()}`,
            notes: `Auto-generated monthly AOD - ${startDate.getMonth() + 1}/${startDate.getFullYear()}\n${appointmentNote}`
          })
          .select()
          .single();

        if (error) throw error;

        aod = created;
        setAodId(created.id);
        toast.success("AOD document created - ready for review");
      }
      
      return aod.id;
    } catch (error: any) {
      console.error("Error creating AOD:", error);
      toast.error(error.message || "Failed to create AOD");
      throw error;
    } finally {
      setCreating(false);
    }
  };

  const finalizeAOD = async (aodId: string, documentUrl: string) => {
    try {
      const { error } = await supabase
        .from('aod_documents')
        .update({
          document_url: documentUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', aodId);

      if (error) throw error;

      toast.success("AOD finalized successfully");
    } catch (error: any) {
      console.error("Error finalizing AOD:", error);
      toast.error(error.message || "Failed to finalize AOD");
      throw error;
    }
  };

  return {
    creating,
    aodId,
    createAODFromAppointment,
    finalizeAOD
  };
};
