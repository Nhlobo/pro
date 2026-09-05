import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type ExpertLinkStatus = 'checking' | 'linked' | 'not_linked';

/**
 * Resolves whether the signed-in account is linked to a medical expert
 * profile (profiles.expert_id) before any page-specific data fetch runs.
 * Every Expert Portal page that needs this check reads the SAME status
 * here and renders its "not linked" state on the very first paint when
 * it's not — never the real page first and then a bounce back once the
 * check resolves.
 *
 * Mirrors useAttorneyLinkStatus so both portals check the account the
 * same way, in the same order, before showing the error page.
 */
export const useExpertLinkStatus = (): ExpertLinkStatus => {
  const { user } = useAuth();
  const [status, setStatus] = useState<ExpertLinkStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    // A failed query here (expired/refreshing JWT right after the tab
    // regains focus, a dropped connection, etc.) must NEVER be treated the
    // same as "no expert_id" — that's what was making a perfectly-linked
    // expert see the "Profile Not Linked / Get Help" page whenever the
    // check happened to race Supabase's background token refresh, only for
    // a manual refresh to "fix" it once the refresh had caught up. Retry
    // transient errors instead of guessing, and never downgrade an
    // already-resolved status because of one. Mirrors useAttorneyLinkStatus.
    const check = async (attempt = 0): Promise<void> => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('expert_id')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      if (error) {
        if (attempt < 2) {
          setTimeout(() => { if (!cancelled) check(attempt + 1); }, 500 * (attempt + 1));
        }
        return;
      }

      setStatus(profile?.expert_id ? 'linked' : 'not_linked');
    };

    check();
    return () => { cancelled = true; };
  }, [user]);

  return status;
};

export default useExpertLinkStatus;
