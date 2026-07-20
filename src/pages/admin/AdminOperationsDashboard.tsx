import React, { useMemo, useRef, useState } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import ProvinceLiveMap from '@/components/admin/ProvinceLiveMap';
import { AdminPage, AdminPill, BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  Calendar, FileText, Clock, Users, AlertTriangle, CheckCircle2, FileSignature,
  ChevronUp, ChevronDown, type LucideIcon,
} from 'lucide-react';

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

/**
 * The mark in the corner of the home page — tilts in 3D toward the cursor.
 * A small "this system is alive" cue on the one page every other screen
 * in the portal returns to, and the same mark reappears on the map itself
 * (see ProvinceLiveMap's MapBrandMark) so the two feel like one live surface.
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
      className="h-10 w-10 shrink-0"
    >
      <div
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition: 'transform 150ms ease-out' }}
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-md border border-black/10 bg-white shadow-sm"
      >
        <img src={logoSrc} alt="Kutlwano & Associate" className="h-full w-full object-contain p-1" />
      </div>
    </div>
  );
};

interface StatPillData {
  label: string;
  value: number;
  icon: LucideIcon;
}

/** A slim inline stat, not a card — the strip is the "dashboard chrome", the map is the content. */
const StatPill = React.memo(function StatPill({ stat, loading }: { stat: StatPillData; loading: boolean }) {
  const Icon = stat.icon;
  return (
    <div className="flex items-center gap-2 whitespace-nowrap border-r border-black/10 px-3 py-1.5 last:border-r-0">
      <Icon className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} />
      <span className="text-sm font-bold tabular-nums text-black">{loading ? '–' : stat.value}</span>
      <span className="text-[11px] text-slate-500">{stat.label}</span>
    </div>
  );
});

interface CaseTypeRowData {
  type: string;
  count: number;
  countLastYear: number;
}

const CaseTypeRow = React.memo(function CaseTypeRow({ ct, maxCount, color }: { ct: CaseTypeRowData; maxCount: number; color: string }) {
  return (
    <div className="space-y-1 py-1.5">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <div className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="truncate text-xs font-medium text-black">{ct.type}</span>
        </div>
        <span className="text-xs font-semibold" style={{ color }}>{ct.count}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
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
  const [drawerOpen, setDrawerOpen] = useState(false);

  const statPills: StatPillData[] = useMemo(() => [
    { label: 'Active cases', value: stats.totalClaimants, icon: Users },
    { label: 'Appointments', value: stats.totalAppointments, icon: Calendar },
    { label: 'Pending', value: stats.pendingReports, icon: Clock },
    { label: 'In progress', value: stats.reportsInProgress, icon: FileText },
    { label: 'Reports out', value: stats.reportsTakenOut, icon: FileSignature },
    { label: 'Completed', value: stats.completedAssessments, icon: CheckCircle2 },
  ], [stats]);

  const maxCaseTypeCount = useMemo(() => {
    if (stats.caseTypeData.length === 0) return 1;
    return Math.max(...stats.caseTypeData.map((c) => c.count)) || 1;
  }, [stats.caseTypeData]);

  return (
    <AdminPage>
      {/* Header — same eyebrow/title pattern as every other admin page, plus
          the live mark that ties this page to the map below it. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <LiveMark />
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: BRAND_TEAL }}>
              Operations
            </div>
            <h1 className="truncate text-xl font-bold text-black md:text-2xl">Operations Dashboard</h1>
            <p className="text-xs text-slate-500 md:text-sm">Live case load across every province</p>
          </div>
        </div>
        <div className="flex max-w-full flex-wrap items-center overflow-x-auto rounded-full border border-black/10 bg-white">
          {statPills.map((stat) => (
            <StatPill key={stat.label} stat={stat} loading={loading} />
          ))}
        </div>
      </div>

      {/* The map is the dashboard — real streets, real pins, everything else floats on top of it */}
      {loading ? (
        <div className="flex h-[70vh] max-h-[640px] min-h-[380px] w-full items-center justify-center border border-black/10">
          <p className="text-sm text-slate-500">Loading case map…</p>
        </div>
      ) : (
        <ProvinceLiveMap data={stats.provinceStatusData} loading={loading} />
      )}

      {/* Overdue alert — flat hairline block, matching the rest of the portal's alert treatment */}
      {stats.overdueReports > 0 && (
        <div className="flex flex-wrap items-center gap-2 border border-warning/30 bg-warning/5 px-4 py-2.5 text-sm text-black">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span className="flex-1">
            {stats.overdueReports} report{stats.overdueReports !== 1 ? 's' : ''} overdue — pending for more than 30 days
          </span>
          <AdminPill tone="warning">Action required</AdminPill>
        </div>
      )}

      {/* Case type breakdown — tucked into a collapsible drawer instead of a permanent table */}
      <div className="border border-black/10 bg-white">
        <button
          onClick={() => setDrawerOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-black"
        >
          <span>Case type breakdown ({lastYear} vs {currentYear})</span>
          {drawerOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {drawerOpen && (
          <div className="border-t border-black/10 px-4 py-2">
            {stats.caseTypeData.length === 0 ? (
              <p className="py-2 text-sm text-slate-500">No case type data available</p>
            ) : (
              stats.caseTypeData.map((ct, i) => (
                <CaseTypeRow
                  key={ct.type}
                  ct={ct}
                  maxCount={maxCaseTypeCount}
                  color={CASE_TYPE_COLORS[i % CASE_TYPE_COLORS.length]}
                />
              ))
            )}
          </div>
        )}
      </div>
    </AdminPage>
  );
};

export default AdminOperationsDashboard;
