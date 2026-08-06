import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Columns for the list/table view. Deliberately excludes html_content and
// metadata — the body is tens of KB per row and metadata is unbounded JSON.
// Neither is needed by the table; both are pulled on demand for the single
// email open in the preview panel (see useEmailBody below). Fetching them
// for 500 rows on every poll is what made this page hang and never settle.
const LIST_COLUMNS =
  "id, email_type, recipient_email, recipient_name, subject, status, related_record_id, related_table, created_at, reviewed_at, reviewed_by, sent_at, error_message, is_read, read_at, read_by, is_responded, responded_at, responded_by, forwarded_to, forwarded_at, forwarded_by, forward_notes";

// Hard ceiling on how long any one queue request may stay in flight before
// it is aborted and surfaced as an error. Without this a stalled request
// leaves the page on "Loading email history…" forever with every stat on 0.
const REQUEST_TIMEOUT_MS = 20_000;

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(new Error("Request timed out")), ms);
  return controller.signal;
}


export interface EmailQueueListItem {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  /** Not part of the list payload — populated only for the previewed email. */
  metadata?: any;

  status: "pending" | "approved" | "sent" | "rejected";
  related_record_id: string | null;
  related_table: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  sent_at: string | null;
  error_message: string | null;
  is_read: boolean;
  read_at: string | null;
  read_by: string | null;
  is_responded: boolean;
  responded_at: string | null;
  responded_by: string | null;
  forwarded_to: string | null;
  forwarded_at: string | null;
  forwarded_by: string | null;
  forward_notes: string | null;
}

// Full row, including the html_content body — only fetched for the one
// email currently open in the preview panel, never for the list.
export interface EmailQueueItem extends EmailQueueListItem {
  html_content: string;
}

// Hard cap on how many queue rows the list view will ever pull in one go.
// The table has no natural bound (every appointment/assessment/payment
// email logs a row), so an uncapped query is a standing timeout risk as
// volume grows. 500 is generous for "recent history" while keeping the
// payload predictable; older items are still in the DB, just not loaded
// into this view. If a real archive/search-back need shows up, that's a
// server-side date-range or search query, not raising this number.
const LIST_ROW_CAP = 500;

export const useEmailQueue = (status?: string) => {
  const queryClient = useQueryClient();

  // One stable query for the whole queue — tab filtering happens client-side
  // below (see `emails`), so switching tabs is instant instead of firing a
  // brand-new Supabase request per tab and showing a "0 0" flash while it's
  // in flight.
  //
  // Note: email_queue is intentionally NOT part of the AppointmentSync
  // realtime channel (it was removed from the realtime publication to avoid
  // broadcasting email payloads), so this query does not gate itself on that
  // context's lock/active-tab state — doing so previously could strand the
  // fetch in a disabled state (stats stuck at 0, list stuck empty). Instead
  // it fetches on mount and polls lightly so the page stays in sync on its
  // own, in addition to the manual Refresh button.
  const { data: allEmails, isLoading, error, refetch } = useQuery({
    queryKey: ["email-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_queue")
        .select(LIST_COLUMNS)
        .order("created_at", { ascending: false })
        .range(0, LIST_ROW_CAP - 1)
        .abortSignal(timeoutSignal(REQUEST_TIMEOUT_MS));

      if (error) throw error;
      return (data ?? []) as unknown as EmailQueueListItem[];
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 60_000,
    // A stalled or failing request must settle into the visible error state
    // rather than retrying behind an endless spinner.
    retry: 1,
    retryDelay: 1500,
  });

  // Lightweight exact counts for the stat cards, computed server-side with
  // count-only queries (head: true → no rows transferred) instead of being
  // derived from the capped `allEmails` array, which would under-report
  // once the queue exceeds LIST_ROW_CAP. These are best-effort: if a count
  // fails the stats fall back to the loaded page (see `stats` below) so the
  // page still renders real numbers instead of zeros.
  const { data: totalCount } = useQuery({
    queryKey: ["email-queue-count", "total"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("email_queue")
        .select("id", { count: "exact", head: true })
        .abortSignal(timeoutSignal(REQUEST_TIMEOUT_MS));
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
    retry: 1,
  });

  const { data: unattendedCount } = useQuery({
    queryKey: ["email-queue-count", "unattended"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("email_queue")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false)
        .abortSignal(timeoutSignal(REQUEST_TIMEOUT_MS));
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
    retry: 1,
  });


  const emails = useMemo(() => {
    if (!allEmails) return allEmails;
    if (status === "unattended") return allEmails.filter((e) => !e.is_read && ["sent", "pending"].includes(e.status));
    if (status === "read") return allEmails.filter((e) => e.is_read);
    if (status === "forwarded") return allEmails.filter((e) => !!e.forwarded_to);
    if (status && status !== "all") return allEmails.filter((e) => e.status === status);
    return allEmails;
  }, [allEmails, status]);

  const markAsReadMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase
        .from("email_queue")
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
          read_by: userId,
        } as any)
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-queue"] });
      toast.success("Email marked as read");
    },
    onError: (error: any) => toast.error(`Failed: ${error.message}`),
  });

  const markAsRespondedMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase
        .from("email_queue")
        .update({
          is_responded: true,
          responded_at: new Date().toISOString(),
          responded_by: userId,
          is_read: true,
          read_at: new Date().toISOString(),
          read_by: userId,
        } as any)
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-queue"] });
      toast.success("Email marked as responded");
    },
    onError: (error: any) => toast.error(`Failed: ${error.message}`),
  });

  const forwardEmailMutation = useMutation({
    mutationFn: async ({ emailId, forwardTo, notes }: { emailId: string; forwardTo: string; notes?: string }) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase
        .from("email_queue")
        .update({
          forwarded_to: forwardTo,
          forwarded_at: new Date().toISOString(),
          forwarded_by: userId,
          forward_notes: notes || null,
          is_read: true,
          read_at: new Date().toISOString(),
          read_by: userId,
        } as any)
        .eq("id", emailId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-queue"] });
      toast.success("Email forwarded successfully");
    },
    onError: (error: any) => toast.error(`Failed to forward: ${error.message}`),
  });

  // total/unattended come from the exact server-side counts above so they
  // stay correct even once the queue passes LIST_ROW_CAP; the rest are
  // derived from the loaded page since they're informational breakdowns,
  // not the headline "is anything stuck" numbers.
  const stats = useMemo(() => ({
    total: totalCount ?? allEmails?.length ?? 0,
    unattended: unattendedCount ?? allEmails?.filter((e) => !e.is_read).length ?? 0,
    read: allEmails?.filter((e) => e.is_read && !e.is_responded).length || 0,
    responded: allEmails?.filter((e) => e.is_responded).length || 0,
    forwarded: allEmails?.filter((e) => e.forwarded_to).length || 0,
    sent: allEmails?.filter((e) => e.status === "sent").length || 0,
    failed: allEmails?.filter((e) => (e.status as string) === "failed").length || 0,
  }), [allEmails, totalCount, unattendedCount]);

  return {
    emails,
    isLoading,
    error,
    stats,
    markAsRead: markAsReadMutation.mutate,
    markAsResponded: markAsRespondedMutation.mutate,
    forwardEmail: forwardEmailMutation.mutate,
    isForwarding: forwardEmailMutation.isPending,
    refetch,
  };
};

// Fetches the fields the list intentionally leaves out — html_content and
// metadata — for a single email, only when its preview panel is opened.
export const useEmailBody = (emailId: string | null) => {
  return useQuery({
    queryKey: ["email-queue-body", emailId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_queue")
        .select("id, html_content, metadata")
        .eq("id", emailId as string)
        .abortSignal(timeoutSignal(REQUEST_TIMEOUT_MS))
        .single();
      if (error) throw error;
      return data as { id: string; html_content: string; metadata: any };
    },

    enabled: !!emailId,
    staleTime: 5 * 60 * 1000,
  });
};
