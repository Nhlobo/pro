import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Award, AlertTriangle, Calendar } from 'lucide-react';
import { useSalesIncentives } from '@/hooks/useSalesIncentives';
import { usePermissions } from '@/hooks/usePermissions';
import IncentiveTable from '@/components/sales/IncentiveTable';
import IncentiveSimulator from '@/components/sales/IncentiveSimulator';
import StrikeTracker from '@/components/sales/StrikeTracker';

const TARGET_APPOINTMENTS = 7;

const SalesDashboard: React.FC = () => {
  const {
    consultant,
    performance,
    strikes,
    tiers,
    loading,
    currentMonth,
    currentYear,
    calculateIncentive,
    getCurrentPerformance,
    updateTier,
  } = useSalesIncentives();
  const { isAdmin } = usePermissions();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const currentPerf = consultant ? getCurrentPerformance(consultant.id) : undefined;
  const totalAppts = currentPerf?.total_appts || 0;
  const incentive = consultant ? calculateIncentive(totalAppts, consultant.type as 'internal' | 'external') : { raf: 0, medneg: 0, total: 0, label: 'None' };
  const progressPct = Math.min(100, (totalAppts / TARGET_APPOINTMENTS) * 100);
  const activeStrikes = strikes.filter(s => !s.expired);
  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales Dashboard</h1>
            <p className="text-muted-foreground">
              {consultant?.name || 'Loading...'} • {monthName} {currentYear}
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="capitalize">{consultant?.type || 'N/A'}</Badge>
            {consultant?.region && <Badge variant="secondary">{consultant.region}</Badge>}
          </div>
        </div>

        {/* Performance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Appointments</p>
                  <p className="text-3xl font-bold">{totalAppts}</p>
                </div>
                <Calendar className="h-8 w-8 text-primary opacity-70" />
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Target: {TARGET_APPOINTMENTS}</span>
                  <span>{Math.round(progressPct)}%</span>
                </div>
                <Progress value={progressPct} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">RAF Earnings</p>
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    R{incentive.raf.toLocaleString()}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500 opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {currentPerf?.raf_appts || 0} RAF appointments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Med Neg Earnings</p>
                  <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">
                    R{incentive.medneg.toLocaleString()}
                  </p>
                </div>
                <Award className="h-8 w-8 text-teal-500 opacity-70" />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {currentPerf?.medneg_appts || 0} Med Neg appointments
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Strikes</p>
                  <p className="text-3xl font-bold">{activeStrikes.length}/3</p>
                </div>
                <AlertTriangle className={`h-8 w-8 opacity-70 ${activeStrikes.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {activeStrikes.length === 0 ? 'Good standing' : `${activeStrikes.length} warning(s) active`}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Earnings Breakdown Card */}
        <Card>
          <CardContent className="pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">My earnings breakdown — this month</h3>
            
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Appointment Split</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">RAF</p>
                <p className="text-3xl font-bold text-foreground">{currentPerf?.raf_appts || 0}</p>
                <p className="text-sm text-muted-foreground">R{incentive.raf.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-800">
                <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-1">Medical negligence</p>
                <p className="text-3xl font-bold text-foreground">{currentPerf?.medneg_appts || 0}</p>
                <p className="text-sm text-muted-foreground">R{incentive.medneg.toLocaleString()}</p>
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Payout</p>
            <p className="text-3xl font-bold text-foreground">R{incentive.total.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mb-3">
              Fixed monthly bonus — {incentive.label}
            </p>
            <div className="flex items-center gap-4 text-sm">
              <span>
                Target: {totalAppts >= TARGET_APPOINTMENTS ? (
                  <Badge variant="default" className="ml-1">Met ✓</Badge>
                ) : (
                  <Badge variant="destructive" className="ml-1">Not met ✕</Badge>
                )}
              </span>
              <span>
                Incentive: {totalAppts >= TARGET_APPOINTMENTS ? (
                  <span className="font-medium text-primary">Unlocked</span>
                ) : (
                  <span className="font-medium text-muted-foreground">Locked</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Incentive Simulator */}
        <IncentiveSimulator tiers={tiers} targetAppointments={TARGET_APPOINTMENTS} consultants={allConsultants} />

        {/* Incentive Table & Strike Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncentiveTable
            tiers={tiers}
            activeAppointments={totalAppts}
            consultantType={consultant?.type as 'internal' | 'external' || 'internal'}
            showBothTypes={true}
            isAdmin={isAdmin()}
            onUpdateTier={updateTier}
          />
          <StrikeTracker strikes={strikes} />
        </div>
    </div>
  );
};

export default SalesDashboard;
