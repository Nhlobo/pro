import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface EmailQueueItem {
  id: string;
  email_type: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  html_content: string;
  metadata: any;
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
  const { data: allEmails, isLoading, refetch } = useQuery({
    queryKey: ["email-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_queue")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as EmailQueueItem[];
    },
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: 30_000,
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

  const stats = useMemo(() => ({
    total: allEmails?.length || 0,
    unattended: allEmails?.filter((e) => !e.is_read).length || 0,
    read: allEmails?.filter((e) => e.is_read && !e.is_responded).length || 0,
    responded: allEmails?.filter((e) => e.is_responded).length || 0,
    forwarded: allEmails?.filter((e) => e.forwarded_to).length || 0,
    sent: allEmails?.filter((e) => e.status === "sent").length || 0,
    failed: allEmails?.filter((e) => (e.status as string) === "failed").length || 0,
  }), [allEmails]);

  return {
    emails,
    isLoading,
    stats,
    markAsRead: markAsReadMutation.mutate,
    markAsResponded: markAsRespondedMutation.mutate,
    forwardEmail: forwardEmailMutation.mutate,
    isForwarding: forwardEmailMutation.isPending,
    refetch,
  };
};
