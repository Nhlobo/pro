import { Link } from "react-router-dom";
import { AdminCard, AdminCardHeader, AdminCardBody, AdminPill } from "@/components/admin/ui/AdminUI";
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

const toneToPill: Record<AlertRow["tone"], "warning" | "destructive" | "teal" | "success" | "neutral"> = {
  warning: "warning",
  destructive: "destructive",
  info: "teal",
  success: "success",
  muted: "neutral",
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
    <AdminCard>
      <AdminCardHeader
        icon={Zap}
        title="Workflow Alerts"
        description="Live operational signals across cases, appointments and finance"
      />
      <AdminCardBody className="space-y-1.5">
        {rows.map((row) => (
          <Link
            key={row.key}
            to={row.to}
            className="flex items-center gap-3 border border-black/10 p-2.5 transition-colors hover:border-black/25 hover:bg-black/[0.02]"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black/5">
              <row.icon className="h-4 w-4" style={{ color: "#00BAAD" }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground truncate">{row.label}</span>
                {row.badge && <AdminPill tone={toneToPill[row.tone]}>{row.badge}</AdminPill>}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">{row.hint}</p>
            </div>
            <span className="text-lg font-bold tabular-nums text-black">
              {loading ? "–" : row.value}
            </span>
          </Link>
        ))}
      </AdminCardBody>
    </AdminCard>
  );
};

export default WorkflowAlertsCard;
