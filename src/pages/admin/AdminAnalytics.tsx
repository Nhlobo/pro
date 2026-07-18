// src/pages/admin/AdminAnalytics.tsx
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { BarChart3, TrendingUp, TrendingDown, Calendar, Users, FileText, ArrowUpRight } from 'lucide-react';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminPill,
  AdminSectionLabel,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

// ---------------------------------------------------------------------
// Sample data — presentation only. Swap these arrays for real query
// results (React Query / Supabase) whenever the analytics backend lands;
// every component below is already shaped to consume that same
// { label, value }-style data, so no layout changes will be needed.
// ---------------------------------------------------------------------

const monthlyData = [
  { month: 'Oct', cases: 32, reports: 28 },
  { month: 'Nov', cases: 38, reports: 34 },
  { month: 'Dec', cases: 25, reports: 22 },
  { month: 'Jan', cases: 41, reports: 36 },
  { month: 'Feb', cases: 45, reports: 40 },
  { month: 'Mar', cases: 52, reports: 44 },
];

const KPIS = [
  { label: 'Avg Cases / Month', value: '39', icon: BarChart3, trend: '+12%', up: true },
  { label: 'Report Turnaround', value: '14d', icon: Calendar, trend: '-3d', up: true },
  { label: 'Active Attorneys', value: '67', icon: Users, trend: '+5', up: true },
  { label: 'Completion Rate', value: '87%', icon: TrendingUp, trend: '+4%', up: true },
];

const CASE_TYPE_BREAKDOWN = [
  { label: 'Motor Vehicle Accident', value: 46 },
  { label: 'Medical Negligence', value: 27 },
  { label: 'Workplace Injury', value: 18 },
  { label: 'Other', value: 9 },
];

const TOP_ATTORNEYS = [
  { name: 'Kutlwano & Associate — Pretoria', cases: 22 },
  { name: 'Kutlwano & Associate — Sandton', cases: 17 },
  { name: 'Kutlwano & Associate — Cape Town', cases: 14 },
  { name: 'Kutlwano & Associate — Durban', cases: 9 },
];

const RANGE_OPTIONS = ['3M', '6M', '12M'] as const;
type Range = (typeof RANGE_OPTIONS)[number];

const CustomTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-black/10 bg-white px-3 py-2 shadow-sm">
      <p className="text-xs font-semibold text-black">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="text-xs text-slate-500">
          <span className="mr-1.5 inline-block h-2 w-2 align-middle" style={{ backgroundColor: p.fill || p.stroke }} />
          {p.name}: <span className="font-medium text-black">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const AdminAnalytics: React.FC = () => {
  const [range, setRange] = useState<Range>('6M');

  const chartData = useMemo(() => {
    const count = range === '3M' ? 3 : range === '6M' ? 6 : monthlyData.length;
    return monthlyData.slice(-count);
  }, [range]);

  const maxAttorneyCases = Math.max(...TOP_ATTORNEYS.map((a) => a.cases));
  const totalCaseTypes = CASE_TYPE_BREAKDOWN.reduce((sum, c) => sum + c.value, 0);

  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Insights"
        title="Operational Analytics"
        description="Monthly volume trends and performance metrics across the firm"
        icon={BarChart3}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {KPIS.map((kpi) => (
          <AdminStatCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            hint={
              <span className={`inline-flex items-center gap-1 ${kpi.up ? 'text-emerald-600' : 'text-destructive'}`}>
                {kpi.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {kpi.trend} vs last period
              </span>
            }
          />
        ))}
      </div>

      {/* Monthly volume trend */}
      <AdminCard>
        <AdminCardHeader
          icon={BarChart3}
          title="Monthly Volume Trends"
          description="Cases opened vs. reports delivered"
          actions={
            <div className="flex items-center gap-1 border border-black/10 p-0.5">
              {RANGE_OPTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    range === r ? 'bg-black text-white' : 'text-slate-500 hover:text-black'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          }
        />
        <AdminCardBody>
          <div className="h-64 w-full sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.08)" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={{ stroke: 'rgba(0,0,0,0.1)' }}
                  tickLine={false}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                <Bar dataKey="cases" name="Cases" fill={BRAND_TEAL} radius={[2, 2, 0, 0]} maxBarSize={36} />
                <Line
                  type="monotone"
                  dataKey="reports"
                  name="Reports"
                  stroke="#0B0B0B"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#0B0B0B' }}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-center gap-4 border-t border-black/10 pt-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5" style={{ backgroundColor: BRAND_TEAL }} />
              <span className="text-xs text-slate-500">Cases opened</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-2.5 bg-black" />
              <span className="text-xs text-slate-500">Reports delivered</span>
            </div>
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Secondary breakdowns */}
      <AdminSectionLabel>Breakdown</AdminSectionLabel>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
        {/* Case type mix */}
        <AdminCard>
          <AdminCardHeader icon={FileText} title="Cases by Type" description="Share of total case volume" />
          <AdminCardBody className="space-y-3">
            {CASE_TYPE_BREAKDOWN.map((c) => {
              const pct = Math.round((c.value / totalCaseTypes) * 100);
              return (
                <div key={c.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-black">{c.label}</span>
                    <span className="text-slate-500">{pct}%</span>
                  </div>
                  <div className="h-2 w-full bg-black/5">
                    <div
                      className="h-2 transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: BRAND_TEAL }}
                    />
                  </div>
                </div>
              );
            })}
          </AdminCardBody>
        </AdminCard>

        {/* Top referring attorneys */}
        <AdminCard>
          <AdminCardHeader
            icon={Users}
            title="Top Referring Attorneys"
            description="By cases referred this period"
            actions={<AdminPill tone="teal">Top {TOP_ATTORNEYS.length}</AdminPill>}
          />
          <AdminCardBody className="space-y-3">
            {TOP_ATTORNEYS.map((a, i) => (
              <div key={a.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-[11px] font-bold text-black">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-black">{a.name}</p>
                  <div className="mt-1 h-1.5 w-full bg-black/5">
                    <div
                      className="h-1.5 bg-black transition-all duration-700"
                      style={{ width: `${(a.cases / maxAttorneyCases) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-black">
                  {a.cases}
                  <ArrowUpRight className="h-3 w-3 text-slate-400" />
                </span>
              </div>
            ))}
          </AdminCardBody>
        </AdminCard>
      </div>
    </AdminPage>
  );
};

export default AdminAnalytics;
