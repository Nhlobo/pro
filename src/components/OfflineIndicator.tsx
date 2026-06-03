import { useEffect, useState } from "react";
import { Wifi, WifiOff, RefreshCw, AlertCircle } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { listQueue } from "@/lib/offline/db";
import { syncQueue } from "@/lib/offline/sync";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Fixed-position online/offline indicator. Shows queued mutation count and
 * allows the user to trigger a manual sync. POPIA-safe: only metadata shown,
 * never the queued record payload.
 */
export function OfflineIndicator() {
  const online = useOnlineStatus();
  const [queueCount, setQueueCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refresh = async () => {
    try {
      const q = await listQueue();
      setQueueCount(q.length);
      setFailedCount(q.filter((x) => x.attempts > 0).length);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    void refresh();
    const i = setInterval(refresh, 4000);
    const handler = () => void refresh();
    window.addEventListener("online", handler);
    window.addEventListener("offline", handler);
    return () => {
      clearInterval(i);
      window.removeEventListener("online", handler);
      window.removeEventListener("offline", handler);
    };
  }, []);

  const onSync = async () => {
    setSyncing(true);
    try {
      await syncQueue();
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  // When fully online and no pending items, render a subtle dot only.
  if (online && queueCount === 0) {
    return (
      <div
        className="fixed bottom-3 right-3 z-[60] flex h-2.5 w-2.5 items-center justify-center"
        title="Online"
        aria-label="Online"
      >
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow" />
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "fixed bottom-3 right-3 z-[60] gap-2 shadow-lg",
            !online && "border-amber-500 text-amber-700",
            failedCount > 0 && "border-destructive text-destructive",
          )}
        >
          {online ? (
            failedCount > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <Wifi className="h-4 w-4" />
            )
          ) : (
            <WifiOff className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">
            {online ? "Online" : "Offline"}
            {queueCount > 0 && ` · ${queueCount} pending`}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <div>
            <div className="text-sm font-semibold">
              {online ? "Back online" : "You're offline"}
            </div>
            <p className="text-xs text-muted-foreground">
              {online
                ? "Queued changes will sync automatically."
                : "Changes you make on offline-enabled pages are saved locally and will sync when you reconnect."}
            </p>
          </div>
          <div className="rounded-md border bg-muted/40 p-2 text-xs">
            <div className="flex justify-between">
              <span>Pending changes</span>
              <span className="font-semibold">{queueCount}</span>
            </div>
            {failedCount > 0 && (
              <div className="flex justify-between text-destructive">
                <span>With sync errors</span>
                <span className="font-semibold">{failedCount}</span>
              </div>
            )}
          </div>
          <Button
            size="sm"
            className="w-full"
            disabled={!online || syncing || queueCount === 0}
            onClick={onSync}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", syncing && "animate-spin")}
            />
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default OfflineIndicator;
