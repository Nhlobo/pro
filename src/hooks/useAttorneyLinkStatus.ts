import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type AttorneyLinkStatus = 'checking' | 'linked' | 'not_linked';

/**
 * Resolves whether the signed-in attorney account is linked to a firm's
 * referrals (profiles.referring_attorney_id) before any page-specific
 * data fetch runs. Every Attorney Portal page that needs this check
 * reads the SAME status here and renders its "not linked" state on the
 * very first paint when it's not — never the real page first and then a
 * bounce back once the check resolves.
 */
export const useAttorneyLinkStatus = (): AttorneyLinkStatus => {
  const { user } = useAuth();
  const [status, setStatus] = useState<AttorneyLinkStatus>('checking');

  useEffect(() => {
    let cancelled = false;
    if (!user) return;

    // A failed query here (expired/refreshing JWT right after the tab
    // regains focus, a dropped connection, etc.) must NEVER be treated the
    // same as "no referring_attorney_id" — that's what was making a
    // perfectly-linked attorney see the "Firm Not Linked / Get Help" page
    // whenever the check happened to race Supabase's background token
    // refresh, only for a manual refresh to "fix" it once the refresh had
    // caught up. Retry transient errors instead of guessing, and never
    // downgrade an already-resolved status because of one.
    const check = async (attempt = 0): Promise<void> => {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();

      if (cancelled) return;

      if (error) {
        if (attempt < 2) {
          setTimeout(() => { if (!cancelled) check(attempt + 1); }, 500 * (attempt + 1));
        }
        // Leave the current status alone (e.g. 'checking', or a prior
        // 'linked' from before the tab was backgrounded) rather than
        // reporting 'not_linked' off the back of an error.
        return;
      }

      setStatus(profile?.referring_attorney_id ? 'linked' : 'not_linked');
    };

    check();
    return () => { cancelled = true; };
  }, [user]);

  return status;
};

export default useAttorneyLinkStatus;
