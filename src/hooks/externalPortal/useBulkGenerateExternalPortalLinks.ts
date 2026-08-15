import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Bulk activation-link sender.
 *
 * Deliberately thin: it calls the exact same `external-portal-admin-links`
 * edge function (action: "generate_link") that the single-account button
 * on this page uses, in a simple sequential loop. No new backend code,
 * no service role key, no bypassing the admin-only check or the audit
 * log — this is the same one-account operation the admin UI has always
 * supported, just run N times with live progress instead of once.
 *
 * Sequential (not Promise.all) on purpose: it's gentle on the email
 * provider and gives the UI a meaningful "3 of 47…" progress readout
 * instead of a spinner with no signal for a minute or two.
 */

export type BulkLinkResultStatus = 'pending' | 'sent' | 'failed';

export interface BulkLinkTarget {
  id: string;
  full_name: string;
  email: string;
  portal_type: string;
}

export interface BulkLinkResult extends BulkLinkTarget {
  status: BulkLinkResultStatus;
  error?: string;
}

const DELAY_MS_BETWEEN_SENDS = 350;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateOne(accountId: string): Promise<{ success: boolean; email_sent?: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('external-portal-admin-links', {
    body: { action: 'generate_link', account_id: accountId, send_email: true },
  });

  if (error) {
    const ctx = (error as any)?.context;
    if (ctx?.json) {
      const parsed = await ctx.json().catch(() => null);
      return { success: false, error: parsed?.error || error.message };
    }
    return { success: false, error: error.message };
  }
  if (data?.success === false) return { success: false, error: data.error || 'Failed to generate link' };
  return { success: true, email_sent: data?.data?.email_sent };
}

export function useBulkGenerateExternalPortalLinks() {
  const queryClient = useQueryClient();
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BulkLinkResult[]>([]);
  const cancelRef = useRef(false);

  const run = useCallback(
    async (targets: BulkLinkTarget[]) => {
      if (isRunning || targets.length === 0) return;

      cancelRef.current = false;
      setIsRunning(true);
      setResults(targets.map((t) => ({ ...t, status: 'pending' as const })));

      for (let i = 0; i < targets.length; i++) {
        if (cancelRef.current) break;

        const target = targets[i];
        const outcome = await generateOne(target.id);

        setResults((prev) =>
          prev.map((r) =>
            r.id === target.id
              ? {
                  ...r,
                  status: outcome.success && outcome.email_sent !== false ? 'sent' : 'failed',
                  error: !outcome.success
                    ? outcome.error
                    : outcome.email_sent === false
                      ? 'Link created but email not sent — check RESEND_API_KEY'
                      : undefined,
                }
              : r
          )
        );

        if (i < targets.length - 1) await sleep(DELAY_MS_BETWEEN_SENDS);
      }

      queryClient.invalidateQueries({ queryKey: ['external-portal', 'links'] });
      queryClient.invalidateQueries({ queryKey: ['external-portal', 'accounts'] });
      setIsRunning(false);
    },
    [isRunning, queryClient]
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setResults([]);
  }, []);

  const sentCount = results.filter((r) => r.status === 'sent').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const pendingCount = results.filter((r) => r.status === 'pending').length;

  return { isRunning, results, run, cancel, reset, sentCount, failedCount, pendingCount };
}
