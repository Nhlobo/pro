import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Lock } from 'lucide-react';

interface PermissionGuardProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showAlert?: boolean;
  requireAll?: boolean; // If true, user must have ALL permissions. If false, user needs ANY permission
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  children,
  fallback,
  showAlert = false,
  requireAll = false
}) => {
  const { hasPermission, isAdmin, loading } = usePermissions();

  if (loading) {
    return null;
  }

  // Admin users can access everything
  if (isAdmin()) {
    return <>{children}</>;
  }

  // Check permissions
  const permissions = Array.isArray(permission) ? permission : [permission];
  const hasAccess = requireAll 
    ? permissions.every(p => hasPermission(p))
    : permissions.some(p => hasPermission(p));

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showAlert) {
      return (
        <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature. Contact your administrator for access.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
};

export default PermissionGuard;

// Enhanced permission check for admin and employee roles
export const AdminEmployeeGuard: React.FC<Omit<PermissionGuardProps, 'permission'> & { children: React.ReactNode }> = ({
  children,
  fallback,
  showAlert = false
}) => {
  const { hasPermission, isAdmin, loading } = usePermissions();

  if (loading) {
    return null;
  }

  // Check if user is admin or has employee role or manage_experts permission
  const hasAccess = isAdmin() || hasPermission('manage_experts') || hasPermission('admin') || hasPermission('employee');

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showAlert) {
      return (
        <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this feature. Administrator or employee access required.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  }

  return <>{children}</>;
};