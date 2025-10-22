import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ShortTermAgreement = {
  id: string;
  attorney_id: string;
  law_firm_id: string;
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

  const fetchAgreements = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("short_term_agreements")
        .select("*")
        .order("created_at", { ascending: false });

      if (lawFirmId) {
        query = query.eq("law_firm_id", lawFirmId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAgreements((data || []) as ShortTermAgreement[]);
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
    fetchAgreements();
  }, [lawFirmId]);

  return {
    agreements,
    loading,
    createAgreement,
    updateAgreement,
    deleteAgreement,
    refetch: fetchAgreements,
  };
};
