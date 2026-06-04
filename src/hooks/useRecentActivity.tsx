import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RecentActivityItem {
  id: string;
  label: string;
  createdAt: string;
  tone: "success" | "warning" | "info" | "muted";
}

const TABLE_LABELS: Record<string, string> = {
  appointments: "appointment",
  claimants: "claimant",
  expert_reports: "report",
  aod_documents: "AOD document",
  short_term_agreements: "agreement",
  medical_experts: "medical expert",
  referring_attorneys: "referring attorney",
  case_timelines: "case timeline",
};

const ACTION_VERB: Record<string, string> = {
  INSERT: "created",
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
};

const isGenericDescription = (d?: string | null) =>
  !d || /^(INSERT|CREATE|UPDATE|DELETE)\s+on\s+/i.test(d) || d.startsWith("Sensitive data");

const TONE_BY_TABLE: Record<string, RecentActivityItem["tone"]> = {
  appointments: "success",
  expert_reports: "warning",
  claimants: "info",
  aod_documents: "info",
  short_term_agreements: "info",
  medical_experts: "muted",
  referring_attorneys: "muted",
  case_timelines: "muted",
};

export const useRecentActivity = (limit = 5) => {
  const [items, setItems] = useState<RecentActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action_type, table_name, description, created_at")
        .in("table_name", Object.keys(TABLE_LABELS))
        .order("created_at", { ascending: false })
        .limit(limit);

      if (cancelled) return;
      if (error || !data) {
        setItems([]);
        setLoading(false);
        return;
      }

      setItems(
        data.map((r: any) => {
          const noun = TABLE_LABELS[r.table_name] ?? r.table_name;
          const verb = ACTION_VERB[r.action_type] ?? r.action_type?.toLowerCase() ?? "changed";
          const fallback = `${noun.charAt(0).toUpperCase() + noun.slice(1)} ${verb}`;
          return {
            id: r.id,
            label: isGenericDescription(r.description) ? fallback : r.description!,
            createdAt: r.created_at,
            tone: TONE_BY_TABLE[r.table_name] ?? "muted",
          };
        })
      );
      setLoading(false);
    };

    load();
    const channel = supabase
      .channel("recent-activity-audit")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_logs" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return { items, loading };
};
