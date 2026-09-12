import React from 'react';
import { Navigate } from 'react-router-dom';
import ProtectedRoute from '@/components/ProtectedRoute';
import { usePermissions } from '@/hooks/usePermissions';
import {
  canAccessAttorneyPortal,
  canAccessExpertPortal,
  getDefaultPortalRoute,
  type AppRole,
} from '@/utils/portalAccess';

interface PortalRoleGateProps {
  children: React.ReactNode;
  portal: 'attorney' | 'expert';
}

/**
 * SECURITY FIX (2026-09-12 incident — expert-portal login landing on the
 * attorney portal): canAccessAttorneyPortal() / canAccessExpertPortal() /
 * getDefaultPortalRoute() in src/utils/portalAccess.ts were fully
 * implemented and covered by their own passing unit-test suite
 * (src/utils/__tests__/portalAccess.test.ts) but were never actually
 * called anywhere outside those tests. Every /attorney-portal/* route was
 * wrapped only in <ProtectedRoute> (auth + email-confirmation only, no
 * role check at all), and /expert-portal/* only added the Expert layout
 * on top of that same bare <ProtectedRoute>. The result: ANY
 * authenticated user of ANY role — a medical expert, a referring
 * attorney, or internal staff — could load the *other* external portal
 * just by navigating straight to its URL, with no redirect, no error,
 * and no gate of any kind.
 *
 * This is the same failure mode PermissionProtectedRoute.tsx's 2026-08-30
 * fix describes for admin routes ("a gate that was built and tested, but
 * never wired up") — see that file's comment. This component is the
 * missing wiring for the two external portals.
 *
 * `loading` is deliberately not handled here: PortalRoleRoute always
 * renders this gate as a *child* of <ProtectedRoute>, which already
 * blocks on `usePermissions().loading` before rendering its own
 * children (see ProtectedRoute.tsx) — so by the time this gate runs,
 * userRole has already resolved.
 */
const PortalRoleGate: React.FC<PortalRoleGateProps> = ({ children, portal }) => {
  const { userRole } = usePermissions();
  const role = userRole as AppRole;
  const allowed = portal === 'attorney' ? canAccessAttorneyPortal(role) : canAccessExpertPortal(role);

  if (!allowed) {
    // Send them to wherever their own role actually lands — never back
    // into the portal that just denied them (getDefaultPortalRoute only
    // ever points at '/attorney-portal' for referring_attorney and
    // '/expert-portal' for medical_expert, neither of which can reach
    // this branch, so this can't loop).
    return <Navigate to={getDefaultPortalRoute(role)} replace />;
  }

  return <>{children}</>;
};

interface PortalRoleRouteProps {
  children: React.ReactNode;
  portal: 'attorney' | 'expert';
}

/** Auth + role enforcement for a single external-portal route. */
export const PortalRoleRoute: React.FC<PortalRoleRouteProps> = ({ children, portal }) => (
  <ProtectedRoute>
    <PortalRoleGate portal={portal}>{children}</PortalRoleGate>
  </ProtectedRoute>
);

export default PortalRoleRoute;
