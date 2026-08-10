import React from 'react';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { useAttorneyDebts } from '@/hooks/useAttorneyDebts';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { LiveCaseTracker } from '@/components/LiveCaseTracker';
import { Link } from 'react-router-dom';
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatCard,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  QuickLinkRow,
  AlertStrip,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

const AttorneyPortalDashboard: React.FC = () => {
  const { stats, liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const { debtSummary, loading: debtsLoading } = useAttorneyDebts();

  // Derive litigation-ready cases (all phases completed / report ready)
  const litigationReadyCases = liveCases.filter((c) =>
    c.phases.every((p) => p.status === 'completed')
  ).length;

  // Cases in booking stage (pending or only referral received)
  const bookingStageCases = liveCases.filter((c) => {
    const completedCount = c.phases.filter((p) => p.status === 'completed').length;
    return completedCount <= 2; // Referral Received + maybe Documents Verified
  }).length;

  // Reports outstanding
  const reportsOutstanding = liveCases.filter((c) => {
    const reportPhase = c.phases.find((p) => p.name === 'Report Ready');
    return reportPhase?.status !== 'completed';
  }).length;

  const upcomingAppointments = liveCases.filter(
    (c) => new Date(c.appointmentDate) >= new Date()
  ).length;

  const isLoading = loading || debtsLoading;
  const hasOutstandingBalance = !!debtSummary && debtSummary.total_owed > 0;

  const statTiles: {
    label: string;
    value: React.ReactNode;
    icon: typeof Briefcase;
    hint?: string;
    href?: string;
    urgent?: boolean;
  }[] = [
    {
      label: 'Total Active Cases',
      value: liveCases.length,
      icon: Briefcase,
      hint: 'All referred cases',
      href: '/attorney-portal/cases',
    },
    {
      label: 'Booking Stage',
      value: bookingStageCases,
      icon: BookOpen,
      hint: 'Awaiting scheduling',
      href: '/attorney-portal/appointments',
    },
    {
      label: 'Reports Outstanding',
      value: reportsOutstanding,
      icon: Clock,
      hint: 'Not yet ready',
      href: '/attorney-portal/case-status',
    },
    {
      label: 'Litigation Ready',
      value: litigationReadyCases,
      icon: Scale,
      hint: 'All reports submitted',
      href: '/attorney-portal/cases',
    },
    {
      label: 'Reports In Progress',
      value: stats.reportsInProgress,
      icon: FileText,
      hint: 'Being prepared',
      href: '/attorney-portal/reports',
    },
    {
      label: 'Reports Completed',
      value: stats.reportsReadyToDownload,
      icon: CheckCircle2,
      hint: 'Ready to download',
      href: '/attorney-portal/reports',
    },
    {
      label: 'Outstanding Balance',
      value: debtSummary ? `R${debtSummary.total_owed.toLocaleString()}` : 'R0',
      icon: Wallet,
      hint: 'AOD balance due',
      href: '/attorney-portal/payments',
      urgent: hasOutstandingBalance,
    },
    {
      label: 'Actions Needed',
      value: stats.actionsNeeded,
      icon: AlertCircle,
      hint: `${stats.missingDocuments} docs · ${stats.pendingConfirmations} confirmations`,
      href: '/attorney-portal/notifications',
      urgent: stats.actionsNeeded > 0,
    },
  ];

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader
          eyebrow="Attorney Portal"
          title="Dashboard"
          description="Track your matters, monitor progress, and manage your cases."
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

        {/* KPI panel */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {statTiles.map((tile) => (
            <PortalStatCard
              key={tile.label}
              icon={tile.icon}
              label={tile.label}
              value={tile.value}
              hint={tile.hint}
              loading={isLoading}
              href={tile.href}
              urgent={tile.urgent}
            />
          ))}
        </div>

        {/* Primary content: live case tracker + compact quick-access panel */}
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

          <div className="lg:col-span-1">
            <PortalCard>
              <PortalCardHeader title="Quick Access" description="Jump to a section" />
              <QuickLinkRow
                icon={Calendar}
                title="Upcoming Appointments"
                subtitle={`${upcomingAppointments} scheduled`}
                href="/attorney-portal/appointments"
              />
              <QuickLinkRow
                icon={FileText}
                title="Reports Ready"
                subtitle={`${stats.reportsReadyToDownload} available to download`}
                href="/attorney-portal/reports"
              />
              <QuickLinkRow
                icon={Wallet}
                title="Payment Summary"
                subtitle="AOD balances & payment schedule"
                href="/attorney-portal/payments"
              />
              <QuickLinkRow
                icon={Scale}
                title="My Cases"
                subtitle={`${liveCases.length} total cases`}
                href="/attorney-portal/cases"
              />
            </PortalCard>
          </div>
        </div>
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

export default AttorneyPortalDashboard;
