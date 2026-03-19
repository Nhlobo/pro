import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";

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
  const { isPageLocked, isActiveTab } = useAppointmentSync();

  const { data: emails, isLoading, refetch } = useQuery({
    queryKey: ["email-queue", status],
    queryFn: async () => {
      let query = supabase
        .from("email_queue")
        .select("*")
        .order("created_at", { ascending: false });

      if (status === "unattended") {
        query = query.eq("is_read", false).in("status", ["sent", "pending"]);
      } else if (status === "read") {
        query = query.eq("is_read", true);
      } else if (status === "forwarded") {
        query = query.not("forwarded_to", "is", null);
      } else if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as EmailQueueItem[];
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !isPageLocked || isActiveTab,
  });

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

  const stats = {
    total: emails?.length || 0,
    unattended: emails?.filter((e) => !e.is_read).length || 0,
    read: emails?.filter((e) => e.is_read && !e.is_responded).length || 0,
    responded: emails?.filter((e) => e.is_responded).length || 0,
    forwarded: emails?.filter((e) => e.forwarded_to).length || 0,
    sent: emails?.filter((e) => e.status === "sent").length || 0,
  };

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
