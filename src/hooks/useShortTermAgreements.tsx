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
  items?: ShortTermAgreementItem[];
  payments?: ShortTermAgreementPayment[];
  total_payments_amount?: number;
};

export type ShortTermAgreementItem = {
  appointment_id: string;
  claimant_id?: string | null;
  claimant_name?: string | null;
  appointment_date?: string | null;
  service_fee?: number | null;
  deposit_amount?: number | null;
  payment_status?: string | null;
  matter_type?: string | null;
  expert_id?: string | null;
};

export type ShortTermAgreementPayment = {
  id: string;
  agreement_id: string;
  payment_date: string;
  payment_amount: number;
  payment_type?: string | null;
  reports_taken_out?: number | null;
  payment_notes?: string | null;
  created_at?: string;
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

      // Resolve all system-company attorney IDs once. We use this to (a) hide
      // their agreements from the list and (b) treat a lawFirmId that points
      // to a system company (admin/employee fallback) as "view all".
      const { data: systemAttorneys } = await supabase
        .from("referring_attorneys")
        .select("id")
        .eq("is_system_company", true);
      const systemCompanyIds = new Set((systemAttorneys || []).map((a) => a.id));

      const scopeToFirm = !!lawFirmId && !systemCompanyIds.has(lawFirmId);

      let query = supabase
        .from("short_term_agreements")
        .select("*")
        .order("created_at", { ascending: false });

      if (scopeToFirm) {
        query = query.eq("referring_attorney_id", lawFirmId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Filter out agreements belonging to system companies
      const filteredData = (data || []).filter(
        (agreement) => !systemCompanyIds.has(agreement.referring_attorney_id)
      );

      const agreementIds = filteredData.map((a) => a.id);

      // Fetch all payments for these agreements in one go
      let paymentsByAgreement: Record<string, ShortTermAgreementPayment[]> = {};
      if (agreementIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("short_term_agreement_payments")
          .select("*")
          .in("agreement_id", agreementIds)
          .order("payment_date", { ascending: false });

        if (paymentsError) {
          console.warn("Error fetching short-term payments:", paymentsError);
        } else {
          for (const p of paymentsData || []) {
            (paymentsByAgreement[p.agreement_id] ||= []).push(p as ShortTermAgreementPayment);
          }
        }
      }

      // Parse APPOINTMENT:<id> markers from agreement notes to derive items
      const appointmentIdRe = /APPOINTMENT:([0-9a-f-]{36})/gi;
      const itemsByAgreement: Record<string, ShortTermAgreementItem[]> = {};
      const allAppointmentIds = new Set<string>();
      const agreementToApptIds: Record<string, string[]> = {};

      for (const ag of filteredData) {
        const ids: string[] = [];
        const notes = ag.notes || "";
        let m: RegExpExecArray | null;
        while ((m = appointmentIdRe.exec(notes)) !== null) {
          ids.push(m[1]);
          allAppointmentIds.add(m[1]);
        }
        agreementToApptIds[ag.id] = Array.from(new Set(ids));
      }

      if (allAppointmentIds.size > 0) {
        const { data: appts, error: apptsError } = await supabase
          .from("appointments")
          .select(
            "id, claimant_id, appointment_date, service_fee, deposit_amount, payment_status, matter_type, expert_id, claimants(first_name, last_name)"
          )
          .in("id", Array.from(allAppointmentIds));

        if (apptsError) {
          console.warn("Error fetching appointment items:", apptsError);
        } else {
          const apptMap: Record<string, any> = {};
          for (const a of appts || []) apptMap[a.id] = a;

          for (const [agId, ids] of Object.entries(agreementToApptIds)) {
            itemsByAgreement[agId] = ids
              .map((aid) => {
                const a = apptMap[aid];
                if (!a) return null;
                const c = a.claimants;
                return {
                  appointment_id: a.id,
                  claimant_id: a.claimant_id,
                  claimant_name: c
                    ? `${c.first_name || ""} ${c.last_name || ""}`.trim() || null
                    : null,
                  appointment_date: a.appointment_date,
                  service_fee: a.service_fee,
                  deposit_amount: a.deposit_amount,
                  payment_status: a.payment_status,
                  matter_type: a.matter_type,
                  expert_id: a.expert_id,
                } as ShortTermAgreementItem;
              })
              .filter(Boolean) as ShortTermAgreementItem[];
          }
        }
      }

      const enriched = filteredData.map((a) => {
        const payments = paymentsByAgreement[a.id] || [];
        return {
          ...a,
          items: itemsByAgreement[a.id] || [],
          payments,
          total_payments_amount: payments.reduce(
            (sum, p) => sum + (Number(p.payment_amount) || 0),
            0
          ),
        };
      });

      setAgreements(enriched as ShortTermAgreement[]);
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

      // Real-time recalc from linked appointments
      try {
        const { data: ag } = await supabase
          .from("short_term_agreements")
          .select("referring_attorney_id")
          .eq("id", id)
          .single();
        if (ag?.referring_attorney_id) {
          const { recalculateShortTermFromAppointments } = await import("@/hooks/usePaymentSync");
          await recalculateShortTermFromAppointments(id, ag.referring_attorney_id);
        }
      } catch (e) {
        console.warn("Short-term recalc after update failed (non-fatal)", e);
      }

      toast.success("Agreement updated successfully");
      await fetchAgreements();
      window.dispatchEvent(new CustomEvent("agreement-data-updated"));
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
