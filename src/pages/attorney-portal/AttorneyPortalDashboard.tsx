import React from 'react';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { useAttorneyDebts } from '@/hooks/useAttorneyDebts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { LiveCaseTracker } from '@/components/LiveCaseTracker';
import { Link } from 'react-router-dom';
import {
  Users,
  Calendar,
  Clock,
  FileText,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Wallet
} from 'lucide-react';

const AttorneyPortalDashboard: React.FC = () => {
  const { stats, liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const { debtSummary, loading: debtsLoading } = useAttorneyDebts();

  const statCards = [
    {
      title: 'Total Claimants',
      value: stats.mattersSubmitted,
      icon: Users,
      color: 'text-kutlwano-blue',
      bgColor: 'bg-kutlwano-blue/10',
      description: 'Referred claimants'
    },
    {
      title: 'Appointments Today',
      value: liveCases.filter(c => {
        const today = new Date().toDateString();
        return new Date(c.appointmentDate).toDateString() === today;
      }).length,
      icon: Calendar,
      color: 'text-kutlwano-teal',
      bgColor: 'bg-kutlwano-teal/10',
      description: 'Scheduled today'
    },
    {
      title: 'Pending Assessments',
      value: liveCases.filter(c => c.phases.some(p => p.status === 'pending')).length,
      icon: Clock,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      description: 'Awaiting assessment'
    },
    {
      title: 'Reports In Progress',
      value: stats.reportsInProgress,
      icon: FileText,
      color: 'text-info',
      bgColor: 'bg-info/10',
      description: 'Being prepared'
    },
    {
      title: 'Reports Completed',
      value: stats.reportsReadyToDownload,
      icon: CheckCircle2,
      color: 'text-success',
      bgColor: 'bg-success/10',
      description: 'Ready to download'
    },
    {
      title: 'Outstanding Balance',
      value: debtSummary ? `R${debtSummary.total_owed.toLocaleString()}` : 'R0',
      icon: Wallet,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: 'AOD balance',
      isAmount: true
    },
    {
      title: 'Deposits Received',
      value: debtSummary ? `R${debtSummary.total_deposits.toLocaleString()}` : 'R0',
      icon: DollarSign,
      color: 'text-success',
      bgColor: 'bg-success/10',
      description: 'Total deposits',
      isAmount: true
    },
    {
      title: 'Actions Needed',
      value: stats.actionsNeeded,
      icon: AlertCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      description: `${stats.missingDocuments} docs, ${stats.pendingConfirmations} confirmations`
    }
  ];

  return (
    <AttorneyPortalLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Welcome to Your Portal</h1>
          <p className="text-muted-foreground mt-1">
            Track your matters, monitor progress, and manage your cases
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, index) => (
            <Card key={index} className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {loading || debtsLoading ? '...' : stat.value}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Access Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-kutlwano-blue" />
                Upcoming Appointments
              </CardTitle>
              <CardDescription>
                {liveCases.filter(c => new Date(c.appointmentDate) >= new Date()).length} appointments scheduled
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild className="w-full">
                <Link to="/attorney-portal/appointments">
                  View All <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-kutlwano-teal" />
                Reports Ready
              </CardTitle>
              <CardDescription>
                {stats.reportsReadyToDownload} reports available for download
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/attorney-portal/reports">
                  View Reports <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50 shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-warning" />
                Payment Summary
              </CardTitle>
              <CardDescription>
                View your AOD balances and payment schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link to="/attorney-portal/payments">
                  View Payments <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Live Case Tracker */}
        <Card className="bg-gradient-card border-border/50 shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-kutlwano-blue" />
              Live Case Progress
            </CardTitle>
            <CardDescription>
              Real-time tracking of your case progress through all stages
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LiveCaseTracker 
              cases={liveCases.slice(0, 5)} 
              loading={loading} 
              onRefresh={refetchStats} 
            />
            {liveCases.length > 5 && (
              <div className="mt-4 text-center">
                <Button asChild variant="outline">
                  <Link to="/attorney-portal/cases">
                    View All {liveCases.length} Cases
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AttorneyPortalLayout>
  );
};

export default AttorneyPortalDashboard;
