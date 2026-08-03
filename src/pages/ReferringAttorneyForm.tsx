import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import BrandedPageLoader from '@/components/BrandedPageLoader';

interface PermissionProtectedRouteProps {
  children: React.ReactNode;
  permission?: string | string[];
  requireAll?: boolean;
  redirectTo?: string;
}

export const PermissionProtectedRoute: React.FC<PermissionProtectedRouteProps> = ({
  children,
  permission,
  requireAll = false,
  redirectTo = '/dashboard',
}) => {
  const { loading, hasPermission } = usePermissions();

  if (loading) {
    return <BrandedPageLoader message="Loading access…" />;
  }

  if (permission) {
    const required = Array.isArray(permission) ? permission : [permission];
    // Default is "any of these" (matches how call sites already list a
    // permission alongside a role name, e.g. ["manage_claimants",
    // "referring_attorney"], expecting either to be sufficient).
    const allowed = requireAll
      ? required.every((p) => hasPermission(p))
      : required.some((p) => hasPermission(p));

    if (!allowed) {
      return <Navigate to={redirectTo} replace />;
    }
  }

  return <>{children}</>;
};

export default PermissionProtectedRoute;
