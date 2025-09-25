import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, ArrowLeft, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useRolePermissions } from '@/hooks/useRolePermissions';

interface PermissionDeniedDisplayProps {
  title?: string;
  message?: string;
  category: string;
  functionName: string;
  subFunction?: string;
  showContactAdmin?: boolean;
}

export const PermissionDeniedDisplay: React.FC<PermissionDeniedDisplayProps> = ({
  title = "Access Restricted",
  message,
  category,
  functionName,
  subFunction,
  showContactAdmin = true
}) => {
  const navigate = useNavigate();
  const displayFunction = subFunction || functionName;
  const defaultMessage = message || `You don't have permission to access "${displayFunction}". Contact your administrator if you need access to this feature.`;

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-2xl font-semibold text-foreground mb-2">{title}</h2>
            <p className="text-sm text-muted-foreground">
              Insufficient permissions for this operation
            </p>
          </div>
          
          <Alert className="mb-6 text-left">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="font-medium mb-2">Permission Required</div>
              <div className="text-sm space-y-1">
                {defaultMessage}
              </div>
            </AlertDescription>
          </Alert>
          
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              <div className="font-medium text-foreground mb-1">Required Permission:</div>
              <div className="space-y-1">
                <div>Category: {category}</div>
                <div>Function: {functionName}</div>
                {subFunction && <div>Sub-function: {subFunction}</div>}
              </div>
            </div>
            
            {showContactAdmin && (
              <p className="text-sm text-muted-foreground">
                Contact your system administrator to request access to this feature.
              </p>
            )}
          </div>
          
          <div className="flex gap-3 justify-center mt-6">
            <Button 
              variant="outline" 
              onClick={() => navigate(-1)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            
            {showContactAdmin && (
              <Button variant="default" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Contact Admin
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export interface PermissionProtectedContentProps {
  children: React.ReactNode;
  category: string;
  functionName: string;
  subFunction?: string;
  fallback?: React.ReactNode;
  showAlert?: boolean;
}

export const PermissionProtectedContent: React.FC<PermissionProtectedContentProps> = ({
  children,
  category,
  functionName,
  subFunction,
  fallback,
  showAlert = true
}) => {
  const { checkFunctionPermission, loading } = useRolePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-pulse">Loading permissions...</div>
      </div>
    );
  }

  const permissionCheck = checkFunctionPermission(category, functionName, subFunction);

  if (!permissionCheck.canAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showAlert) {
      return (
        <PermissionDeniedDisplay
          category={category}
          functionName={functionName}
          subFunction={subFunction}
        />
      );
    }

    return null;
  }

  return <>{children}</>;
};

// Higher-order component for protecting entire pages/components
export const withRolePermission = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  category: string,
  functionName: string,
  subFunction?: string
) => {
  return function PermissionProtectedComponent(props: P) {
    return (
      <PermissionProtectedContent
        category={category}
        functionName={functionName}
        subFunction={subFunction}
      >
        <WrappedComponent {...props} />
      </PermissionProtectedContent>
    );
  };
};

// Hook for conditional rendering based on permissions
export const usePermissionGuard = () => {
  const { checkFunctionPermission } = useRolePermissions();

  const PermissionGuard: React.FC<{
    category: string;
    functionName: string;
    subFunction?: string;
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }> = ({ category, functionName, subFunction, children, fallback = null }) => {
    const permissionCheck = checkFunctionPermission(category, functionName, subFunction);
    
    if (!permissionCheck.canAccess) {
      return <>{fallback}</>;
    }
    
    return <>{children}</>;
  };

  return { PermissionGuard };
};

export default PermissionProtectedContent;