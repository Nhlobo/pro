import { useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';

/**
 * Dual-mode identity for the OLD External Portal (/attorney-portal and
 * /expert-portal), which is once again the ACTIVE portal wired to the
 * External Portal Management page.
 *
 * Two ways to be inside these portals:
 *  1. Staff / role-based Supabase auth session (the original behaviour —
 *     referring_attorney / medical_expert / admin preview). MFA and
 *     permission checks apply exactly as before.
 *  2. An External Portal Module session (opaque OTP / secure-access-link
 *     token issued by external-portal-auth and managed from the External
 *     Portal Management page). These users have no auth.users row, so
 *     Supabase-side MFA/permission checks do not apply to them — their
 *     authorization boundary is server-side per session, per call.
 *
 * No backend, database or edge-function behaviour is changed here.
 */
export function usePortalIdentity() {
  const { user, signOut } = useAuth();
  const { session: externalSession, clearSession } = useExternalPortalSession();

  const isExternalSession = !!externalSession && !user;

  const displayName =
    (isExternalSession ? externalSession?.full_name || externalSession?.email : user?.email) || '';

  const signOutPortal = useCallback(async () => {
    if (isExternalSession) {
      await clearSession();
      window.location.href = '/external-portal/sign-in';
      return;
    }
    await signOut();
  }, [isExternalSession, clearSession, signOut]);

  return {
    user,
    externalSession,
    isExternalSession,
    portalType: externalSession?.portal_type ?? null,
    displayName,
    signOutPortal,
  };
}

export default usePortalIdentity;
