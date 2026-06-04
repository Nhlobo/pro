import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RecentActivityItem {
  id: string;
  label: string;
  createdAt: string;
  relativeTime: string;
  tone: "success" | "warning" | "info" | "muted";
}

const TABLE_LABELS: Record<string, string> = {
  appointments: "appointment",
  claimants: "claimant",
  expert_reports: "report",
  aod_documents: "AOD document",
  short_term_agreements: "short-term agreement",
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

// Action + table specific friendly phrasing
const FRIENDLY_LABEL: Record<string, Record<string, string>> = {
  appointments: {
    CREATE: "New appointment scheduled",
    INSERT: "New appointment scheduled",
    UPDATE: "Appointment details updated",
    DELETE: "Appointment cancelled",
  },
  claimants: {
    CREATE: "New claimant added",
    INSERT: "New claimant added",
    UPDATE: "Claimant details updated",
    DELETE: "Claimant record removed",
  },
  expert_reports: {
    CREATE: "New report created",
    INSERT: "New report created",
    UPDATE: "Report status updated",
    DELETE: "Report removed",
  },
  aod_documents: {
    CREATE: "New AOD document issued",
    INSERT: "New AOD document issued",
    UPDATE: "AOD document updated",
    DELETE: "AOD document removed",
  },
  short_term_agreements: {
    CREATE: "New short-term agreement created",
    INSERT: "New short-term agreement created",
    UPDATE: "Short-term agreement updated",
    DELETE: "Short-term agreement removed",
  },
  medical_experts: {
    CREATE: "New medical expert added",
    INSERT: "New medical expert added",
    UPDATE: "Medical expert profile updated",
    DELETE: "Medical expert removed",
  },
  referring_attorneys: {
    CREATE: "New referring attorney added",
    INSERT: "New referring attorney added",
    UPDATE: "Referring attorney updated",
    DELETE: "Referring attorney removed",
  },
  case_timelines: {
    CREATE: "Case timeline entry added",
    INSERT: "Case timeline entry added",
    UPDATE: "Case timeline updated",
    DELETE: "Case timeline entry removed",
  },
};

const isGenericDescription = (d?: string | null) =>
  !d ||
  /^(INSERT|CREATE|UPDATE|DELETE)\s+on\s+/i.test(d) ||
  d.startsWith("Sensitive data");

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

const formatRelative = (iso: string) => {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min${min === 1 ? "" : "s"} ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? "" : "s"} ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    day: "2-digit",
    month: "short",
  });
};

const buildLabel = (table: string, action: string, description?: string | null) => {
  if (!isGenericDescription(description)) return description!.trim();
  const friendly = FRIENDLY_LABEL[table]?.[action?.toUpperCase()];
  if (friendly) return friendly;
  const noun = TABLE_LABELS[table] ?? table.replace(/_/g, " ");
  const verb = ACTION_VERB[action] ?? action?.toLowerCase() ?? "changed";
  return `${noun.charAt(0).toUpperCase() + noun.slice(1)} ${verb}`;
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
        data.map((r: any) => ({
          id: r.id,
          label: buildLabel(r.table_name, r.action_type, r.description),
          createdAt: r.created_at,
          relativeTime: formatRelative(r.created_at),
          tone: TONE_BY_TABLE[r.table_name] ?? "muted",
        }))
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "audit_logs" },
        () => load()
      )
      .subscribe();

    // Refresh relative timestamps every 60s
    const tick = setInterval(() => {
      setItems((prev) =>
        prev.map((i) => ({ ...i, relativeTime: formatRelative(i.createdAt) }))
      );
    }, 60_000);

    return () => {
      cancelled = true;
      clearInterval(tick);
      supabase.removeChannel(channel);
    };
  }, [limit]);

  return { items, loading };
};
