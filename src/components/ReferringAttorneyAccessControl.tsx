import React from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, ArrowLeft, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ReferringAttorneyAccessControlProps {
  children: React.ReactNode;
  requiredPermissions?: string[];
  allowedForReferringAttorney?: boolean;
  restrictionMessage?: string;
  fallback?: React.ReactNode;
}

export const ReferringAttorneyAccessControl: React.FC<ReferringAttorneyAccessControlProps> = ({
  children,
  requiredPermissions = [],
  allowedForReferringAttorney = false,
  restrictionMessage = "Access Denied – You can only view your own information.",
  fallback
}) => {
  const { isReferringAttorney, isAdmin, hasPermission, userRole } = usePermissions();

  // Admin users can always access everything
  if (isAdmin()) {
    return <>{children}</>;
  }

  // Check if referring attorney is accessing restricted content
  if (isReferringAttorney()) {
    // If this content is specifically allowed for referring attorneys
    if (allowedForReferringAttorney) {
      return <>{children}</>;
    }

    // Check if referring attorney has required permissions
    if (requiredPermissions.length > 0) {
      const hasRequiredPermission = requiredPermissions.some(permission => hasPermission(permission));
      if (hasRequiredPermission) {
        return <>{children}</>;
      }
    }

    // If fallback is provided, use it
    if (fallback) {
      return <>{fallback}</>;
    }

    // Show access denied message
    return (
      <div className="min-h-[400px] bg-gradient-to-br from-background to-muted/20 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl font-semibold">Access Restricted</CardTitle>
            <CardDescription>
              Attorney access is limited to your own information
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="border-destructive/50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Restricted Access</AlertTitle>
              <AlertDescription>
                {restrictionMessage}
              </AlertDescription>
            </Alert>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>As a Referring Attorney, you can only access:</p>
              <ul className="list-disc list-inside space-y-1 text-xs ml-4">
                <li>Your own profile information</li>
                <li>Your law firm's case files and reports</li>
                <li>Appointments linked to your attorney ID</li>
                <li>Documents you have uploaded</li>
              </ul>
              <p className="mt-3 font-medium">Contact support if you believe this is an error.</p>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" className="flex-1">
                <Link to="/dashboard" className="flex items-center gap-2">
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

  // For other user roles, show the content
  return <>{children}</>;
};

// Component to conditionally hide/show elements for referring attorneys
export const ReferringAttorneyGuard: React.FC<{
  children: React.ReactNode;
  hideForReferringAttorney?: boolean;
  showForReferringAttorney?: boolean;
  showMessage?: boolean;
}> = ({ 
  children, 
  hideForReferringAttorney = false, 
  showForReferringAttorney = false,
  showMessage = false
}) => {
  const { isReferringAttorney, isAdmin } = usePermissions();

  // Admin users can always see everything
  if (isAdmin()) {
    return <>{children}</>;
  }

  // If we should hide for referring attorneys
  if (hideForReferringAttorney && isReferringAttorney()) {
    if (showMessage) {
      return (
        <div className="p-4 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-muted-foreground">
            <EyeOff className="h-4 w-4" />
            <span className="text-sm">This feature is not available for your role</span>
          </div>
        </div>
      );
    }
    return null;
  }

  // If we should only show for referring attorneys
  if (showForReferringAttorney && !isReferringAttorney()) {
    return null;
  }

  return <>{children}</>;
};

// Hook for checking referring attorney access
export const useReferringAttorneyAccess = () => {
  const { isReferringAttorney, isAdmin, hasPermission } = usePermissions();

  const canAccessOwnData = () => isReferringAttorney() || isAdmin();
  
  const canAccessAllData = () => isAdmin();
  
  const canManageUsers = () => isAdmin();
  
  const canViewReports = () => {
    return isAdmin() || isReferringAttorney() || hasPermission('view_reports');
  };
  
  const canManageAppointments = () => {
    return isAdmin() || isReferringAttorney() || hasPermission('manage_appointments');
  };
  
  const canUploadDocuments = () => {
    return isAdmin() || isReferringAttorney() || hasPermission('manage_documents');
  };

  const canManageClaimants = () => {
    return isAdmin() || isReferringAttorney() || hasPermission('manage_claimants');
  };

  const canRequestAssessments = () => {
    return isAdmin() || isReferringAttorney() || hasPermission('request_assessments');
  };

  const canViewOwnProfile = () => {
    return isAdmin() || isReferringAttorney();
  };

  const getAccessMessage = (type: 'general' | 'attorney_data' | 'user_management' | 'system_admin' = 'general') => {
    const messages = {
      general: "Access Denied – You can only view your own information.",
      attorney_data: "Access Denied – You cannot view other attorneys' information.",
      user_management: "Access Denied – User management is restricted to administrators only.",
      system_admin: "Access Denied – This feature requires system administrator privileges."
    };
    return messages[type];
  };

  return {
    isReferringAttorney,
    isAdmin,
    canAccessOwnData,
    canAccessAllData,
    canManageUsers,
    canViewReports,
    canManageAppointments,
    canUploadDocuments,
    canManageClaimants,
    canRequestAssessments,
    canViewOwnProfile,
    getAccessMessage
  };
};

export default ReferringAttorneyAccessControl;