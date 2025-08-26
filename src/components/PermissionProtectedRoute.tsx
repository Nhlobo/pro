import React from 'react';
import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { usePermissionRoutes } from '@/hooks/usePermissionRoutes';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, ArrowLeft, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  redirectTo = '/dashboard'
}) => {
  const { hasPermission, isAdmin, loading, userRole } = usePermissions();
  const { getRequiredPermission } = usePermissionRoutes();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Admin users can access everything
  if (isAdmin()) {
    return <>{children}</>;
  }

  // Get required permission from route if not explicitly provided
  const requiredPermission = permission || getRequiredPermission(window.location.pathname);

  // If no permission is required, allow access
  if (!requiredPermission) {
    return <>{children}</>;
  }

  // Handle admin-only routes
  if (requiredPermission === 'admin_only') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold">Administrator Access Required</CardTitle>
            <CardDescription>
              This function is restricted to administrators only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Access Denied</AlertTitle>
              <AlertDescription>
                You need administrator privileges to access this feature. Contact your system administrator for assistance.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to={redirectTo} className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check permissions for regular users
  const permissions = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
  const hasAccess = requireAll 
    ? permissions.every(p => hasPermission(p))
    : permissions.some(p => hasPermission(p));

  if (!hasAccess) {
    const permissionList = permissions.join(', ');
    
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold">Access Restricted</CardTitle>
            <CardDescription>
              You don't have the required permissions to access this feature.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Insufficient Permissions</AlertTitle>
              <AlertDescription>
                Required permissions: <code className="text-xs bg-muted px-1 rounded">{permissionList}</code>
                <br />
                Current role: <code className="text-xs bg-muted px-1 rounded">{userRole || 'user'}</code>
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>To access this feature, you need one of the following permissions:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                {permissions.map(perm => (
                  <li key={perm}>{perm.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</li>
                ))}
              </ul>
              <p className="mt-3">Contact your administrator to request access.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to={redirectTo} className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default PermissionProtectedRoute;