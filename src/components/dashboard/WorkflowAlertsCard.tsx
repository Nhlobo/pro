import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, CalendarClock, CalendarDays, ClipboardList,
  FileWarning, Zap,
} from "lucide-react";
import { RandSign } from "@/components/icons/RandSign";
import { useWorkflowAlerts } from "@/hooks/useWorkflowAlerts";

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(n);

interface AlertRow {
  key: string;
  label: string;
  value: string | number;
  hint: string;
  to: string;
  icon: typeof AlertTriangle;
  tone: "warning" | "destructive" | "info" | "success" | "muted";
  badge?: string;
}

const toneStyles: Record<AlertRow["tone"], { icon: string; bg: string; badge: string }> = {
  warning: { icon: "text-warning", bg: "bg-warning/10", badge: "border-warning/50 text-warning" },
  destructive: { icon: "text-destructive", bg: "bg-destructive/10", badge: "border-destructive/50 text-destructive" },
  info: { icon: "text-kutlwano-blue", bg: "bg-kutlwano-blue/10", badge: "border-kutlwano-blue/40 text-kutlwano-blue" },
  success: { icon: "text-success", bg: "bg-success/10", badge: "border-success/50 text-success" },
  muted: { icon: "text-muted-foreground", bg: "bg-muted", badge: "border-border text-muted-foreground" },
};

const WorkflowAlertsCard = () => {
  const { alerts, loading } = useWorkflowAlerts();

  const rows: AlertRow[] = [
    {
      key: "overdue",
      label: "Overdue reports",
      value: alerts.overdueReports,
      hint: "Pending or in-progress reports older than 30 days",
      to: "/report-tracking",
      icon: FileWarning,
      tone: alerts.overdueReports > 0 ? "destructive" : "success",
      badge: alerts.overdueReports > 0 ? "Action needed" : "On track",
    },
    {
      key: "requests",
      label: "Pending appointment requests",
      value: alerts.pendingAppointmentRequests,
      hint: "Attorney-submitted requests awaiting approval",
      to: "/appointment-request-dashboard",
      icon: ClipboardList,
      tone: alerts.pendingAppointmentRequests > 0 ? "warning" : "muted",
      badge: alerts.pendingAppointmentRequests > 0 ? "Review" : undefined,
    },
    {
      key: "today",
      label: "Appointments today",
      value: alerts.appointmentsToday,
      hint: `${alerts.appointmentsThisWeek} scheduled this week`,
      to: "/scheduled-assessment",
      icon: CalendarClock,
      tone: "info",
    },
    {
      key: "unconfirmed",
      label: "Upcoming unconfirmed",
      value: alerts.unconfirmedAppointments,
      hint: "Scheduled appointments not yet confirmed",
      to: "/appointment-checklist",
      icon: CalendarDays,
      tone: alerts.unconfirmedAppointments > 0 ? "warning" : "muted",
    },
    {
      key: "outstanding",
      label: "Outstanding invoices",
      value: alerts.outstandingInvoices,
      hint: `Total balance ${fmtCurrency(alerts.outstandingBalanceTotal)}`,
      to: "/debtors-control",
      icon: RandSign,
      tone: alerts.outstandingInvoices > 0 ? "warning" : "success",
      badge: alerts.outstandingInvoices > 0 ? "Follow up" : undefined,
    },
  ];

  return (
    <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Zap className="h-5 w-5 text-warning" />
          Workflow Alerts
        </CardTitle>
        <CardDescription>Live operational signals across cases, appointments and finance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {rows.map((row) => {
            const styles = toneStyles[row.tone];
            return (
              <Link
                key={row.key}
                to={row.to}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
              >
                <div className={`p-2 rounded-md ${styles.bg}`}>
                  <row.icon className={`h-4 w-4 ${styles.icon}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{row.label}</span>
                    {row.badge && (
                      <Badge variant="outline" className={`text-[10px] ${styles.badge}`}>
                        {row.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{row.hint}</p>
                </div>
                <span className={`text-lg font-bold tabular-nums ${styles.icon}`}>
                  {loading ? "–" : row.value}
                </span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default WorkflowAlertsCard;
