import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { TrendingUp, Target, Award, AlertTriangle, Calendar, Eye, EyeOff, Briefcase, DollarSign } from 'lucide-react';
import { useSalesIncentives } from '@/hooks/useSalesIncentives';
import { usePermissions } from '@/hooks/usePermissions';
import IncentiveTable from '@/components/sales/IncentiveTable';
import StrikeTracker from '@/components/sales/StrikeTracker';
import TeamTargetsCard from '@/components/sales/TeamTargetsCard';

const TARGET_APPOINTMENTS = 7;

const SECTION_KEYS = ['teamTargets', 'incentiveStructure', 'strikeTracker'] as const;
type SectionKey = typeof SECTION_KEYS[number];

const SECTION_LABELS: Record<SectionKey, string> = {
  teamTargets: 'Team Targets',
  incentiveStructure: 'Incentive Structure',
  strikeTracker: 'Strike Tracker',
};

const getInitialVisibility = (): Record<SectionKey, boolean> => {
  try {
    const saved = localStorage.getItem('sales-dashboard-sections');
    if (saved) return JSON.parse(saved);
  } catch {}
  return { teamTargets: false, incentiveStructure: false, strikeTracker: false };
};

const SalesDashboard: React.FC = () => {
  const {
    consultant,
    performance,
    strikes,
    tiers,
    allConsultants,
    allPerformance,
    loading,
    currentMonth,
    currentYear,
    calculateIncentive,
    getCurrentPerformance,
    updateTier,
  } = useSalesIncentives();
  const { isAdmin } = usePermissions();

  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionKey, boolean>>(getInitialVisibility);

  const toggleSection = (key: SectionKey) => {
    setSectionVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sales-dashboard-sections', JSON.stringify(next));
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const currentPerf = consultant ? getCurrentPerformance(consultant.id) : undefined;
  const rafAppts = currentPerf?.raf_appts || 0;
  const mednegAppts = currentPerf?.medneg_appts || 0;
  const totalAppts = currentPerf?.total_appts || 0;
  const incentive = consultant
    ? calculateIncentive(totalAppts, consultant.type as 'internal' | 'external', rafAppts, mednegAppts)
    : { raf: 0, medneg: 0, total: 0, label: 'None', rafRate: 0, mednegRate: 0 };
  const progressPct = Math.min(100, (totalAppts / TARGET_APPOINTMENTS) * 100);
  const activeStrikes = strikes.filter(s => !s.expired);
  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });

  const hiddenCount = SECTION_KEYS.filter(k => !sectionVisibility[k]).length;

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

      {/* Section Visibility Toggles */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-foreground">Show / Hide Sections</p>
            {hiddenCount > 0 && (
              <Badge variant="outline" className="text-[10px]">{hiddenCount} hidden</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {SECTION_KEYS.map(key => {
              const visible = sectionVisibility[key];
              return (
                <Button
                  key={key}
                  size="sm"
                  variant={visible ? 'default' : 'outline'}
                  className="h-8 text-xs gap-1.5"
                  onClick={() => toggleSection(key)}
                >
                  {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {SECTION_LABELS[key]}
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Deals Closed (This Month)</p>
                <p className="text-3xl font-bold">{totalAppts}</p>
              </div>
              <Briefcase className="h-8 w-8 text-primary opacity-70" />
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Target: {TARGET_APPOINTMENTS}</span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
            </div>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <span className="text-blue-600 dark:text-blue-400 font-medium">RAF: {rafAppts}</span>
              <span className="text-teal-600 dark:text-teal-400 font-medium">Med Neg: {mednegAppts}</span>
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
              {rafAppts} deals × R{incentive.rafRate?.toLocaleString() || 0}/deal
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
              {mednegAppts} deals × R{incentive.mednegRate?.toLocaleString() || 0}/deal
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
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Earnings Breakdown — {monthName} {currentYear}</h3>
          </div>

          <p className="text-[11px] text-muted-foreground mb-3">
            Based on <strong>{totalAppts}</strong> scheduled assessment(s) attributed to you this month
          </p>
          
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Appointment Split</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">RAF Deals</p>
              <p className="text-3xl font-bold text-foreground">{rafAppts}</p>
              <p className="text-sm text-muted-foreground">
                × R{incentive.rafRate?.toLocaleString() || 0} = <span className="font-semibold text-blue-600 dark:text-blue-400">R{incentive.raf.toLocaleString()}</span>
              </p>
            </div>
            <div className="p-4 rounded-lg border border-teal-200 bg-teal-50 dark:bg-teal-950/30 dark:border-teal-800">
              <p className="text-xs font-medium text-teal-600 dark:text-teal-400 mb-1">Med Neg Deals</p>
              <p className="text-3xl font-bold text-foreground">{mednegAppts}</p>
              <p className="text-sm text-muted-foreground">
                × R{incentive.mednegRate?.toLocaleString() || 0} = <span className="font-semibold text-teal-600 dark:text-teal-400">R{incentive.medneg.toLocaleString()}</span>
              </p>
            </div>
          </div>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Total Payout</p>
          <p className="text-3xl font-bold text-foreground">R{incentive.total.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground mb-3">
            Incentive tier: {incentive.label} • Based on {totalAppts} closed deal(s)
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

      {/* Team Targets */}
      {sectionVisibility.teamTargets && (
        <TeamTargetsCard
          consultants={allConsultants}
          allPerformance={allPerformance}
          isAdmin={isAdmin()}
        />
      )}

      {/* Incentive Table & Strike Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sectionVisibility.incentiveStructure && (
          <IncentiveTable
            tiers={tiers}
            isAdmin={isAdmin()}
            onUpdateTier={updateTier}
          />
        )}
        {sectionVisibility.strikeTracker && (
          <StrikeTracker strikes={strikes} />
        )}
      </div>
    </div>
  );
};

export default SalesDashboard;
