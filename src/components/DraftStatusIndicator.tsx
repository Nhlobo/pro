import { useEffect, useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import type { DraftSaveStatus } from "@/hooks/useFormDraft";
import { cn } from "@/lib/utils";

interface DraftStatusIndicatorProps {
  status: DraftSaveStatus;
  lastSavedAt: Date | null;
  className?: string;
}

function formatRelative(date: Date): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  return date.toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

export const DraftStatusIndicator = ({
  status,
  lastSavedAt,
  className,
}: DraftStatusIndicatorProps) => {
  // Re-render every 15s so the relative timestamp stays fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  if (status === "idle" && !lastSavedAt) {
    return (
      <div className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Save className="h-3.5 w-3.5" />
        <span>Auto-save ready</span>
      </div>
    );
  }

  if (status === "saving") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Saving draft…</span>
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400", className)}>
      <Check className="h-3.5 w-3.5" />
      <span>
        Draft saved{lastSavedAt ? ` · ${formatRelative(lastSavedAt)}` : ""}
      </span>
    </div>
  );
};

export default DraftStatusIndicator;
