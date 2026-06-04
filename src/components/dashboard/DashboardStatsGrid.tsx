import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  Calendar,
  FileText,
  Clock,
  TrendingUp,
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

const StatCard = ({
  title,
  value,
  hint,
  Icon,
  color,
  loading,
}: {
  title: string;
  value: number | string;
  hint: string;
  Icon: typeof Users;
  color: string;
  loading?: boolean;
}) => (
  <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-foreground">{title}</CardTitle>
      <div className={`p-2 ${color}/10 rounded-lg group-hover:${color}/20 transition-colors duration-300`}>
        <Icon className={`h-5 w-5 ${color.replace("bg-", "text-")}`} />
      </div>
    </CardHeader>
    <CardContent>
      <div className={`text-3xl font-bold ${color.replace("bg-", "text-")} mb-1`}>
        {loading ? "—" : value}
      </div>
      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        <span>{hint}</span>
      </div>
    </CardContent>
  </Card>
);

const DashboardStatsGrid = ({ stats, loading }: Props) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <StatCard title="Total Claimants" value={stats.totalClaimants} hint="All active cases" Icon={Users} color="bg-kutlwano-blue" loading={loading} />
      <StatCard title="Appointments" value={stats.totalAppointments} hint="Scheduled assessments" Icon={Calendar} color="bg-kutlwano-teal" loading={loading} />
      <StatCard title="Pending Reports" value={stats.pendingReports} hint="Awaiting completion" Icon={FileText} color="bg-warning" loading={loading} />
      <StatCard title="Reports In Progress" value={stats.reportsInProgress} hint="Currently being prepared" Icon={Clock} color="bg-blue-500" loading={loading} />
      <StatCard title="Reports Taken Out" value={stats.reportsTakenOut} hint="Delivered to attorneys" Icon={FileSignature} color="bg-purple-500" loading={loading} />
      <StatCard title="Completed" value={stats.completedAssessments} hint="Reports finalized" Icon={BarChart3} color="bg-success" loading={loading} />
    </div>
  );
};

export default DashboardStatsGrid;
