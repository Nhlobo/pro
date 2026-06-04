import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

export interface WorkflowAlerts {
  overdueReports: number;
  pendingAppointmentRequests: number;
  appointmentsToday: number;
  appointmentsThisWeek: number;
  outstandingInvoices: number;
  outstandingBalanceTotal: number;
  unconfirmedAppointments: number;
}

const EMPTY: WorkflowAlerts = {
  overdueReports: 0,
  pendingAppointmentRequests: 0,
  appointmentsToday: 0,
  appointmentsThisWeek: 0,
  outstandingInvoices: 0,
  outstandingBalanceTotal: 0,
  unconfirmedAppointments: 0,
};

export const useWorkflowAlerts = () => {
  const [alerts, setAlerts] = useState<WorkflowAlerts>(EMPTY);
  const [loading, setLoading] = useState(true);
  const { lastUpdate } = useAppointmentSync();

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const weekEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [overdue, pendingReq, today, week, unconfirmed, invoices] = await Promise.all([
        supabase
          .from("expert_reports")
          .select("*", { count: "exact", head: true })
          .in("report_status", [
            "pending", "not_received", "in_progress", "initial_stage",
            "Pending", "Not Received", "Initial Stage",
          ])
          .lt("created_at", thirtyDaysAgo.toISOString()),
        supabase
          .from("appointment_requests")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .gte("appointment_date", todayStart)
          .lt("appointment_date", tomorrowStart),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .gte("appointment_date", todayStart)
          .lt("appointment_date", weekEnd),
        supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .is("deleted_at", null)
          .gte("appointment_date", todayStart)
          .in("case_status", ["scheduled", "pending"]),
        supabase
          .from("epp_invoices")
          .select("outstanding_balance, payment_status")
          .neq("payment_status", "paid"),
      ]);

      const outstandingRows = (invoices.data || []) as Array<{ outstanding_balance: number | null }>;
      const total = outstandingRows.reduce((s, r) => s + (Number(r.outstanding_balance) || 0), 0);

      setAlerts({
        overdueReports: overdue.count || 0,
        pendingAppointmentRequests: pendingReq.count || 0,
        appointmentsToday: today.count || 0,
        appointmentsThisWeek: week.count || 0,
        unconfirmedAppointments: unconfirmed.count || 0,
        outstandingInvoices: outstandingRows.length,
        outstandingBalanceTotal: total,
      });
    } catch (error) {
      console.error("Error loading workflow alerts:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts, lastUpdate]);

  return { alerts, loading, refetch: fetchAlerts };
};
