import React from 'react';
import { Check, AlertCircle, Loader2, WifiOff, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SaveStatusIndicatorProps {
  status: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  lastSaved: Date | null;
  unsavedFields?: string[];
  error?: string | null;
  className?: string;
  showUnsavedFields?: boolean;
}

export const SaveStatusIndicator: React.FC<SaveStatusIndicatorProps> = ({
  status,
  lastSaved,
  unsavedFields = [],
  error,
  className,
  showUnsavedFields = false
}) => {
  const formatLastSaved = (date: Date | null) => {
    if (!date) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) {
      return 'Just now';
    } else if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: 'Saving...',
          variant: 'secondary' as const,
          bgColor: 'bg-blue-100 dark:bg-blue-900/30',
          textColor: 'text-blue-700 dark:text-blue-300'
        };
      case 'saved':
        return {
          icon: <Check className="h-4 w-4" />,
          text: `Saved ${formatLastSaved(lastSaved)}`,
          variant: 'default' as const,
          bgColor: 'bg-green-100 dark:bg-green-900/30',
          textColor: 'text-green-700 dark:text-green-300'
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Save failed',
          variant: 'destructive' as const,
          bgColor: 'bg-red-100 dark:bg-red-900/30',
          textColor: 'text-red-700 dark:text-red-300'
        };
      case 'offline':
        return {
          icon: <WifiOff className="h-4 w-4" />,
          text: 'Offline - saved locally',
          variant: 'outline' as const,
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
          textColor: 'text-yellow-700 dark:text-yellow-300'
        };
      case 'idle':
      default:
        if (unsavedFields.length > 0) {
          return {
            icon: <Clock className="h-4 w-4" />,
            text: `${unsavedFields.length} unsaved change${unsavedFields.length > 1 ? 's' : ''}`,
            variant: 'outline' as const,
            bgColor: 'bg-amber-100 dark:bg-amber-900/30',
            textColor: 'text-amber-700 dark:text-amber-300'
          };
        }
        return {
          icon: <Check className="h-4 w-4 opacity-50" />,
          text: lastSaved ? `Last saved ${formatLastSaved(lastSaved)}` : 'No changes',
          variant: 'secondary' as const,
          bgColor: 'bg-muted',
          textColor: 'text-muted-foreground'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
            config.bgColor,
            config.textColor,
            className
          )}
        >
          {config.icon}
          <span>{config.text}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          {status === 'error' && error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}
          {status === 'offline' && (
            <p className="text-sm">Changes are being saved locally and will sync when you're back online.</p>
          )}
          {showUnsavedFields && unsavedFields.length > 0 && (
            <div>
              <p className="font-medium text-sm mb-1">Unsaved fields:</p>
              <ul className="text-xs text-muted-foreground">
                {unsavedFields.slice(0, 5).map(field => (
                  <li key={field}>• {field.replace(/_/g, ' ')}</li>
                ))}
                {unsavedFields.length > 5 && (
                  <li>• and {unsavedFields.length - 5} more...</li>
                )}
              </ul>
            </div>
          )}
          {lastSaved && (
            <p className="text-xs text-muted-foreground">
              Last saved: {lastSaved.toLocaleString()}
            </p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};

export default SaveStatusIndicator;
