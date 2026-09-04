import { AdminStatCard } from "@/components/admin/ui/AdminUI";
import {
  Users,
  Calendar,
  FileText,
  Clock,
  BarChart3,
  FileSignature,
} from "lucide-react";

interface Stats {
  totalClaimants: number;
  totalAppointments: number;
  pendingReports: number;
  reportsInProgress: number;
  reportsTakenOut: number;
  completedAssessments: number;
}

interface Props {
  stats: Stats;
  loading?: boolean;
}

const DashboardStatsGrid = ({ stats, loading }: Props) => {
  const specs = [
    { key: "totalClaimants", label: "Total Claimants", value: stats.totalClaimants, hint: "All active cases", icon: Users },
    { key: "totalAppointments", label: "Appointments", value: stats.totalAppointments, hint: "Scheduled assessments", icon: Calendar },
    { key: "pendingReports", label: "Pending Reports", value: stats.pendingReports, hint: "Awaiting completion", icon: FileText },
    { key: "reportsInProgress", label: "Reports In Progress", value: stats.reportsInProgress, hint: "Currently being prepared", icon: Clock },
    { key: "reportsTakenOut", label: "Reports Taken Out", value: stats.reportsTakenOut, hint: "Delivered to attorneys", icon: FileSignature },
    { key: "completedAssessments", label: "Completed", value: stats.completedAssessments, hint: "Reports finalized", icon: BarChart3 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {specs.map((s) => (
        <AdminStatCard
          key={s.key}
          label={s.label}
          value={s.value}
          hint={s.hint}
          icon={s.icon}
          loading={loading}
        />
      ))}
    </div>
  );
};

export default DashboardStatsGrid;
