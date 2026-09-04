import { AdminCard, AdminCardHeader, AdminCardBody } from "@/components/admin/ui/AdminUI";
import { Clock } from "lucide-react";
import { useRecentActivity } from "@/hooks/useRecentActivity";

const toneToDot: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-kutlwano-teal",
  muted: "bg-muted-foreground",
};

const RecentActivityCard = () => {
  const { items, loading } = useRecentActivity(5);

  return (
    <AdminCard>
      <AdminCardHeader
        icon={Clock}
        title="Recent Activity"
        description="Latest system activity and updates"
      />
      <AdminCardBody>
        <div className="space-y-1.5 text-sm">
          {loading ? (
            <div className="text-muted-foreground text-xs py-2">Loading activity…</div>
          ) : items.length === 0 ? (
            <div className="text-muted-foreground text-xs py-2">No recent activity</div>
          ) : (
            items.map((a) => {
              const absolute = new Date(a.createdAt).toLocaleString("en-ZA", {
                timeZone: "Africa/Johannesburg",
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <div key={a.id} className="flex items-center gap-3 border border-black/10 p-2">
                  <div className={`w-2 h-2 ${toneToDot[a.tone] ?? "bg-muted-foreground"} rounded-full shrink-0`} />
                  <span className="text-muted-foreground flex-1 truncate">{a.label}</span>
                  <span
                    className="text-[10px] text-muted-foreground/70 shrink-0"
                    title={absolute}
                  >
                    {a.relativeTime}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </AdminCardBody>
    </AdminCard>
  );
};

export default RecentActivityCard;
