import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Calendar, Users } from 'lucide-react';

const monthlyData = [
  { month: 'Oct', cases: 32, reports: 28 },
  { month: 'Nov', cases: 38, reports: 34 },
  { month: 'Dec', cases: 25, reports: 22 },
  { month: 'Jan', cases: 41, reports: 36 },
  { month: 'Feb', cases: 45, reports: 40 },
  { month: 'Mar', cases: 52, reports: 44 },
];

const AdminAnalytics: React.FC = () => {
  const maxVal = Math.max(...monthlyData.map(m => m.cases));

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Operational Analytics</h1>
        <p className="text-sm text-muted-foreground">Monthly volume trends and performance metrics</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Avg Cases/Month', value: '39', icon: BarChart3, trend: '+12%' },
          { label: 'Report Turnaround', value: '14d', icon: Calendar, trend: '-3d' },
          { label: 'Active Attorneys', value: '67', icon: Users, trend: '+5' },
          { label: 'Completion Rate', value: '87%', icon: TrendingUp, trend: '+4%' },
        ].map(kpi => (
          <Card key={kpi.label} className="rounded-none border-black/10 shadow-none">
            <CardContent className="pt-4 pb-3 px-4">
              <kpi.icon className="h-4 w-4 text-primary mb-2" />
              <p className="text-xl md:text-2xl font-bold text-foreground">{kpi.value}</p>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
                <span className="text-[10px] text-success font-medium">{kpi.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Monthly Volume Chart */}
      <Card className="rounded-none border-black/10 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Monthly Volume Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4 h-48">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full flex gap-1 justify-center" style={{ height: '180px' }}>
                  <div className="flex flex-col justify-end w-5">
                    <div
                      className="bg-primary rounded-t-sm transition-all duration-700"
                      style={{ height: `${(m.cases / maxVal) * 100}%` }}
                    />
                  </div>
                  <div className="flex flex-col justify-end w-5">
                    <div
                      className="bg-secondary rounded-t-sm transition-all duration-700"
                      style={{ height: `${(m.reports / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-4 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-primary" />
              <span className="text-xs text-muted-foreground">Cases</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-secondary" />
              <span className="text-xs text-muted-foreground">Reports</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAnalytics;
