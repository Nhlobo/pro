import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Target, Award, AlertTriangle, Calendar } from 'lucide-react';
import { useSalesIncentives } from '@/hooks/useSalesIncentives';
import { usePermissions } from '@/hooks/usePermissions';
import IncentiveTable from '@/components/sales/IncentiveTable';
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
  } = useSalesIncentives();

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

        {/* Personal Performance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Summary
            </CardTitle>
            <CardDescription>Your tier: {incentive.label} • Total incentive: R{incentive.total.toLocaleString()}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{totalAppts}</p>
                <p className="text-xs text-muted-foreground">Total Appts</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{currentPerf?.raf_appts || 0}</p>
                <p className="text-xs text-muted-foreground">RAF</p>
              </div>
              <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/30">
                <p className="text-2xl font-bold text-teal-600 dark:text-teal-400">{currentPerf?.medneg_appts || 0}</p>
                <p className="text-xs text-muted-foreground">Med Neg</p>
              </div>
              <div className="p-3 rounded-lg bg-muted">
                <Badge variant={totalAppts >= TARGET_APPOINTMENTS ? 'default' : 'destructive'}>
                  {totalAppts >= TARGET_APPOINTMENTS ? 'Target Met ✓' : 'Below Target'}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">Status</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Incentive Table & Strike Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncentiveTable
            tiers={tiers}
            activeAppointments={totalAppts}
            consultantType={consultant?.type as 'internal' | 'external' || 'internal'}
          />
          <StrikeTracker strikes={strikes} />
      </div>
    </div>
  );
};

export default SalesDashboard;
