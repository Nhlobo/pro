import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading access...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionProtectedRoute;