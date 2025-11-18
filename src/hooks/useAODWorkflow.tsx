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

      // Create AOD document
      const { data: aod, error } = await supabase
        .from('aod_documents')
        .insert({
          referring_attorney_id: params.referringAttorneyId,
          uploaded_by: userData.user.id,
          file_name: `AOD_Draft_${Date.now()}.pdf`,
          document_url: '', // Will be updated after finalization
          contract_start_date: startDate.toISOString().split('T')[0],
          contract_end_date: endDate.toISOString().split('T')[0],
          payment_due_date: paymentDueDate.toISOString().split('T')[0],
          total_contract_value: params.serviceFee,
          deposit_amount: params.depositAmount,
          payment_plan_structure: paymentPlanStructure,
          payment_status: 'pending',
          contract_description: `AOD for ${params.paymentTerms} - ${params.agreementDurationMonths} months`,
          notes: `Auto-generated from appointment. Payment terms: ${params.paymentTerms}`
        })
        .select()
        .single();

      if (error) throw error;

      setAodId(aod.id);
      toast.success("AOD document created - ready for review");
      
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
