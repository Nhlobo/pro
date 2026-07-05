import React from 'react';
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
}) => {
  const { loading } = usePermissions();

  if (loading) {
    return <BrandedPageLoader message="Loading access…" />;
  }

  return <>{children}</>;
};

export default PermissionProtectedRoute;
