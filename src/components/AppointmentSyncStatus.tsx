import { Wifi, WifiOff } from "lucide-react";
import { useAppointmentSync } from "@/contexts/AppointmentSyncContext";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

export const AppointmentSyncStatus = () => {
  const { isConnected } = useAppointmentSync();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={isConnected ? "default" : "destructive"} 
            className="flex items-center gap-1 cursor-help"
          >
            {isConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                <span className="text-xs">Live Sync</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span className="text-xs">Offline</span>
              </>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {isConnected 
              ? "Real-time sync active - dashboards update automatically"
              : "Real-time sync disconnected - refresh manually if needed"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
