// src/pages/admin/AdminAnalytics.tsx
import React from 'react';
import { BarChart3, TrendingUp, Calendar, Users } from 'lucide-react';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

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
    <AdminPage>
      <AdminHeader
        eyebrow="Insights"
        title="Operational Analytics"
        description="Monthly volume trends and performance metrics"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[
          { label: 'Avg Cases/Month', value: '39', icon: BarChart3, trend: '+12%' },
          { label: 'Report Turnaround', value: '14d', icon: Calendar, trend: '-3d' },
          { label: 'Active Attorneys', value: '67', icon: Users, trend: '+5' },
          { label: 'Completion Rate', value: '87%', icon: TrendingUp, trend: '+4%' },
        ].map((kpi) => (
          <AdminStatCard key={kpi.label} label={kpi.label} value={kpi.value} icon={kpi.icon} hint={`${kpi.trend} vs last period`} />
        ))}
      </div>

      {/* Monthly Volume Chart */}
      <AdminCard>
        <AdminCardHeader icon={BarChart3} title="Monthly Volume Trends" />
        <AdminCardBody>
          <div className="flex h-48 items-end gap-1.5 overflow-x-auto sm:gap-4">
            {monthlyData.map((m) => (
              <div key={m.month} className="flex min-w-[36px] flex-1 flex-col items-center gap-1">
                <div className="flex w-full justify-center gap-1" style={{ height: '180px' }}>
                  <div className="flex w-4 flex-col justify-end sm:w-5">
                    <div
                      className="transition-all duration-700"
                      style={{ height: `${(m.cases / maxVal) * 100}%`, backgroundColor: BRAND_TEAL }}
                    />
                  </div>
                  <div className="flex w-4 flex-col justify-end sm:w-5">
                    <div
                      className="bg-black/20 transition-all duration-700"
                      style={{ height: `${(m.reports / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-500">{m.month}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-center gap-4 border-t border-black/10 pt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3" style={{ backgroundColor: BRAND_TEAL }} />
              <span className="text-xs text-slate-500">Cases</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 bg-black/20" />
              <span className="text-xs text-slate-500">Reports</span>
            </div>
          </div>
        </AdminCardBody>
      </AdminCard>
    </AdminPage>
  );
};

export default AdminAnalytics;
