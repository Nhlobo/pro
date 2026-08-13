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
    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      setStatus(profile?.referring_attorney_id ? 'linked' : 'not_linked');
    })();
    return () => { cancelled = true; };
  }, [user]);

  return status;
};

export default useAttorneyLinkStatus;
