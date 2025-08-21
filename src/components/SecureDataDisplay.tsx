import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSecurity } from './SecurityProvider';

interface SecureDataDisplayProps {
  data: string | null | undefined;
  type: 'email' | 'phone' | 'address' | 'text';
  label: string;
  showIcon?: boolean;
  requiresPermission?: string;
  className?: string;
}

export const SecureDataDisplay: React.FC<SecureDataDisplayProps> = ({
  data,
  type,
  label,
  showIcon = true,
  requiresPermission,
  className = '',
}) => {
  const { validateAccess, maskSensitiveData, logSecurityEvent } = useSecurity();
  const [showFull, setShowFull] = React.useState(false);

  const hasAccess = requiresPermission ? validateAccess(requiresPermission) : validateAccess();

  const handleToggleVisibility = () => {
    if (!hasAccess) {
      logSecurityEvent('unauthorized_data_access_attempt', { 
        type, 
        label,
        permission: requiresPermission 
      });
      return;
    }

    setShowFull(!showFull);
    logSecurityEvent('sensitive_data_viewed', { type, label, showFull: !showFull });
  };

  const getDisplayValue = () => {
    if (!data) {
      return '[No data available]';
    }

    if (!hasAccess) {
      return '[Contact Administrator for Access]';
    }

    if (showFull) {
      return data;
    }

    // Check if data is already masked (contains *** or [Protected])
    if (data.includes('***') || data.includes('[Protected]') || data.includes('[Contact') || data.includes('[Security')) {
      return data;
    }

    return maskSensitiveData(data, type as 'email' | 'phone' | 'address');
  };

  const isDataMasked = () => {
    if (!data) return false;
    return data.includes('***') || data.includes('[Protected]') || data.includes('[Contact') || data.includes('[Security');
  };

  const canToggle = hasAccess && !isDataMasked() && data;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {showIcon && (
        <Shield className={`h-4 w-4 ${hasAccess ? 'text-green-500' : 'text-orange-500'}`} />
      )}
      
      <span className="text-sm font-medium text-muted-foreground">{label}:</span>
      
      <span className="flex-1">
        {getDisplayValue()}
      </span>

      {canToggle && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleVisibility}
          className="h-6 w-6 p-0"
        >
          {showFull ? (
            <EyeOff className="h-3 w-3" />
          ) : (
            <Eye className="h-3 w-3" />
          )}
        </Button>
      )}

      {!hasAccess && requiresPermission && (
        <Badge variant="secondary" className="text-xs">
          Requires Permission
        </Badge>
      )}

      {isDataMasked() && (
        <Badge variant="outline" className="text-xs">
          Protected
        </Badge>
      )}
    </div>
  );
};