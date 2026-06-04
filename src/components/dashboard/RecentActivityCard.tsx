import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useRecentActivity } from "@/hooks/useRecentActivity";

const toneToDot: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-kutlwano-blue",
  muted: "bg-muted-foreground",
};

const RecentActivityCard = () => {
  const { items, loading } = useRecentActivity(5);

  return (
    <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Clock className="h-5 w-5 text-kutlwano-teal" />
          Recent Activity
        </CardTitle>
        <CardDescription>Latest system activity and updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 text-sm">
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
                <div key={a.id} className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
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
      </CardContent>
    </Card>
  );
};

export default RecentActivityCard;
