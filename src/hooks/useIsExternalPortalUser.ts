import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * True only for a session created by the external-portal-auth login
 * bridge (a referring attorney or medical expert signing in via
 * link+OTP instead of a staff password). Never true for a real staff
 * account. Used to hide staff-only UI (like internal chat) inside the
 * unmodified /attorney-portal and /expert-portal pages — it does not
 * affect data access, which is still governed entirely by
 * referring_attorney_id / expert_id + RLS, exactly as before.
 */
export function useIsExternalPortalUser(): boolean {
  const { user } = useAuth();
  const [isExternal, setIsExternal] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsExternal(false);
      return;
    }
    let cancelled = false;
    supabase
      .from('profiles')
      .select('is_external_portal_user')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsExternal(!!data?.is_external_portal_user);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isExternal;
}
