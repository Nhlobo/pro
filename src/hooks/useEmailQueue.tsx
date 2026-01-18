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

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as EmailQueueItem[];
    },
    // Disable auto-refetch when page is locked
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !isPageLocked || isActiveTab,
  });

  const approveMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { data, error } = await supabase
        .from("email_queue")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", emailId)
        .select()
        .single();

      if (error) throw error;

      // Trigger send email function
      const { error: sendError } = await supabase.functions.invoke("send-queued-email", {
        body: { emailId },
      });

      if (sendError) throw sendError;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-queue"] });
      toast.success("Email approved and sent successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to approve email: ${error.message}`);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const { data, error } = await supabase
        .from("email_queue")
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq("id", emailId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-queue"] });
      toast.success("Email rejected");
    },
    onError: (error: any) => {
      toast.error(`Failed to reject email: ${error.message}`);
    },
  });

  return {
    emails,
    isLoading,
    approveEmail: approveMutation.mutate,
    rejectEmail: rejectMutation.mutate,
    isApproving: approveMutation.isPending,
    isRejecting: rejectMutation.isPending,
    refetch,
  };
};
