import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalEmptyState,
  AlertStrip,
  type PortalStatTile,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { useExpertDashboardStats } from '@/hooks/useExpertDashboardStats';
import { RandSign } from '@/components/icons/RandSign';
import {
  LayoutDashboard,
  Briefcase,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  TrendingUp,
  User,
  Upload,
} from 'lucide-react';

/**
 * Expert Portal — Dashboard.
 *
 * Rebuilt on the same PortalPrimitives design system as
 * AttorneyPortalDashboard.tsx (PortalHeader, PortalStatStrip,
 * PortalCard, AlertStrip, PortalEmptyState) instead of its own loose
 * grid of shadcn cards, and on useExpertDashboardStats — the same
 * page-lock-aware live sync (AppointmentSyncContext) the attorney
 * dashboard already uses — instead of a one-shot fetch with no refresh
 * path. Medical experts should see the same real-time behaviour and
 * visual language referring attorneys and staff already get.
 */

function getUrgencyBadge(dueDate: string | null) {
  if (!dueDate) return <Badge variant="outline" className="text-[10px]">No deadline</Badge>;
  const days = differenceInDays(parseISO(dueDate), new Date());
  if (days < 0) return <Badge className="bg-destructive text-destructive-foreground text-[10px]">Overdue by {Math.abs(days)}d</Badge>;
  if (days <= 3) return <Badge className="bg-destructive/80 text-destructive-foreground text-[10px]">Critical ({days}d)</Badge>;
  if (days <= 7) return <Badge className="bg-warning text-warning-foreground text-[10px]">Urgent ({days}d)</Badge>;
  return <Badge className="bg-success/20 text-success text-[10px]">{days}d left</Badge>;
}

const ExpertDashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    expertName,
    notLinked,
    stats,
    upcomingCases,
    overdueReports,
    pendingReportsList,
    recentlyCompleted,
    loading,
    refetchStats,
  } = useExpertDashboardStats();

  const statTiles: PortalStatTile[] = [
    { label: 'Upcoming', value: stats.upcomingAppointments, icon: Calendar, href: '/expert-portal/schedule' },
    { label: 'Pending Reports', value: stats.pendingReports, icon: Clock, href: '/expert-portal/reports' },
    { label: 'Overdue', value: stats.overdueReports, icon: AlertTriangle, href: '/expert-portal/reports', urgent: stats.overdueReports > 0 },
    { label: 'Completed', value: stats.completedAssessments, icon: CheckCircle2, href: '/expert-portal/performance' },
    { label: 'Total Cases', value: stats.totalCases, icon: Briefcase, href: '/expert-portal/cases' },
    { label: 'Avg Days', value: stats.averageDays, icon: TrendingUp, hint: 'To complete a report' },
    {
      label: 'Payments',
      value: stats.outstandingDebt > 0 ? `R${stats.outstandingDebt.toLocaleString()}` : 'R0',
      icon: RandSign,
      hint: 'Total received',
    },
  ];

  if (notLinked) {
    return (
      <PortalPage>
        <PortalEmptyState
          icon={AlertTriangle}
          title="Expert Profile Not Linked"
          description="Your account is not linked to a medical expert profile. Contact an administrator."
        />
      </PortalPage>
    );
  }

  return (
    <PortalPage>
      <PortalHeader
        eyebrow="Expert Portal"
        title={expertName ? `Welcome, Dr. ${expertName}` : 'Dashboard'}
        description="Your case overview, tasks and report summary."
        icon={LayoutDashboard}
        actions={<SyncStatus loading={loading} onRefresh={refetchStats} label="Live data" />}
      />

      {!loading && overdueReports.length > 0 && (
        <AlertStrip
          icon={AlertTriangle}
          tone="destructive"
          title={`${overdueReports.length} report${overdueReports.length === 1 ? '' : 's'} critical or overdue`}
          description="These reports are past their due date and need to be uploaded."
          action={
            <Button asChild size="sm" variant="outline" className="rounded-none">
              <Link to="/expert-portal/reports">Review</Link>
            </Button>
          }
        />
      )}

      <PortalStatStrip tiles={statTiles} loading={loading} />

      {!loading && overdueReports.length > 0 && (
        <PortalCard>
          <PortalCardHeader icon={AlertTriangle} title={`Critical & Overdue Reports (${overdueReports.length})`} />
          <PortalCardBody className="p-0">
            <ul>
              {overdueReports.map((r) => (
                <li key={r.id} className="flex flex-col gap-2 border-b border-black/10 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-black">
                      {r.appointment?.claimants?.first_name} {r.appointment?.claimants?.last_name}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-slate-500">
                      <User className="h-3 w-3 shrink-0" />
                      {r.appointment?.referring_attorneys?.name || 'N/A'}
                      <span className="mx-1">•</span>
                      Due: {r.report_due_date ? format(parseISO(r.report_due_date), 'dd MMM yyyy') : '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {getUrgencyBadge(r.report_due_date)}
                    <Button size="sm" className="rounded-none text-xs" onClick={() => navigate(`/expert-portal/case/${r.appointment_id}`)}>
                      <Upload className="mr-1 h-3 w-3" /> Upload Report
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </PortalCardBody>
        </PortalCard>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
        <PortalCard>
          <PortalCardHeader
            icon={Calendar}
            title="Upcoming Appointments"
            actions={
              <Button asChild variant="outline" size="sm" className="rounded-none">
                <Link to="/expert-portal/schedule">View All</Link>
              </Button>
            }
          />
          <PortalCardBody className="p-0">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">Loading…</div>
            ) : upcomingCases.length === 0 ? (
              <PortalEmptyState icon={Calendar} title="Nothing scheduled" description="No upcoming appointments right now." />
            ) : (
              <ul>
                {upcomingCases.map((c) => (
                  <li
                    key={c.id}
                    className="cursor-pointer border-b border-black/10 px-4 py-3 last:border-b-0 transition-colors hover:bg-black/[0.03]"
                    onClick={() => navigate(`/expert-portal/case/${c.id}`)}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-black">
                        {c.claimants?.first_name} {c.claimants?.last_name}
                      </p>
                      {getUrgencyBadge(c.report?.report_due_date)}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(parseISO(c.appointment_date), 'dd MMM yyyy HH:mm')}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {c.referring_attorneys?.name || 'N/A'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalCardBody>
        </PortalCard>

        <PortalCard>
          <PortalCardHeader
            icon={FileText}
            title="Pending Reports"
            actions={
              <Button asChild variant="outline" size="sm" className="rounded-none">
                <Link to="/expert-portal/reports">View All</Link>
              </Button>
            }
          />
          <PortalCardBody className="p-0">
            {loading ? (
              <div className="px-4 py-6 text-center text-xs text-slate-500">Loading…</div>
            ) : pendingReportsList.length === 0 ? (
              <PortalEmptyState icon={CheckCircle2} title="No pending reports" description="You're all caught up." />
            ) : (
              <ul>
                {pendingReportsList.map((r) => (
                  <li
                    key={r.id}
                    className="flex cursor-pointer items-center justify-between gap-3 border-b border-black/10 px-4 py-3 last:border-b-0 transition-colors hover:bg-black/[0.03]"
                    onClick={() => navigate(`/expert-portal/case/${r.appointment_id}`)}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-black">
                        {r.appointment?.claimants?.first_name} {r.appointment?.claimants?.last_name}
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {r.appointment?.referring_attorneys?.name || 'N/A'}
                        {r.report_due_date && <> • Due: {format(parseISO(r.report_due_date), 'dd MMM')}</>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {getUrgencyBadge(r.report_due_date)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </PortalCardBody>
        </PortalCard>
      </div>

      {recentlyCompleted.length > 0 && (
        <PortalCard>
          <PortalCardHeader icon={CheckCircle2} title="Recently Completed Assessments" />
          <PortalCardBody className="p-0">
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {recentlyCompleted.map((r) => (
                <li
                  key={r.id}
                  className="cursor-pointer border-b border-r border-black/10 px-4 py-3 transition-colors hover:bg-black/[0.03]"
                  onClick={() => navigate(`/expert-portal/case/${r.appointment_id}`)}
                >
                  <p className="truncate text-sm font-medium text-black">
                    {r.appointment?.claimants?.first_name} {r.appointment?.claimants?.last_name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500">
                    {r.appointment?.referring_attorneys?.name || 'N/A'}
                    {' • '}
                    {r.report_submitted_date ? format(parseISO(r.report_submitted_date), 'dd MMM yyyy') : '—'}
                  </p>
                  {r.days_to_complete && (
                    <Badge variant="secondary" className="mt-1.5 text-[9px]">{r.days_to_complete} days to complete</Badge>
                  )}
                </li>
              ))}
            </ul>
          </PortalCardBody>
        </PortalCard>
      )}
    </PortalPage>
  );
};

export default ExpertDashboard;
