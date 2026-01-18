import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

export type ShortTermAgreement = {
  id: string;
  referring_attorney_id: string;
  created_by: string;
  agreement_method: "email" | "telephone" | "both";
  agreement_reference?: string;
  contract_description?: string;
  contract_start_date: string;
  contract_end_date: string;
  total_contract_value?: number;
  deposit_amount?: number;
  payment_plan_structure?: string;
  payment_status: "pending" | "partial" | "paid" | "overdue";
  interest_rate_1_3_months?: number;
  interest_rate_6_months?: number;
  interest_rate_12_months?: number;
  total_reports_agreed?: number;
  reports_completed?: number;
  payments_made?: number;
  next_payment_date?: string;
  last_payment_date?: string;
  notes?: string;
  status: "active" | "completed" | "cancelled" | "expired";
  document_url?: string;
  file_name?: string;
  created_at: string;
  updated_at: string;
};

export const useShortTermAgreements = (lawFirmId?: string) => {
  const [agreements, setAgreements] = useState<ShortTermAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const { isPageLocked, isActiveTab } = useAppointmentSync();
  const initialFetchDone = useRef(false);

  const fetchAgreements = async () => {
    // Don't refetch if page is locked (user is actively working)
    if (isPageLocked && initialFetchDone.current) {
      console.log('ShortTermAgreements: Page locked, skipping refresh');
      return;
    }
    
    try {
      setLoading(true);
      let query = supabase
        .from("short_term_agreements")
        .select("*")
        .order("created_at", { ascending: false });

      if (lawFirmId) {
        query = query.eq("referring_attorney_id", lawFirmId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch referring attorneys to filter out system companies
      const { data: attorneys } = await supabase
        .from("referring_attorneys")
        .select("id, is_system_company")
        .eq("is_system_company", true);

      const systemCompanyIds = new Set(attorneys?.map(a => a.id) || []);
      
      // Filter out agreements belonging to system companies
      const filteredData = (data || []).filter(
        (agreement) => !systemCompanyIds.has(agreement.referring_attorney_id)
      );
      
      setAgreements(filteredData as ShortTermAgreement[]);
      initialFetchDone.current = true;
    } catch (error: any) {
      console.error("Error fetching agreements:", error);
      toast.error("Failed to load agreements");
    } finally {
      setLoading(false);
    }
  };

  const createAgreement = async (agreementData: Partial<ShortTermAgreement>) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Check for existing agreement in the same month for the same attorney
      if (agreementData.contract_start_date && agreementData.referring_attorney_id) {
        const startDate = new Date(agreementData.contract_start_date);
        const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1).toISOString().split('T')[0];
        const monthEnd = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).toISOString().split('T')[0];

        const { data: existing, error: checkError } = await supabase
          .from("short_term_agreements")
          .select("*")
          .eq("referring_attorney_id", agreementData.referring_attorney_id)
          .gte("contract_start_date", monthStart)
          .lte("contract_start_date", monthEnd)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking for existing agreement:", checkError);
        }

        if (existing) {
          // Update existing agreement instead of creating a new one
          const updatedValue = (existing.total_contract_value || 0) + (agreementData.total_contract_value || 0);
          const updatedDeposit = (existing.deposit_amount || 0) + (agreementData.deposit_amount || 0);
          const updatedReports = (existing.total_reports_agreed || 0) + (agreementData.total_reports_agreed || 1);

          const { data, error } = await supabase
            .from("short_term_agreements")
            .update({
              total_contract_value: updatedValue,
              deposit_amount: updatedDeposit,
              total_reports_agreed: updatedReports,
              payment_status: updatedDeposit >= updatedValue ? 'paid' : existing.payment_status,
              notes: `${existing.notes || ''}\n${agreementData.notes || ''}`.trim(),
            })
            .eq("id", existing.id)
            .select()
            .single();

          if (error) throw error;

          toast.success("Short-term agreement updated successfully");
          await fetchAgreements();
          return data;
        }
      }

      // Create new agreement if no existing one found
      const { data, error } = await supabase
        .from("short_term_agreements")
        .insert([{
          ...agreementData,
          created_by: userData.user.id,
        } as any])
        .select()
        .single();

      if (error) throw error;

      toast.success("Short-term agreement created successfully");
      await fetchAgreements();
      return data;
    } catch (error: any) {
      console.error("Error creating agreement:", error);
      toast.error(error.message || "Failed to create agreement");
      throw error;
    }
  };

  const updateAgreement = async (id: string, updates: Partial<ShortTermAgreement>) => {
    try {
      const { error } = await supabase
        .from("short_term_agreements")
        .update(updates)
        .eq("id", id);

      if (error) throw error;

      toast.success("Agreement updated successfully");
      await fetchAgreements();
    } catch (error: any) {
      console.error("Error updating agreement:", error);
      toast.error("Failed to update agreement");
      throw error;
    }
  };

  const deleteAgreement = async (id: string) => {
    try {
      const { error } = await supabase
        .from("short_term_agreements")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Agreement deleted successfully");
      await fetchAgreements();
    } catch (error: any) {
      console.error("Error deleting agreement:", error);
      toast.error("Failed to delete agreement");
      throw error;
    }
  };

  useEffect(() => {
    // Only fetch on initial load or when tab becomes active and not locked
    if (!initialFetchDone.current || (isActiveTab && !isPageLocked)) {
      fetchAgreements();
    }
  }, [isActiveTab, isPageLocked]); // Respect page lock state

  return {
    agreements,
    loading,
    createAgreement,
    updateAgreement,
    deleteAgreement,
    refetch: fetchAgreements,
  };
};
