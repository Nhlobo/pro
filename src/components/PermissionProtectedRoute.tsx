import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import BrandedPageLoader from '@/components/BrandedPageLoader';

interface PermissionProtectedRouteProps {
  children: React.ReactNode;
  /**
   * Permission name(s) required to view this route. A string[] is OR'd by
   * default (any one match is enough) — matching how every call site in
   * App.tsx already writes e.g. permission={["manage_experts","view_reports"]}
   * to mean "either is fine". Pass requireAll to switch to AND semantics.
   * Omit entirely for a route that only needs authentication (ProtectedRoute
   * already covers that) with no further gating.
   */
  permission?: string | string[];
  requireAll?: boolean;
  /**
   * Where to send a signed-in user who fails the check. Defaults to
   * '/dashboard', which re-dispatches every role to its correct shared
   * landing page (see src/pages/Index.tsx) rather than dumping everyone on
   * one fixed screen.
   */
  redirectTo?: string;
}

/**
 * FIX (2026-08-30 access-control audit): this component used to accept a
 * `permission` prop and never read it — every route wrapped in
 * <PermissionProtectedRoute permission="admin_only"> (or any other
 * permission string) rendered its children for ANY authenticated user,
 * because only the parent <ProtectedRoute> (auth + email-confirmation only)
 * was actually gating anything. ~44 routes in App.tsx were affected,
 * including several tagged admin_only (/user-management,
 * /permission-management, /security-settings, /audit-trail,
 * /edit-requests, /deleted-appointments, /workflow-automation).
 *
 * This restores real enforcement using the existing usePermissions().
 * hasPermission() — the same permission resolver every page already calls
 * for its own in-page checks — so there's no new permission model
 * introduced here, just the missing wiring.
 */
export const PermissionProtectedRoute: React.FC<PermissionProtectedRouteProps> = ({
  children,
  permission,
  requireAll = false,
  redirectTo = '/dashboard',
}) => {
  const { loading, hasPermission } = usePermissions();
  const location = useLocation();

  if (loading) {
    return <BrandedPageLoader message="Loading access…" />;
  }

  if (permission) {
    const required = Array.isArray(permission) ? permission : [permission];
    const allowed = requireAll
      ? required.every((p) => hasPermission(p))
      : required.some((p) => hasPermission(p));

    if (!allowed) {
      // replace: true — a denied route shouldn't leave a dead entry in
      // history that just bounces the user back here on "Back".
      return <Navigate to={redirectTo} replace state={{ deniedFrom: location.pathname }} />;
    }
  }

  return <>{children}</>;
};

export default PermissionProtectedRoute;
