import React, { useMemo, useRef, useState } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import ProvinceCaseMap from '@/components/admin/ProvinceCaseMap';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Calendar, FileText, Clock, TrendingUp, Users,
  AlertTriangle, CheckCircle2, FileSignature, ArrowUpRight, ArrowDownRight, Minus, MapPinned,
  type LucideIcon,
} from 'lucide-react';

// Brand accent — same teal used across the sign-in / auth screens.
const BRAND_TEAL = '#00BAAD';
const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

const CASE_TYPE_COLORS = [
  BRAND_TEAL,
  'hsl(var(--kutlwano-blue))',
  'hsl(var(--kutlwano-purple))',
  'hsl(var(--kutlwano-gold))',
  'hsl(var(--info))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
];

const currentYear = new Date().getFullYear();
const lastYear = currentYear - 1;

/** Small uppercase, tracked-out label — the "eyebrow" motif used on /auth. */
const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00BAAD]">
    {children}
  </div>
);

const YearBadge = () => (
  <Badge
    variant="outline"
    className="rounded-none border-black/15 text-[10px] font-semibold uppercase tracking-wide text-black"
  >
    {lastYear} vs {currentYear}
  </Badge>
);

/**
 * The mark in the top corner of the home page. It tilts in 3D toward the
 * cursor — a small, deliberate "this system is alive" cue on the one page
 * every other screen in the portal returns to.
 */
const LiveMark: React.FC = () => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setTilt({
      x: Math.max(-10, Math.min(10, (cy - e.clientY) / 4)),
      y: Math.max(-10, Math.min(10, (e.clientX - cx) / 4)),
    });
  };

  return (
    <div
      ref={wrapRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ perspective: '400px' }}
      className="h-11 w-11 flex-shrink-0"
    >
      <div
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 150ms ease-out',
          boxShadow: '0 1px 0 rgba(0,0,0,0.08)',
        }}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white"
      >
        <img src={logoSrc} alt="Kutlwano & Associate" className="h-full w-full object-contain p-1.5" />
      </div>
    </div>
  );
};

const YoYBadge = React.memo(function YoYBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (previous === 0) return <ArrowUpRight className="h-3 w-3 text-success" />;
  const pctChange = Math.round(((current - previous) / previous) * 100);
  const isUp = pctChange >= 0;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-semibold ${isUp ? 'text-success' : 'text-destructive'}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? '+' : ''}{pctChange}%
    </span>
  );
});

interface StatCardData {
  label: string;
  value: number;
  prevValue: number | null;
  icon: LucideIcon;
}

/** One KPI tile. Memoized so a hover/re-render elsewhere doesn't reflow the whole grid. */
const StatCard = React.memo(function StatCard({ stat, loading }: { stat: StatCardData; loading: boolean }) {
  const Icon = stat.icon;
  return (
    <Card className="rounded-none border-black/10 shadow-none transition-colors hover:border-[#00BAAD]/40">
      <CardContent className="px-3 pb-3 pt-3 md:px-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="rounded-full bg-black/5 p-1.5 md:p-2">
            <Icon className="h-4 w-4 text-black" style={{ color: BRAND_TEAL }} />
          </div>
          {stat.prevValue !== null && !loading && (
            <YoYBadge current={stat.value} previous={stat.prevValue} />
          )}
          {stat.prevValue === null && <TrendingUp className="h-3 w-3 text-success" />}
        </div>
        <p className="text-xl font-bold tabular-nums text-black md:text-2xl">
          {loading ? '–' : stat.value}
        </p>
        <p className="text-[11px] leading-tight text-slate-500">{stat.label}</p>
        {stat.prevValue !== null && !loading && (
          <p className="mt-0.5 text-[10px] text-slate-400">
            {lastYear}: {stat.prevValue}
          </p>
        )}
      </CardContent>
    </Card>
  );
});

interface CaseTypeRowData {
  type: string;
  count: number;
  countLastYear: number;
}

/** One case-type row in the breakdown chart, isolated so re-renders stay cheap. */
const CaseTypeRow = React.memo(function CaseTypeRow({ ct, maxCount, color }: { ct: CaseTypeRowData; maxCount: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-xs font-medium text-black">{ct.type}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px] sm:gap-3">
          <span className="text-slate-500">{lastYear}: <span className="font-medium text-black">{ct.countLastYear}</span></span>
          <span className="text-slate-500">{currentYear}: <span className="font-medium" style={{ color: BRAND_TEAL }}>{ct.count}</span></span>
          {ct.countLastYear > 0 && <YoYBadge current={ct.count} previous={ct.countLastYear} />}
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-black/20 transition-all duration-700"
          style={{ width: `${Math.max((ct.countLastYear / maxCount) * 100, 2)}%` }}
        />
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.max((ct.count / maxCount) * 100, 2)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
});

const AdminOperationsDashboard: React.FC = () => {
  const { stats, loading } = useDashboardStats();

  const statCards: StatCardData[] = useMemo(() => [
    { label: 'Active Cases', value: stats.totalClaimants, prevValue: null, icon: Users },
    { label: 'Appointments', value: stats.totalAppointments, prevValue: stats.totalAppointmentsLastYear, icon: Calendar },
    { label: 'Pending Reports', value: stats.pendingReports, prevValue: stats.pendingReportsLastYear, icon: Clock },
    { label: 'In Progress', value: stats.reportsInProgress, prevValue: stats.reportsInProgressLastYear, icon: FileText },
    { label: 'Reports Out', value: stats.reportsTakenOut, prevValue: stats.reportsTakenOutLastYear, icon: FileSignature },
    { label: 'Completed', value: stats.completedAssessments, prevValue: stats.completedAssessmentsLastYear, icon: CheckCircle2 },
  ], [stats]);

  const maxCaseTypeCount = useMemo(() => {
    if (stats.caseTypeData.length === 0) return 1;
    return Math.max(...stats.caseTypeData.map((c) => Math.max(c.count, c.countLastYear))) || 1;
  }, [stats.caseTypeData]);

  const totalCaseTypes = useMemo(
    () => stats.caseTypeData.reduce((s, c) => s + c.count, 0),
    [stats.caseTypeData]
  );
  const totalCaseTypesLastYear = useMemo(
    () => stats.caseTypeData.reduce((s, c) => s + c.countLastYear, 0),
    [stats.caseTypeData]
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header — the mark ties every other page in the portal back to this one */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <LiveMark />
          <div>
            <Eyebrow>Operations</Eyebrow>
            <h1 className="mt-1 text-xl font-bold text-black md:text-2xl">Operations Dashboard</h1>
            <p className="text-xs text-slate-500 md:text-sm">Live case load overview and operational metrics</p>
          </div>
        </div>
        <YearBadge />
      </div>

      {/* KPI Cards with YoY */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
        {statCards.map((stat) => (
          <StatCard key={stat.label} stat={stat} loading={loading} />
        ))}
      </div>

      {/* Provincial map — the hero. Case files, plotted where the work is. */}
      <Card className="rounded-none border-black/10 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-black">
            <MapPinned className="h-4 w-4" style={{ color: BRAND_TEAL }} />
            Case Distribution by Province
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : (
            <ProvinceCaseMap data={stats.provinceStatusData} loading={loading} />
          )}
        </CardContent>
      </Card>

      {/* Case Type Breakdown with YoY comparison */}
      <Card className="rounded-none border-black/10 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base text-black">
            <FileText className="h-4 w-4" style={{ color: BRAND_TEAL }} />
            Case Type Breakdown
            <span className="ml-auto">
              <Badge variant="outline" className="rounded-none border-black/15 text-[10px] text-black">
                {lastYear} vs {currentYear}
              </Badge>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : stats.caseTypeData.length === 0 ? (
            <p className="text-sm text-slate-500">No case type data available</p>
          ) : (
            <div className="space-y-4">
              {/* Summary totals */}
              <div className="flex items-center justify-between bg-black/[0.03] p-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-black">{totalCaseTypes}</p>
                  <p className="text-[10px] text-slate-500">{currentYear} Total</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-400">{totalCaseTypesLastYear}</p>
                  <p className="text-[10px] text-slate-500">{lastYear} Total</p>
                </div>
                <div className="text-center">
                  <YoYBadge current={totalCaseTypes} previous={totalCaseTypesLastYear} />
                  <p className="text-[10px] text-slate-500">Change</p>
                </div>
              </div>

              {/* Case type rows */}
              <div className="max-h-64 space-y-3 overflow-y-auto">
                {stats.caseTypeData.map((ct, i) => (
                  <CaseTypeRow
                    key={ct.type}
                    ct={ct}
                    maxCount={maxCaseTypeCount}
                    color={CASE_TYPE_COLORS[i % CASE_TYPE_COLORS.length]}
                  />
                ))}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 border-t border-black/10 pt-3">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-black/20" />
                  <span className="text-[10px] text-slate-500">{lastYear}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: BRAND_TEAL }} />
                  <span className="text-[10px] text-slate-500">{currentYear}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alerts — live data */}
      {stats.overdueReports > 0 && (
        <Card className="rounded-none border-warning/30 bg-warning/5 shadow-none">
          <CardContent className="flex items-center gap-3 px-4 py-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
            <div className="flex-1">
              <p className="text-sm font-medium text-black">
                {stats.overdueReports} report{stats.overdueReports !== 1 ? 's' : ''} overdue — Expert responses pending for more than 30 days
              </p>
            </div>
            <Badge variant="outline" className="rounded-none border-warning/50 text-warning">
              Action Required
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminOperationsDashboard;
