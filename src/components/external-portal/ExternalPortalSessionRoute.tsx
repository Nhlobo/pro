import React from 'react';
import { Navigate } from 'react-router-dom';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';

/**
 * Gate for pages under /external-portal/* that require a signed-in
 * external user. Deliberately separate from the app's existing
 * ProtectedRoute (which checks Supabase auth) — external portal users
 * are authenticated entirely through this module's own session token,
 * never through Supabase auth.
 *
 * This is a client-side convenience redirect only. The real
 * authorization boundary is server-side: every portal data request
 * (Phase 3/4) must independently validate the session token against
 * external_portal_sessions.
 */
const ExternalPortalSessionRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useExternalPortalSession();

  if (!isAuthenticated) {
    return <Navigate to="/external-portal/sign-in" replace />;
  }

  return <>{children}</>;
};

export default ExternalPortalSessionRoute;
