import { Check, Clock, Eye, ThumbsDown, ThumbsUp, ArrowRightCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export type ApprovalTimelineDecision = "pending" | "approved" | "not_approved" | "moved_next";

interface ApprovalTimelineProps {
  submittedAt?: string | null;
  submittedBy?: string | null;
  decidedAt?: string | null;
  decidedBy?: string | null;
  decision?: ApprovalTimelineDecision;
  /** Compact = smaller spacing/text; useful inside cards */
  compact?: boolean;
  className?: string;
}

const fmt = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return format(d, "dd MMM yyyy · HH:mm");
};

/**
 * Three-step status timeline for an approval request:
 * Submitted → Reviewed → Approved / Declined / Moved to next month
 * Shows actor names + timestamps under each completed step.
 */
export const ApprovalTimeline = ({
  submittedAt,
  submittedBy,
  decidedAt,
  decidedBy,
  decision = "pending",
  compact = false,
  className,
}: ApprovalTimelineProps) => {
  const isSubmitted = !!submittedAt;
  const isDecided = decision !== "pending" && !!decidedAt;
  // "Reviewed" = work is in progress (submitted, not yet decided) or already decided
  const isReviewed = isSubmitted; // anything submitted is in review or beyond

  const finalLabel =
    decision === "approved"
      ? "Approved"
      : decision === "not_approved"
      ? "Declined"
      : decision === "moved_next"
      ? "Moved to next month"
      : "Awaiting decision";

  const FinalIcon =
    decision === "approved"
      ? ThumbsUp
      : decision === "not_approved"
      ? ThumbsDown
      : decision === "moved_next"
      ? ArrowRightCircle
      : Clock;

  const steps: Array<{
    key: string;
    label: string;
    Icon: typeof Check;
    done: boolean;
    active: boolean;
    tone: "neutral" | "info" | "success" | "danger" | "warning";
    by?: string | null;
    at?: string | null;
  }> = [
    {
      key: "submitted",
      label: "Submitted",
      Icon: Send,
      done: isSubmitted,
      active: isSubmitted && !isDecided,
      tone: "info",
      by: submittedBy,
      at: submittedAt,
    },
    {
      key: "reviewed",
      label: isDecided ? "Reviewed" : "Under review",
      Icon: Eye,
      done: isReviewed,
      active: isSubmitted && !isDecided,
      tone: "info",
      by: isDecided ? decidedBy : null,
      at: isDecided ? decidedAt : null,
    },
    {
      key: "decision",
      label: finalLabel,
      Icon: FinalIcon,
      done: isDecided,
      active: !isDecided,
      tone:
        decision === "approved"
          ? "success"
          : decision === "not_approved"
          ? "danger"
          : decision === "moved_next"
          ? "warning"
          : "neutral",
      by: decidedBy,
      at: decidedAt,
    },
  ];

  const toneClasses = (
    tone: "neutral" | "info" | "success" | "danger" | "warning",
    done: boolean,
    active: boolean
  ) => {
    if (!done && !active) return "bg-muted text-muted-foreground border-border";
    if (active && !done)
      return "bg-amber-50 text-amber-800 border-amber-300 ring-2 ring-amber-200/60";
    switch (tone) {
      case "success":
        return "bg-emerald-50 text-emerald-700 border-emerald-300";
      case "danger":
        return "bg-rose-50 text-rose-700 border-rose-300";
      case "warning":
        return "bg-indigo-50 text-indigo-700 border-indigo-300";
      case "info":
        return "bg-sky-50 text-sky-700 border-sky-300";
      default:
        return "bg-muted text-foreground border-border";
    }
  };

  const dotSize = compact ? "h-6 w-6" : "h-7 w-7";
  const iconSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";
  const labelText = compact ? "text-[11px]" : "text-xs";
  const metaText = compact ? "text-[10px]" : "text-[11px]";

  return (
    <div
      className={cn(
        "rounded-md border bg-card/50 p-2.5",
        className
      )}
      role="list"
      aria-label="Approval status timeline"
    >
      <div className="flex items-start gap-1">
        {steps.map((s, idx) => {
          const at = fmt(s.at);
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center text-center min-w-0" role="listitem">
              <div className="flex items-center w-full">
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    idx === 0 ? "opacity-0" : steps[idx - 1].done ? "bg-emerald-400" : "bg-border"
                  )}
                />
                <div
                  className={cn(
                    "rounded-full border flex items-center justify-center shrink-0",
                    dotSize,
                    toneClasses(s.tone, s.done, s.active)
                  )}
                  title={s.label}
                >
                  {s.done && s.key !== "decision" ? (
                    <Check className={iconSize} />
                  ) : (
                    <s.Icon className={iconSize} />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 h-0.5",
                    idx === steps.length - 1 ? "opacity-0" : s.done ? "bg-emerald-400" : "bg-border"
                  )}
                />
              </div>
              <div className={cn("mt-1 font-medium truncate w-full px-1", labelText)}>
                {s.label}
              </div>
              <div className={cn("text-muted-foreground truncate w-full px-1", metaText)}>
                {at ? at : s.active ? "in progress" : "—"}
              </div>
              {s.by && (
                <div className={cn("text-muted-foreground truncate w-full px-1", metaText)} title={s.by}>
                  by {s.by}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ApprovalTimeline;
