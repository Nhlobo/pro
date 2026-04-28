import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TrendingUp, Award, AlertTriangle, Eye, EyeOff, Briefcase, DollarSign, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { useSalesIncentives, SalesConsultant } from '@/hooks/useSalesIncentives';
import { usePermissions } from '@/hooks/usePermissions';
import IncentiveTable from '@/components/sales/IncentiveTable';
import IncentiveRules from '@/components/sales/IncentiveRules';
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
    strikes,
    tiers,
    allConsultants,
    allPerformance,
    allStrikes,
    loading,
    currentMonth,
    currentYear,
    periodStart,
    periodEnd,
    calculateIncentive,
    getCurrentPerformance,
    getActiveStrikes,
    updateTier,
  } = useSalesIncentives();
  const { isAdmin } = usePermissions();
  const admin = isAdmin();

  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionKey, boolean>>(getInitialVisibility);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>('all');
  const [teamOverviewOpen, setTeamOverviewOpen] = useState(true);

  const toggleSection = (key: SectionKey) => {
    setSectionVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sales-dashboard-sections', JSON.stringify(next));
      return next;
    });
  };

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });
  const periodLabel = `${new Date(periodStart).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })} – ${new Date(periodEnd).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`;

  // Determine which consultant to display
  const viewingConsultant: SalesConsultant | null = useMemo(() => {
    if (!admin) return consultant;
    if (selectedConsultantId === 'all') return null;
    return allConsultants.find(c => c.id === selectedConsultantId) || null;
  }, [admin, consultant, selectedConsultantId, allConsultants]);

  // Compute stats for the viewed consultant
  const viewPerf = viewingConsultant ? getCurrentPerformance(viewingConsultant.id) : undefined;
  const rafAppts = viewPerf?.raf_appts || 0;
  const mednegAppts = viewPerf?.medneg_appts || 0;
  const totalAppts = viewPerf?.total_appts || 0;
  const incentive = viewingConsultant
    ? calculateIncentive(totalAppts, viewingConsultant.type as 'internal' | 'external', rafAppts, mednegAppts)
    : { raf: 0, medneg: 0, total: 0, label: 'None', rafRate: 0, mednegRate: 0 };
  const progressPct = Math.min(100, (totalAppts / TARGET_APPOINTMENTS) * 100);

  const viewStrikes = viewingConsultant
    ? getActiveStrikes(viewingConsultant.id)
    : strikes.filter(s => !s.expired);

  // Team overview data for admin
  const teamData = useMemo(() => {
    if (!admin) return [];
    return allConsultants.map(c => {
      const perf = getCurrentPerformance(c.id);
      const activeStrikesCount = getActiveStrikes(c.id).length;
      const cIncentive = calculateIncentive(
        perf?.total_appts || 0,
        c.type as 'internal' | 'external',
        perf?.raf_appts || 0,
        perf?.medneg_appts || 0
      );
      return {
        consultant: c,
        totalAppts: perf?.total_appts || 0,
        rafAppts: perf?.raf_appts || 0,
        mednegAppts: perf?.medneg_appts || 0,
        totalEarnings: cIncentive.total,
        activeStrikes: activeStrikesCount,
        targetMet: (perf?.total_appts || 0) >= TARGET_APPOINTMENTS,
      };
    }).sort((a, b) => b.totalAppts - a.totalAppts);
  }, [admin, allConsultants, allPerformance, allStrikes]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const hiddenCount = SECTION_KEYS.filter(k => !sectionVisibility[k]).length;
  const showIndividual = !admin || selectedConsultantId !== 'all';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Sales Dashboard</h1>
          <p className="text-muted-foreground">
            {admin
              ? selectedConsultantId === 'all'
                ? `All Consultants • ${monthName} payout • ${periodLabel}`
                : `${viewingConsultant?.name || ''} • ${monthName} payout • ${periodLabel}`
              : `${consultant?.name || 'Loading...'} • ${monthName} payout • ${periodLabel}`
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          {admin ? (
            <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId}>
              <SelectTrigger className="w-[220px] h-9">
                <SelectValue placeholder="Select consultant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Consultants (Overview)</SelectItem>
                {allConsultants.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <>
              <Badge variant="outline" className="capitalize">{consultant?.type || 'N/A'}</Badge>
              {consultant?.region && <Badge variant="secondary">{consultant.region}</Badge>}
            </>
          )}
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

      {/* Admin Team Overview Table (when "All Consultants" selected) */}
      {admin && selectedConsultantId === 'all' && (
        <Card>
          <CardContent className="pt-4">
            <div
              className="flex items-center justify-between cursor-pointer select-none mb-3"
              onClick={() => setTeamOverviewOpen(!teamOverviewOpen)}
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">Team Overview — {monthName} payout</h3>
                <Badge variant="outline" className="text-[10px]">{teamData.length} consultants</Badge>
              </div>
              {teamOverviewOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>

            {teamOverviewOpen && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-[11px] text-muted-foreground">Total Deals</p>
                    <p className="text-2xl font-bold text-foreground">{teamData.reduce((s, d) => s + d.totalAppts, 0)}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-[11px] text-muted-foreground">Total Earnings</p>
                    <p className="text-2xl font-bold text-foreground">R{teamData.reduce((s, d) => s + d.totalEarnings, 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-[11px] text-muted-foreground">Targets Met</p>
                    <p className="text-2xl font-bold text-foreground">{teamData.filter(d => d.targetMet).length}/{teamData.length}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <p className="text-[11px] text-muted-foreground">Active Strikes</p>
                    <p className="text-2xl font-bold text-foreground">{teamData.reduce((s, d) => s + d.activeStrikes, 0)}</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="text-xs font-semibold">Consultant</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Type</TableHead>
                        <TableHead className="text-xs font-semibold text-center">RAF</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Med Neg</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Total Deals</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Earnings</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Strikes</TableHead>
                        <TableHead className="text-xs font-semibold text-center">Target</TableHead>
                        <TableHead className="text-xs font-semibold w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamData.length > 0 ? teamData.map(d => (
                        <TableRow key={d.consultant.id} className="hover:bg-muted/30">
                          <TableCell className="font-medium text-sm">{d.consultant.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="text-[10px] capitalize">{d.consultant.type}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm text-blue-600 dark:text-blue-400 font-medium">{d.rafAppts}</TableCell>
                          <TableCell className="text-center text-sm text-teal-600 dark:text-teal-400 font-medium">{d.mednegAppts}</TableCell>
                          <TableCell className="text-center text-sm font-bold">{d.totalAppts}</TableCell>
                          <TableCell className="text-center text-sm font-medium">R{d.totalEarnings.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            {d.activeStrikes > 0 ? (
                              <Badge variant="destructive" className="text-[10px]">{d.activeStrikes}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {d.targetMet ? (
                              <Badge variant="default" className="text-[10px]">Met ✓</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">Not met</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() => setSelectedConsultantId(d.consultant.id)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No active sales consultants found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Individual Consultant View */}
      {showIndividual && viewingConsultant && (
        <>
          {/* Admin viewing another consultant - show badge */}
          {admin && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="capitalize">{viewingConsultant.type}</Badge>
              {viewingConsultant.region && <Badge variant="secondary">{viewingConsultant.region}</Badge>}
              <Button size="sm" variant="ghost" className="text-xs ml-auto" onClick={() => setSelectedConsultantId('all')}>
                ← Back to Overview
              </Button>
            </div>
          )}

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
                    <p className="text-3xl font-bold">{viewStrikes.length}/3</p>
                  </div>
                  <AlertTriangle className={`h-8 w-8 opacity-70 ${viewStrikes.length > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {viewStrikes.length === 0 ? 'Good standing' : `${viewStrikes.length} warning(s) active`}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Earnings Breakdown Card */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-4">
                <DollarSign className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">
                  Earnings Breakdown — {monthName} {currentYear}
                </h3>
              </div>

              <p className="text-[11px] text-muted-foreground mb-3">
                Based on <strong>{totalAppts}</strong> scheduled assessment(s) attributed to {admin ? viewingConsultant.name : 'you'} this month
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
        </>
      )}

      {/* Team Targets */}
      {sectionVisibility.teamTargets && (
        <TeamTargetsCard
          consultants={allConsultants}
          allPerformance={allPerformance}
          isAdmin={admin}
        />
      )}

      {/* Incentive Structure & Rules Side by Side */}
      {sectionVisibility.incentiveStructure && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IncentiveTable
            tiers={tiers}
            isAdmin={admin}
            onUpdateTier={updateTier}
          />
          <IncentiveRules />
        </div>
      )}

      {/* Strike Tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {sectionVisibility.strikeTracker && (
          <StrikeTracker
            strikes={viewingConsultant
              ? (allStrikes.length > 0 ? allStrikes : strikes).filter(s => s.consultant_id === viewingConsultant.id)
              : strikes
            }
          />
        )}
      </div>
    </div>
  );
};

export default SalesDashboard;
