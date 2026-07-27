import React from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  FileText,
  Clock,
  FileSignature,
  BarChart3,
  MapPin,
  Tags,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminLoadingState,
  BRAND_TEAL,
} from '@/components/admin/ui/AdminUI';

/**
 * Operations Dashboard — admin landing page.
 *
 * Live case-load overview: current-year KPIs, each measured against the
 * same period last year, plus a provincial and case-type breakdown so
 * staff can see coverage gaps and matter-type mix at a glance. All of it
 * is powered by useDashboardStats, which already computes this-year vs
 * last-year figures from `appointments`, `expert_reports`, `claimants`
 * and `referring_attorneys` — this page just renders it.
 */

const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR = CURRENT_YEAR - 1;

/** Signed, rounded percentage change. Guards the 0-to-something case, which
 * would otherwise divide by zero and read as a meaningless "Infinity%". */
function pctChange(current: number, previous: number): { label: string; direction: 'up' | 'down' | 'flat' } {
  if (previous === 0) {
    if (current === 0) return { label: '0%', direction: 'flat' };
    return { label: 'New', direction: 'up' };
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return { label: '0%', direction: 'flat' };
  return { label: `${change > 0 ? '+' : ''}${change}%`, direction: change > 0 ? 'up' : 'down' };
}

const TrendBadge: React.FC<{ current: number; previous: number }> = ({ current, previous }) => {
  const { label, direction } = pctChange(current, previous);
  const toneClass =
    direction === 'up' ? 'text-success' : direction === 'down' ? 'text-destructive' : 'text-slate-400';
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold ${toneClass}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
};

/** One row of the Provincial Case Distribution panel: a stacked pair of
 * bars (last year in grey, this year in teal) scaled to the larger of the
 * two years' provincial totals so growth/shrinkage is visible at a glance. */
const ProvinceRow: React.FC<{
  name: string;
  cases: number;
  casesLastYear: number;
  maxCases: number;
}> = ({ name, cases, casesLastYear, maxCases }) => {
  const widthThisYear = maxCases > 0 ? Math.max((cases / maxCases) * 100, cases > 0 ? 2 : 0) : 0;
  const widthLastYear = maxCases > 0 ? Math.max((casesLastYear / maxCases) * 100, casesLastYear > 0 ? 2 : 0) : 0;

  return (
    <div className="py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-black">{name}</span>
        <span className="flex items-center gap-2 text-slate-500">
          <span>
            {LAST_YEAR}: <span className="font-medium text-black">{casesLastYear}</span>
          </span>
          <span>
            {CURRENT_YEAR}: <span className="font-medium text-black">{cases}</span>
          </span>
          <TrendBadge current={cases} previous={casesLastYear} />
        </span>
      </div>
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-black/5">
          <div className="h-1.5 bg-black/20" style={{ width: `${widthLastYear}%` }} />
        </div>
        <div className="h-1.5 w-full bg-black/5">
          <div className="h-1.5" style={{ width: `${widthThisYear}%`, backgroundColor: BRAND_TEAL }} />
        </div>
      </div>
    </div>
  );
};

const DOT_COLORS = ['#00BAAD', '#2563EB', '#16A34A', '#9333EA', '#D97706', '#DC2626', '#0EA5E9', '#EA580C'];

const AdminOperationsDashboard: React.FC = () => {
  const { stats, loading } = useDashboardStats();

  const totalCaseTypeThisYear = stats.caseTypeData.reduce((sum, t) => sum + t.count, 0);
  const totalCaseTypeLastYear = stats.caseTypeData.reduce((sum, t) => sum + t.countLastYear, 0);
  const maxProvinceCases = Math.max(1, ...stats.provincialData.map((p) => Math.max(p.cases, p.casesLastYear)));

  return (
    <AdminPage>
      <AdminHeader
        eyebrow="Live case load overview"
        title="Operations Dashboard"
        description={`Operational metrics, ${CURRENT_YEAR} vs ${LAST_YEAR}`}
        icon={LayoutDashboard}
      />

      {/* KPI row — each figure measured against the same point last year */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <AdminStatCard
          label="Active Cases"
          value={loading ? '–' : stats.totalClaimants}
          icon={Users}
          loading={loading}
          hint={!loading && <TrendBadge current={stats.totalClaimantsThisYear} previous={stats.totalClaimantsLastYear} />}
        />
        <AdminStatCard
          label="Appointments"
          value={loading ? '–' : stats.totalAppointments}
          icon={Calendar}
          loading={loading}
          hint={!loading && <TrendBadge current={stats.totalAppointments} previous={stats.totalAppointmentsLastYear} />}
        />
        <AdminStatCard
          label="Pending Reports"
          value={loading ? '–' : stats.pendingReports}
          icon={FileText}
          loading={loading}
          hint={!loading && <TrendBadge current={stats.pendingReports} previous={stats.pendingReportsLastYear} />}
        />
        <AdminStatCard
          label="In Progress"
          value={loading ? '–' : stats.reportsInProgress}
          icon={Clock}
          loading={loading}
          hint={!loading && <TrendBadge current={stats.reportsInProgress} previous={stats.reportsInProgressLastYear} />}
        />
        <AdminStatCard
          label="Reports Out"
          value={loading ? '–' : stats.reportsTakenOut}
          icon={FileSignature}
          loading={loading}
          hint={!loading && <TrendBadge current={stats.reportsTakenOut} previous={stats.reportsTakenOutLastYear} />}
        />
        <AdminStatCard
          label="Completed"
          value={loading ? '–' : stats.completedAssessments}
          icon={BarChart3}
          loading={loading}
          hint={!loading && <TrendBadge current={stats.completedAssessments} previous={stats.completedAssessmentsLastYear} />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Provincial Case Distribution */}
        <AdminCard>
          <AdminCardHeader
            title="Provincial Case Distribution"
            description="Appointment volume by referring attorney's province"
            icon={MapPin}
          />
          <AdminCardBody>
            {loading ? (
              <AdminLoadingState label="Loading provincial data…" />
            ) : stats.provincialData.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No appointment data yet.</p>
            ) : (
              <div className="divide-y divide-black/5">
                {stats.provincialData.map((p) => (
                  <ProvinceRow
                    key={p.name}
                    name={p.name}
                    cases={p.cases}
                    casesLastYear={p.casesLastYear}
                    maxCases={maxProvinceCases}
                  />
                ))}
              </div>
            )}
          </AdminCardBody>
        </AdminCard>

        {/* Case Type Breakdown */}
        <AdminCard>
          <AdminCardHeader title="Case Type Breakdown" description="Matter type mix, this year vs last" icon={Tags} />
          <AdminCardBody>
            {loading ? (
              <AdminLoadingState label="Loading case type data…" />
            ) : stats.caseTypeData.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">No appointment data yet.</p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-2 gap-3 border-b border-black/10 pb-3">
                  <div>
                    <p className="text-2xl font-bold text-black">{totalCaseTypeThisYear}</p>
                    <p className="text-[11px] text-slate-500">{CURRENT_YEAR} total</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-400">{totalCaseTypeLastYear}</p>
                    <p className="text-[11px] text-slate-500">{LAST_YEAR} total</p>
                  </div>
                </div>
                <div className="divide-y divide-black/5">
                  {stats.caseTypeData.map((t, i) => (
                    <div key={t.type} className="flex items-center justify-between gap-2 py-2 text-xs">
                      <span className="flex min-w-0 items-center gap-2 font-medium text-black">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: DOT_COLORS[i % DOT_COLORS.length] }}
                        />
                        <span className="truncate">{t.type}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 text-slate-500">
                        <span>
                          {LAST_YEAR}: <span className="font-medium text-black">{t.countLastYear}</span>
                        </span>
                        <span>
                          {CURRENT_YEAR}: <span className="font-medium text-black">{t.count}</span>
                        </span>
                        <TrendBadge current={t.count} previous={t.countLastYear} />
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </AdminCardBody>
        </AdminCard>
      </div>
    </AdminPage>
  );
};

export default AdminOperationsDashboard;
