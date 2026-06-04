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

interface CardSpec {
  title: string;
  value: number;
  hint: string;
  Icon: typeof Users;
  iconBg: string;
  iconHover: string;
  iconText: string;
  valueText: string;
}

const StatCard = ({ spec, loading }: { spec: CardSpec; loading?: boolean }) => (
  <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-foreground">{spec.title}</CardTitle>
      <div className={`p-2 ${spec.iconBg} rounded-lg ${spec.iconHover} transition-colors duration-300`}>
        <spec.Icon className={`h-5 w-5 ${spec.iconText}`} />
      </div>
    </CardHeader>
    <CardContent>
      <div className={`text-3xl font-bold ${spec.valueText} mb-1`}>
        {loading ? "—" : spec.value}
      </div>
      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
        <TrendingUp className="h-3 w-3" />
        <span>{spec.hint}</span>
      </div>
    </CardContent>
  </Card>
);

const DashboardStatsGrid = ({ stats, loading }: Props) => {
  const specs: CardSpec[] = [
    { title: "Total Claimants", value: stats.totalClaimants, hint: "All active cases", Icon: Users, iconBg: "bg-kutlwano-blue/10", iconHover: "group-hover:bg-kutlwano-blue/20", iconText: "text-kutlwano-blue", valueText: "text-kutlwano-blue" },
    { title: "Appointments", value: stats.totalAppointments, hint: "Scheduled assessments", Icon: Calendar, iconBg: "bg-kutlwano-teal/10", iconHover: "group-hover:bg-kutlwano-teal/20", iconText: "text-kutlwano-teal", valueText: "text-kutlwano-teal" },
    { title: "Pending Reports", value: stats.pendingReports, hint: "Awaiting completion", Icon: FileText, iconBg: "bg-warning/10", iconHover: "group-hover:bg-warning/20", iconText: "text-warning", valueText: "text-warning" },
    { title: "Reports In Progress", value: stats.reportsInProgress, hint: "Currently being prepared", Icon: Clock, iconBg: "bg-blue-500/10", iconHover: "group-hover:bg-blue-500/20", iconText: "text-blue-500", valueText: "text-blue-500" },
    { title: "Reports Taken Out", value: stats.reportsTakenOut, hint: "Delivered to attorneys", Icon: FileSignature, iconBg: "bg-purple-500/10", iconHover: "group-hover:bg-purple-500/20", iconText: "text-purple-500", valueText: "text-purple-500" },
    { title: "Completed", value: stats.completedAssessments, hint: "Reports finalized", Icon: BarChart3, iconBg: "bg-success/10", iconHover: "group-hover:bg-success/20", iconText: "text-success", valueText: "text-success" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {specs.map((s) => (
        <StatCard key={s.title} spec={s} loading={loading} />
      ))}
    </div>
  );
};

export default DashboardStatsGrid;
