import React, { useMemo, useRef, useState } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { AdminPage, BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  Calendar, FileText, Clock, Users, CheckCircle2, FileSignature,
  type LucideIcon,
} from 'lucide-react';

const logoSrc = '/lovable-uploads/7401e32a-2457-4a00-9d60-c1ff9fcfc4fc.png';

/**
 * The mark in the corner of the home page — tilts in 3D toward the cursor.
 * A small "this system is alive" cue on the one page every other screen
 * in the portal returns to.
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

/** A slim inline stat, not a card — the strip is the "dashboard chrome". */
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

const AdminOperationsDashboard: React.FC = () => {
  const { stats, loading } = useDashboardStats();

  const statPills: StatPillData[] = useMemo(() => [
    { label: 'Active cases', value: stats.totalClaimants, icon: Users },
    { label: 'Appointments', value: stats.totalAppointments, icon: Calendar },
    { label: 'Pending', value: stats.pendingReports, icon: Clock },
    { label: 'In progress', value: stats.reportsInProgress, icon: FileText },
    { label: 'Reports out', value: stats.reportsTakenOut, icon: FileSignature },
    { label: 'Completed', value: stats.completedAssessments, icon: CheckCircle2 },
  ], [stats]);

  return (
    <AdminPage>
      {/* Header — same eyebrow/title pattern as every other admin page.
          Everything that used to live below this (hero panel, mobile
          fallback, overdue alert, case type drawer) has been removed —
          this header is the whole page for now. */}
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
    </AdminPage>
  );
};

export default AdminOperationsDashboard;
