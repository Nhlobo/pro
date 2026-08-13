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
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('expert_id')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      setStatus(profile?.expert_id ? 'linked' : 'not_linked');
    })();
    return () => { cancelled = true; };
  }, [user]);

  return status;
};

export default useExpertLinkStatus;
