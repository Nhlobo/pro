import React, { useMemo } from 'react';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { useAttorneyDebts } from '@/hooks/useAttorneyDebts';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { LiveCaseTracker } from '@/components/LiveCaseTracker';
import { Link } from 'react-router-dom';
import { format, isToday, isTomorrow } from 'date-fns';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalStatTile,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalEmptyState,
  AlertStrip,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { Button } from '@/components/ui/button';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Wallet,
  Scale,
  BookOpen,
  CalendarCheck,
} from 'lucide-react';

/** "Today, 2:30 PM" / "Tomorrow, 9:00 AM" / "12 Aug, 9:00 AM" — same idea
 *  AttorneyAppointments.tsx uses (isToday/isTomorrow), so a date here reads
 *  the same way it will on the Appointments page itself. */
function formatWhen(dateStr: string): string {
  const d = new Date(dateStr);
  const time = format(d, 'h:mm a');
  if (isToday(d)) return `Today, ${time}`;
  if (isTomorrow(d)) return `Tomorrow, ${time}`;
  return `${format(d, 'd MMM')}, ${time}`;
}

const AttorneyPortalDashboard: React.FC = () => {
  const { stats, liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const { debtSummary, debtCases, loading: debtsLoading } = useAttorneyDebts();

  // ---- Derived case-stage counts (drive the KPI panel) -----------------
  const litigationReadyCases = liveCases.filter((c) =>
    c.phases.every((p) => p.status === 'completed')
  ).length;

  const bookingStageCases = liveCases.filter((c) => {
    const completedCount = c.phases.filter((p) => p.status === 'completed').length;
    return completedCount <= 2;
  }).length;

  const reportsOutstanding = liveCases.filter((c) => {
    const reportPhase = c.phases.find((p) => p.name === 'Report Ready');
    return reportPhase?.status !== 'completed';
  }).length;

  // ---- Next appointments: real rows, not a link to the Appointments page
  const nextAppointments = useMemo(() => {
    const now = new Date();
    return liveCases
      .filter((c) => c.appointmentDate && new Date(c.appointmentDate) >= now)
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime())
      .slice(0, 4);
  }, [liveCases]);

  // ---- Reports that actually finished this cycle, not a count -----------
  const recentlyReadyReports = useMemo(() => {
    return liveCases
      .filter((c) => c.phases.find((p) => p.name === 'Report Ready')?.status === 'completed')
      .sort((a, b) => {
        const ad = a.phases.find((p) => p.name === 'Report Ready')?.completedAt || '';
        const bd = b.phases.find((p) => p.name === 'Report Ready')?.completedAt || '';
        return new Date(bd).getTime() - new Date(ad).getTime();
      })
      .slice(0, 4);
  }, [liveCases]);

  // ---- Accounts actually at risk, ranked by what's overdue longest -----
  const atRiskAccounts = useMemo(() => {
    return [...debtCases]
      .filter((d) => d.amount_due > 0)
      .sort((a, b) => b.days_pending - a.days_pending)
      .slice(0, 4);
  }, [debtCases]);

  const isLoading = loading || debtsLoading;
  const hasOutstandingBalance = !!debtSummary && debtSummary.total_owed > 0;

  const statTiles: PortalStatTile[] = [
    { label: 'Total Active Cases', value: liveCases.length, icon: Briefcase, hint: 'All referred cases' },
    { label: 'Booking Stage', value: bookingStageCases, icon: BookOpen, hint: 'Awaiting scheduling' },
    { label: 'Reports Outstanding', value: reportsOutstanding, icon: Clock, hint: 'Not yet ready' },
    { label: 'Litigation Ready', value: litigationReadyCases, icon: Scale, hint: 'All reports submitted' },
    { label: 'Reports In Progress', value: stats.reportsInProgress, icon: FileText, hint: 'Being prepared' },
    { label: 'Reports Completed', value: stats.reportsReadyToDownload, icon: CheckCircle2, hint: 'Ready to download' },
    {
      label: 'Outstanding Balance',
      value: debtSummary ? `R${debtSummary.total_owed.toLocaleString()}` : 'R0',
      icon: Wallet,
      hint: 'AOD balance due',
      urgent: hasOutstandingBalance,
    },
    {
      label: 'Actions Needed',
      value: stats.actionsNeeded,
      icon: AlertCircle,
      hint: `${stats.missingDocuments} docs · ${stats.pendingConfirmations} confirmations`,
      urgent: stats.actionsNeeded > 0,
    },
  ];

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader
          eyebrow="Overview"
          title="Dashboard"
          description="Your active caseload, appointments, and account status, updated in real time."
          icon={LayoutDashboard}
          actions={<SyncStatus loading={isLoading} onRefresh={refetchStats} label="Live data" />}
        />

        {!isLoading && stats.actionsNeeded > 0 && (
          <AlertStrip
            icon={AlertCircle}
            tone="warning"
            title={`${stats.actionsNeeded} action${stats.actionsNeeded === 1 ? '' : 's'} need your attention`}
            description={`${stats.missingDocuments} case${stats.missingDocuments === 1 ? '' : 's'} missing documents, ${stats.pendingConfirmations} confirmation${stats.pendingConfirmations === 1 ? '' : 's'} pending.`}
            action={
              <Button asChild size="sm" variant="outline" className="rounded-none">
                <Link to="/attorney-portal/notifications">Review</Link>
              </Button>
            }
          />
        )}

        {/* KPI panel — one bordered ledger, not eight floating cards.
            Informational only: these numbers are read here so you don't
            have to open every page to know where things stand. */}
        <PortalStatStrip tiles={statTiles} loading={isLoading} />

        {/* Primary content */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <PortalCard>
              <PortalCardHeader
                icon={TrendingUp}
                title="Live Case Progress"
                description="Real-time tracking of your case progress through all stages"
              />
              <PortalCardBody>
                <LiveCaseTracker cases={liveCases.slice(0, 5)} loading={loading} onRefresh={refetchStats} />
                {liveCases.length > 5 && (
                  <div className="mt-4 text-center">
                    <Button asChild variant="outline" className="rounded-none">
                      <Link to="/attorney-portal/cases">View All {liveCases.length} Cases</Link>
                    </Button>
                  </div>
                )}
              </PortalCardBody>
            </PortalCard>
          </div>

          {/* Right column: real, computed content — each panel shows the
              actual rows behind its number. A "View all" only appears when
              there are more rows than fit here; that's continuing the same
              data, not re-pointing at a sidebar link. */}
          <div className="space-y-4 md:space-y-6 lg:col-span-1">
            <PortalCard>
              <PortalCardHeader icon={CalendarCheck} title="Next Appointments" />
              <PortalCardBody className="p-0">
                {loading ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">Loading…</div>
                ) : nextAppointments.length === 0 ? (
                  <PortalEmptyState icon={Calendar} title="Nothing scheduled" description="No upcoming appointments right now." />
                ) : (
                  <ul>
                    {nextAppointments.map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-2.5 last:border-b-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-black">{c.claimantName}</p>
                          <p className="truncate text-[11px] text-slate-500">{c.expertType}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-medium" style={{ color: BRAND_TEAL }}>
                          {formatWhen(c.appointmentDate)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {liveCases.filter((c) => new Date(c.appointmentDate) >= new Date()).length > nextAppointments.length && (
                  <Link
                    to="/attorney-portal/appointments"
                    className="block border-t border-black/10 px-4 py-2 text-center text-xs font-medium hover:bg-black/5"
                    style={{ color: BRAND_TEAL }}
                  >
                    View all upcoming
                  </Link>
                )}
              </PortalCardBody>
            </PortalCard>

            <PortalCard>
              <PortalCardHeader icon={FileText} title="Recently Ready Reports" />
              <PortalCardBody className="p-0">
                {loading ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">Loading…</div>
                ) : recentlyReadyReports.length === 0 ? (
                  <PortalEmptyState icon={FileText} title="None ready yet" description="Reports will appear here as they're completed." />
                ) : (
                  <ul>
                    {recentlyReadyReports.map((c) => {
                      const completedAt = c.phases.find((p) => p.name === 'Report Ready')?.completedAt;
                      return (
                        <li key={c.id} className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-2.5 last:border-b-0">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-black">{c.claimantName}</p>
                            <p className="truncate text-[11px] text-slate-500">{c.expertType}</p>
                          </div>
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label={completedAt ? format(new Date(completedAt), 'd MMM') : 'Ready'} />
                        </li>
                      );
                    })}
                  </ul>
                )}
                {stats.reportsReadyToDownload > recentlyReadyReports.length && (
                  <Link
                    to="/attorney-portal/reports"
                    className="block border-t border-black/10 px-4 py-2 text-center text-xs font-medium hover:bg-black/5"
                    style={{ color: BRAND_TEAL }}
                  >
                    View all {stats.reportsReadyToDownload} reports
                  </Link>
                )}
              </PortalCardBody>
            </PortalCard>

            <PortalCard>
              <PortalCardHeader icon={Wallet} title="Accounts At Risk" description="Oldest outstanding balances first" />
              <PortalCardBody className="p-0">
                {debtsLoading ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-500">Loading…</div>
                ) : atRiskAccounts.length === 0 ? (
                  <PortalEmptyState icon={CheckCircle2} title="All accounts settled" description="No outstanding AOD balances." />
                ) : (
                  <ul>
                    {atRiskAccounts.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-3 border-b border-black/10 px-4 py-2.5 last:border-b-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-black">{d.claimant_name}</p>
                          <p className="truncate text-[11px] text-slate-500">{d.days_pending} days pending</p>
                        </div>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                          R{d.amount_due.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {debtCases.filter((d) => d.amount_due > 0).length > atRiskAccounts.length && (
                  <Link
                    to="/attorney-portal/payments"
                    className="block border-t border-black/10 px-4 py-2 text-center text-xs font-medium hover:bg-black/5"
                    style={{ color: BRAND_TEAL }}
                  >
                    View all outstanding
                  </Link>
                )}
              </PortalCardBody>
            </PortalCard>
          </div>
        </div>
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

export default AttorneyPortalDashboard;
