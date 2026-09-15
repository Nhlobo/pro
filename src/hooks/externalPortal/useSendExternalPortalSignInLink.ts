import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * External Portal Module — "Send Sign-In Link" feature.
 *
 * Thin wrapper around the `external-portal-admin-links` edge function's
 * `send_signin_link` action (same function useGenerateExternalPortalLink
 * calls for one-time registration links) — the admin-only check, account
 * validation, email dispatch, and audit log all live server-side there.
 * Unlike generate_link, this action:
 *  - is restricted to callers with the `admin` role specifically (not
 *    employee/sales_consultant), enforced server-side
 *  - never mints a token — it emails the plain, tokenless sign-in URL
 *  - never accepts an email override — it only ever goes to the
 *    account's own email on file
 */

export interface SendSignInLinkResult {
  link_url: string;
  email_sent: boolean;
  sent_to_email: string;
}

export function useSendExternalPortalSignInLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId }: { accountId: string }): Promise<SendSignInLinkResult> => {
      const { data, error } = await supabase.functions.invoke('external-portal-admin-links', {
        body: { action: 'send_signin_link', account_id: accountId },
      });

      if (error) {
        const ctx = (error as any)?.context;
        if (ctx?.json) {
          const parsed = await ctx.json().catch(() => null);
          throw new Error(parsed?.error || error.message);
        }
        throw new Error(error.message);
      }
      if (data?.success === false) throw new Error(data.error || 'Failed to send sign-in link');

      return data.data as SendSignInLinkResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      toast.success(data.email_sent ? `Sign-in link emailed to ${data.sent_to_email}` : 'Could not confirm the email was sent — check RESEND_API_KEY');
    },
    onError: (error: any) => toast.error(error?.message || 'Failed to send sign-in link'),
  });
}
