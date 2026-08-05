import React from 'react';
import { Navigate } from 'react-router-dom';
import { useExternalPortalSession } from '@/hooks/externalPortal/useExternalPortalSession';

/**
 * Landing router right after sign-in. Both portal types now have a
 * real destination (Phase 3: attorney, Phase 4: expert) — this page
 * exists only so external-portal-auth's redirect target and any
 * bookmarked /external-portal/home link still resolve correctly, by
 * bouncing to the right portal based on the session's portal_type.
 */
const ExternalPortalHome: React.FC = () => {
  const { session } = useExternalPortalSession();

  if (!session) return null;

  if (session.portal_type === 'attorney') {
    return <Navigate to="/external-portal/attorney/cases" replace />;
  }

  return <Navigate to="/external-portal/expert/cases" replace />;
};

export default ExternalPortalHome;
