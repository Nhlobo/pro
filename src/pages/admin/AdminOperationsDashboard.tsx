import React from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users, Calendar, FileText, Clock, TrendingUp, BarChart3,
  AlertTriangle, CheckCircle2, FileSignature
} from 'lucide-react';

const AdminOperationsDashboard: React.FC = () => {
  const { stats, loading } = useDashboardStats();

  const statCards = [
    { label: 'Active Cases', value: stats.totalClaimants, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Appointments', value: stats.totalAppointments, icon: Calendar, color: 'text-secondary', bg: 'bg-secondary/10' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: Clock, color: 'text-warning', bg: 'bg-warning/10' },
    { label: 'In Progress', value: stats.reportsInProgress, icon: FileText, color: 'text-info', bg: 'bg-info/10' },
    { label: 'Reports Out', value: stats.reportsTakenOut, icon: FileSignature, color: 'text-kutlwano-purple', bg: 'bg-kutlwano-purple/10' },
    { label: 'Completed', value: stats.completedAssessments, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/10' },
  ];

  // Mock provincial data
  const provincialData = [
    { name: 'Gauteng', cases: 145, pct: 32 },
    { name: 'Western Cape', cases: 98, pct: 22 },
    { name: 'KwaZulu-Natal', cases: 67, pct: 15 },
    { name: 'Eastern Cape', cases: 45, pct: 10 },
    { name: 'Free State', cases: 32, pct: 7 },
    { name: 'Mpumalanga', cases: 28, pct: 6 },
    { name: 'Limpopo', cases: 18, pct: 4 },
    { name: 'North West', cases: 12, pct: 3 },
    { name: 'Northern Cape', cases: 5, pct: 1 },
  ];

  const caseTypes = [
    { type: 'RAF', count: 189, pct: 42, color: 'bg-primary' },
    { type: 'Medical Negligence', count: 134, pct: 30, color: 'bg-secondary' },
    { type: 'Merit Report', count: 78, pct: 17, color: 'bg-kutlwano-purple' },
    { type: 'Other', count: 49, pct: 11, color: 'bg-kutlwano-gold' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Operations Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live case load overview and operational metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="border-border/50">
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-2">
                <div className={`p-2 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
                <TrendingUp className="h-3 w-3 text-success" />
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>
                {loading ? '–' : stat.value}
              </p>
              <p className="text-[11px] text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Provincial Bar Chart */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Provincial Case Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {provincialData.map((prov) => (
                <div key={prov.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 truncate">{prov.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-end pr-2 transition-all duration-700"
                      style={{ width: `${prov.pct}%` }}
                    >
                      {prov.pct > 10 && (
                        <span className="text-[10px] font-semibold text-primary-foreground">{prov.cases}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground w-8 text-right">{prov.pct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Case Type Donut (simplified) */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-secondary" />
              Case Type Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-8">
              {/* Donut visualization */}
              <div className="relative w-36 h-36 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                  {caseTypes.reduce((acc, ct, i) => {
                    const offset = caseTypes.slice(0, i).reduce((s, c) => s + c.pct, 0);
                    const colors = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--kutlwano-purple))', 'hsl(var(--kutlwano-gold))'];
                    acc.push(
                      <circle
                        key={ct.type}
                        cx="18" cy="18" r="15.5"
                        fill="none"
                        stroke={colors[i]}
                        strokeWidth="4"
                        strokeDasharray={`${ct.pct} ${100 - ct.pct}`}
                        strokeDashoffset={`${-offset}`}
                      />
                    );
                    return acc;
                  }, [] as React.ReactNode[])}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-xl font-bold text-foreground">{caseTypes.reduce((s, c) => s + c.count, 0)}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-3 flex-1">
                {caseTypes.map((ct) => (
                  <div key={ct.type} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${ct.color}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{ct.type}</p>
                      <p className="text-xs text-muted-foreground">{ct.count} cases ({ct.pct}%)</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      <Card className="border-warning/30 bg-warning/5">
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">3 reports overdue — Expert responses pending for KZN region</p>
          </div>
          <Badge variant="outline" className="border-warning/50 text-warning">Action Required</Badge>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminOperationsDashboard;
