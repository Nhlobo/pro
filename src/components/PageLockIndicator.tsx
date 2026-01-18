import React from 'react';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';
import { Lock, Unlock, RefreshCw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface PageLockIndicatorProps {
  className?: string;
  showControls?: boolean;
}

export const PageLockIndicator: React.FC<PageLockIndicatorProps> = ({
  className,
  showControls = true
}) => {
  const { 
    isPageLocked, 
    hasPendingSync, 
    processPendingSync, 
    unlockPage,
    syncStatus 
  } = useAppointmentSync();

  if (!isPageLocked && !hasPendingSync) {
    return null;
  }

  return (
    <TooltipProvider>
      <div className={cn(
        "fixed bottom-4 left-4 z-50 flex items-center gap-2 p-2 rounded-lg shadow-lg",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border",
        isPageLocked ? "border-amber-500/50" : "border-blue-500/50",
        className
      )}>
        {isPageLocked && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1.5 bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700">
                <Lock className="h-3 w-3" />
                Page Locked
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">
                Your page is protected from auto-refresh while you work. 
                Data updates are queued until you save or unlock.
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {hasPendingSync && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className="gap-1.5 bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-700">
                <AlertCircle className="h-3 w-3" />
                Updates Pending
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">
                New data is available. Click "Sync Now" when ready to refresh.
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {showControls && (
          <div className="flex items-center gap-1 ml-1">
            {hasPendingSync && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={processPendingSync}
                    disabled={syncStatus === 'syncing'}
                    className="h-7 px-2 text-xs"
                  >
                    <RefreshCw className={cn(
                      "h-3 w-3 mr-1",
                      syncStatus === 'syncing' && "animate-spin"
                    )} />
                    Sync Now
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-sm">Apply pending updates</p>
                </TooltipContent>
              </Tooltip>
            )}

            {isPageLocked && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={unlockPage}
                    className="h-7 px-2 text-xs"
                  >
                    <Unlock className="h-3 w-3 mr-1" />
                    Unlock
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p className="text-sm">Allow auto-refresh</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default PageLockIndicator;
