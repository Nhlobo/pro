import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ExternalPortalOtpCode } from '@/types/externalPortal';

export interface ExternalPortalOtpRow extends ExternalPortalOtpCode {
  account_full_name: string;
  account_email: string;
}

export function useExternalPortalOtpCodes() {
  return useQuery({
    queryKey: ['external-portal', 'otp-codes'],
    queryFn: async (): Promise<ExternalPortalOtpRow[]> => {
      const { data, error } = await supabase
        .from('external_portal_otp_codes' as any)
        .select('*, account:account_id(full_name, email)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      return ((data || []) as any[]).map((row) => ({
        ...row,
        account_full_name: row.account?.full_name || '—',
        account_email: row.account?.email || '—',
      }));
    },
    staleTime: 15_000,
  });
}

export function otpStatus(row: ExternalPortalOtpCode): 'verified' | 'expired' | 'locked' | 'pending' {
  if (row.verified_at) return 'verified';
  if (new Date(row.expires_at).getTime() <= Date.now()) return 'expired';
  if (row.attempts >= row.max_attempts) return 'locked';
  return 'pending';
}
