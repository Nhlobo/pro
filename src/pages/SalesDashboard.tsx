import React, { useState, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TrendingUp, Award, AlertTriangle, Eye, EyeOff, Briefcase, Users, ChevronDown, ChevronUp, CalendarIcon, History } from "lucide-react";
import { useSalesIncentives, SalesConsultant, ConsultantStrike, getTargetForConsultant, formatDateOnlyForDisplay } from '@/hooks/useSalesIncentives';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import IncentiveTable from '@/components/sales/IncentiveTable';
import IncentiveRules from '@/components/sales/IncentiveRules';
import StrikeTracker from '@/components/sales/StrikeTracker';
import TeamTargetsCard from '@/components/sales/TeamTargetsCard';

import { RandSign } from "@/components/icons/RandSign";
// This page only ever renders as a tab inside AdminAttorneyCRM (see
// SalesDashboardModule there), which is built entirely on the flat
// black/white/teal AdminUI system — not the rounded shadcn Card look this
// file previously used on its own. Pulling in the same primitives so this
// tab is visually indistinguishable from its CRM Overview / Pitchlog
// siblings, without touching any of the data/permission logic below.
import { AdminCard, AdminCardHeader, AdminCardBody, AdminStatCard, AdminPill, BRAND_TEAL } from '@/components/admin/ui/AdminUI';
const SECTION_KEYS = ['teamTargets', 'incentiveStructure', 'strikeTracker'] as const;
type SectionKey = typeof SECTION_KEYS[number];

type PendingStrikeAction =
  | { action: 'issue'; type: 'verbal' | 'written' | 'dismissal'; reason: string }
  | { action: 'override'; strike: ConsultantStrike; reason: string };

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
  const [selectedPayoutDate, setSelectedPayoutDate] = useState<Date | undefined>(new Date());
  const {
    consultant,
    strikes,
    tiers,
    allConsultants,
    allPerformance,
    allStrikes,
    dealDetails,
    loading,
    currentMonth,
    currentYear,
    periodStart,
    periodEnd,
    salesTarget,
    payoutEligibilityTarget,
    calculateIncentive,
    getCurrentPerformance,
    getActiveStrikes,
    getStrikeHistory,
    updateTier,
    issueStrike,
    overrideStrike,
  } = useSalesIncentives(selectedPayoutDate);
  const { isAdmin, userRole } = usePermissions();
  const { toast } = useToast();
  const admin = isAdmin();
  const canManageStrikes = userRole === 'admin';

  const [sectionVisibility, setSectionVisibility] = useState<Record<SectionKey, boolean>>(getInitialVisibility);
  const [selectedConsultantId, setSelectedConsultantId] = useState<string>('all');
  const [teamOverviewOpen, setTeamOverviewOpen] = useState(true);
  const [strikeType, setStrikeType] = useState<'verbal' | 'written' | 'dismissal'>('verbal');
  const [strikeReason, setStrikeReason] = useState('Admin override');
  const [strikeSaving, setStrikeSaving] = useState(false);
  const [pendingStrikeAction, setPendingStrikeAction] = useState<PendingStrikeAction | null>(null);

  const toggleSection = (key: SectionKey) => {
    setSectionVisibility(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem('sales-dashboard-sections', JSON.stringify(next));
      return next;
    });
  };

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString('default', { month: 'long' });
  const periodLabel = `${formatDateOnlyForDisplay(periodStart)} – ${formatDateOnlyForDisplay(periodEnd, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const selectedDateLabel = selectedPayoutDate?.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Select date';

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
  const viewingTarget = viewingConsultant ? getTargetForConsultant(viewingConsultant) : salesTarget;
  const progressPct = viewingTarget > 0 ? Math.min(100, (totalAppts / viewingTarget) * 100) : 0;
  const payoutUnlocked = totalAppts >= payoutEligibilityTarget;

  const viewStrikes = viewingConsultant
    ? getActiveStrikes(viewingConsultant.id)
    : strikes.filter(s => !s.expired);
  const viewStrikeHistory = viewingConsultant ? getStrikeHistory(viewingConsultant.id) : [];

  const visibleDeals = useMemo(() => {
    if (!viewingConsultant) return dealDetails;
    return dealDetails.filter(d => d.consultant_id === viewingConsultant.id);
  }, [dealDetails, viewingConsultant]);

  const handleIssueStrike = async (type: 'verbal' | 'written' | 'dismissal', reason: string) => {
    if (!viewingConsultant) return;
    if (!canManageStrikes) {
      toast({
        title: 'Admin access required',
        description: 'Only Admin users can issue strikes.',
        variant: 'destructive',
      });
      return;
    }
    setStrikeSaving(true);
    const { error } = await issueStrike(viewingConsultant.id, type, reason);
    setStrikeSaving(false);
    setPendingStrikeAction(null);
    toast({
      title: error ? 'Strike not issued' : 'Strike issued',
      description: error?.message || `${viewingConsultant.name} now has a ${type} strike for ${monthName}.`,
      variant: error ? 'destructive' : 'default',
    });
  };

  const handleOverrideStrike = async (strikeId: string, reason: string) => {
    if (!canManageStrikes) {
      toast({
        title: 'Admin access required',
        description: 'Only Admin users can override strikes.',
        variant: 'destructive',
      });
      return;
    }
    setStrikeSaving(true);
    const { error } = await overrideStrike(strikeId, reason || 'Admin override - strike removed');
    setStrikeSaving(false);
    setPendingStrikeAction(null);
    toast({
      title: error ? 'Override failed' : 'Strike overridden',
      description: error?.message || 'The strike was marked as overridden/expired.',
      variant: error ? 'destructive' : 'default',
    });
  };

  const confirmPendingStrikeAction = () => {
    if (!pendingStrikeAction) return;
    if (pendingStrikeAction.action === 'issue') {
      handleIssueStrike(pendingStrikeAction.type, pendingStrikeAction.reason);
    } else {
      handleOverrideStrike(pendingStrikeAction.strike.id, pendingStrikeAction.reason);
    }
  };

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
        target: getTargetForConsultant(c),
        targetMet: (perf?.total_appts || 0) >= getTargetForConsultant(c),
        payoutUnlocked: (perf?.total_appts || 0) >= payoutEligibilityTarget,
      };
    }).sort((a, b) => b.totalAppts - a.totalAppts);
  }, [admin, allConsultants, allPerformance, allStrikes, payoutEligibilityTarget]);

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
          <h1 className="text-2xl font-bold text-black">Sales Dashboard</h1>
          <p className="text-slate-500">
            {admin
              ? selectedConsultantId === 'all'
                ? `All Consultants • ${monthName} payout • ${periodLabel}`
                : `${viewingConsultant?.name || ''} • ${monthName} payout • ${periodLabel}`
              : `${consultant?.name || 'Loading...'} • ${monthName} payout • ${periodLabel}`
            }
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("h-9 rounded-none justify-start gap-2 text-left font-normal", !selectedPayoutDate && "text-muted-foreground")}>
                <CalendarIcon className="h-4 w-4" />
                {selectedDateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedPayoutDate}
                onSelect={(date) => date && setSelectedPayoutDate(date)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {admin ? (
            <Select value={selectedConsultantId} onValueChange={setSelectedConsultantId}>
              <SelectTrigger className="w-[220px] h-9 rounded-none">
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
              <AdminPill className="capitalize">{consultant?.type || 'N/A'}</AdminPill>
              {consultant?.region && <AdminPill tone="teal">{consultant.region}</AdminPill>}
            </>
          )}
        </div>
      </div>

      {/* Section Visibility Toggles */}
      <AdminCard>
        <AdminCardBody className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-black">Show / Hide Sections</p>
            {hiddenCount > 0 && <AdminPill>{hiddenCount} hidden</AdminPill>}
          </div>
          <div className="flex flex-wrap gap-2">
            {SECTION_KEYS.map(key => {
              const visible = sectionVisibility[key];
              return (
                <Button
                  key={key}
                  size="sm"
                  variant={visible ? 'default' : 'outline'}
                  className="h-8 rounded-none text-xs gap-1.5"
                  onClick={() => toggleSection(key)}
                >
                  {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {SECTION_LABELS[key]}
                </Button>
              );
            })}
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* Admin Team Overview Table (when "All Consultants" selected) */}
      {admin && selectedConsultantId === 'all' && (
        <AdminCard>
          <AdminCardBody className="pt-4">
            <div
              className="flex items-center justify-between cursor-pointer select-none mb-3"
              onClick={() => setTeamOverviewOpen(!teamOverviewOpen)}
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: BRAND_TEAL }} />
                <h3 className="text-lg font-semibold text-black">Team Overview — {monthName} payout • {periodLabel}</h3>
                <AdminPill>{teamData.length} consultants</AdminPill>
              </div>
              {teamOverviewOpen ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
            </div>

            {teamOverviewOpen && (
              <>
                {/* Summary tiles */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <AdminStatCard label="Total Deals" value={teamData.reduce((s, d) => s + d.totalAppts, 0)} icon={Briefcase} />
                  <AdminStatCard label="Total Earnings" value={`R${teamData.reduce((s, d) => s + d.totalEarnings, 0).toLocaleString()}`} icon={RandSign as any} />
                  <AdminStatCard label="Targets Met" value={`${teamData.filter(d => d.targetMet).length}/${teamData.length}`} icon={Award} />
                  <AdminStatCard label="Active Strikes" value={teamData.reduce((s, d) => s + d.activeStrikes, 0)} icon={AlertTriangle} />
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-black/[0.03] hover:bg-black/[0.03]">
                        <TableHead className="text-xs font-semibold text-black">Consultant</TableHead>
                        <TableHead className="text-xs font-semibold text-black text-center">Type</TableHead>
                        <TableHead className="text-xs font-semibold text-black text-center">RAF</TableHead>
                        <TableHead className="text-xs font-semibold text-black text-center">Med Neg</TableHead>
                        <TableHead className="text-xs font-semibold text-black text-center">Total Deals</TableHead>
                        <TableHead className="text-xs font-semibold text-black text-center">Earnings</TableHead>
                        <TableHead className="text-xs font-semibold text-black text-center">Strikes</TableHead>
                        <TableHead className="text-xs font-semibold text-black text-center">Target / Payout</TableHead>
                        <TableHead className="text-xs font-semibold w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamData.length > 0 ? teamData.map(d => (
                        <TableRow key={d.consultant.id}>
                          <TableCell className="font-medium text-sm">{d.consultant.name}</TableCell>
                          <TableCell className="text-center">
                            <AdminPill className="capitalize">{d.consultant.type}</AdminPill>
                          </TableCell>
                          <TableCell className="text-center text-sm font-medium" style={{ color: BRAND_TEAL }}>{d.rafAppts}</TableCell>
                          <TableCell className="text-center text-sm font-medium" style={{ color: BRAND_TEAL }}>{d.mednegAppts}</TableCell>
                          <TableCell className="text-center text-sm font-bold">{d.totalAppts}</TableCell>
                          <TableCell className="text-center text-sm font-medium">R{d.totalEarnings.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            {d.activeStrikes > 0 ? (
                              <AdminPill tone="destructive">{d.activeStrikes}</AdminPill>
                            ) : (
                              <span className="text-xs text-slate-500">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="text-[10px] text-slate-500 mb-1">Min {d.target}</div>
                            {d.targetMet ? (
                              <AdminPill tone="success">Met ✓</AdminPill>
                            ) : (
                              <AdminPill tone="destructive">Not met</AdminPill>
                            )}
                            <div className="mt-1">
                              <AdminPill tone={d.payoutUnlocked ? 'teal' : 'neutral'}>
                                Payout {d.payoutUnlocked ? 'on' : `4+`}
                              </AdminPill>
                            </div>
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
                          <TableCell colSpan={9} className="text-center text-slate-500 py-8">
                            No active sales consultants found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </AdminCardBody>
        </AdminCard>
      )}

      {/* Individual Consultant View */}
      {showIndividual && viewingConsultant && (
        <>
          {/* Admin viewing another consultant - show badge */}
          {admin && (
            <div className="flex items-center gap-2">
              <AdminPill className="capitalize">{viewingConsultant.type}</AdminPill>
              {viewingConsultant.region && <AdminPill tone="teal">{viewingConsultant.region}</AdminPill>}
              <Button size="sm" variant="ghost" className="text-xs ml-auto" onClick={() => setSelectedConsultantId('all')}>
                ← Back to Overview
              </Button>
            </div>
          )}

          {canManageStrikes && (
            <AdminCard>
              <AdminCardBody className="pt-4 space-y-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="space-y-1 md:w-44">
                    <p className="text-xs font-medium text-muted-foreground">Strike type</p>
                    <Select value={strikeType} onValueChange={(value) => setStrikeType(value as 'verbal' | 'written' | 'dismissal')}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verbal">Verbal</SelectItem>
                        <SelectItem value="written">Written</SelectItem>
                        <SelectItem value="dismissal">Dismissal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-medium text-muted-foreground">Admin reason</p>
                    <Textarea value={strikeReason} onChange={(e) => setStrikeReason(e.target.value)} className="min-h-9" />
                  </div>
                  <Button
                    onClick={() => setPendingStrikeAction({ action: 'issue', type: strikeType, reason: strikeReason || 'Admin override' })}
                    disabled={strikeSaving}
                    className="md:w-36 rounded-none"
                  >
                    Issue Strike
                  </Button>
                </div>
                {viewStrikes.length > 0 && (
                  <div className="flex flex-wrap gap-2 border-t border-black/10 pt-3">
                    {viewStrikes.map(strike => (
                      <Button
                        key={strike.id}
                        size="sm"
                        variant="outline"
                        className="rounded-none"
                        disabled={strikeSaving}
                        onClick={() => setPendingStrikeAction({ action: 'override', strike, reason: strikeReason || 'Admin override - strike removed' })}
                      >
                        Override {strike.type}
                      </Button>
                    ))}
                  </div>
                )}
              </AdminCardBody>
            </AdminCard>
          )}

          {/* Performance Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminCard className="min-w-0 overflow-hidden">
              <div className="min-w-0 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div className="rounded-full bg-black/5 p-1.5 md:p-2">
                    <Briefcase className="h-4 w-4" style={{ color: BRAND_TEAL }} />
                  </div>
                </div>
                <p className="text-xl font-bold tabular-nums text-black md:text-2xl">{totalAppts}</p>
                <p className="text-[11px] leading-tight text-slate-500">Deals Closed (Selected Period)</p>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Target: {viewingTarget}</span>
                    <span>{Math.round(progressPct)}%</span>
                  </div>
                  <Progress value={progressPct} className="h-2 rounded-none" />
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                  <span className="font-medium" style={{ color: BRAND_TEAL }}>RAF: {rafAppts}</span>
                  <span className="font-medium" style={{ color: BRAND_TEAL }}>Med Neg: {mednegAppts}</span>
                  <span>Payout from {payoutEligibilityTarget}+</span>
                </div>
              </div>
            </AdminCard>

            <AdminStatCard
              label="RAF Earnings"
              value={`R${incentive.raf.toLocaleString()}`}
              icon={TrendingUp}
              hint={`${rafAppts} deals × R${incentive.rafRate?.toLocaleString() || 0}/deal`}
            />

            <AdminStatCard
              label="Med Neg Earnings"
              value={`R${incentive.medneg.toLocaleString()}`}
              icon={Award}
              hint={`${mednegAppts} deals × R${incentive.mednegRate?.toLocaleString() || 0}/deal`}
            />

            <AdminStatCard
              label="Active Strikes"
              value={`${viewStrikes.length}/3`}
              icon={AlertTriangle}
              hint={viewStrikes.length === 0 ? 'Good standing' : `${viewStrikes.length} warning(s) active`}
            />
          </div>

          {/* Earnings Breakdown Card */}
          <AdminCard>
            <AdminCardHeader
              title={`Earnings Breakdown — ${monthName} ${currentYear}`}
              icon={RandSign as any}
              description={`Based on ${totalAppts} scheduled assessment(s) attributed to ${admin ? viewingConsultant.name : 'you'} in ${periodLabel}`}
            />
            <AdminCardBody>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Appointment Split</p>
              <div className="grid grid-cols-2 gap-3 mb-5">
                <div className="p-4 border" style={{ borderColor: `${BRAND_TEAL}40`, backgroundColor: `${BRAND_TEAL}0d` }}>
                  <p className="text-xs font-medium mb-1" style={{ color: BRAND_TEAL }}>RAF Deals</p>
                  <p className="text-3xl font-bold text-black">{rafAppts}</p>
                  <p className="text-sm text-slate-500">
                    × R{incentive.rafRate?.toLocaleString() || 0} = <span className="font-semibold" style={{ color: BRAND_TEAL }}>R{incentive.raf.toLocaleString()}</span>
                  </p>
                </div>
                <div className="p-4 border" style={{ borderColor: `${BRAND_TEAL}40`, backgroundColor: `${BRAND_TEAL}0d` }}>
                  <p className="text-xs font-medium mb-1" style={{ color: BRAND_TEAL }}>Med Neg Deals</p>
                  <p className="text-3xl font-bold text-black">{mednegAppts}</p>
                  <p className="text-sm text-slate-500">
                    × R{incentive.mednegRate?.toLocaleString() || 0} = <span className="font-semibold" style={{ color: BRAND_TEAL }}>R{incentive.medneg.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Total Payout</p>
              <p className="text-3xl font-bold text-black">R{incentive.total.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mb-3">
                Incentive tier: {incentive.label} • Based on {totalAppts} closed deal(s)
              </p>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  Target: {totalAppts >= viewingTarget ? (
                    <AdminPill tone="success">Met ✓</AdminPill>
                  ) : (
                    <AdminPill tone="destructive">Not met ✕</AdminPill>
                  )}
                </span>
                <span>
                  Incentive: {payoutUnlocked ? (
                    <span className="font-medium" style={{ color: BRAND_TEAL }}>Unlocked</span>
                  ) : (
                    <span className="font-medium text-slate-500">Locked</span>
                  )}
                </span>
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Closed deal details"
              description={`${periodLabel} • allocated by scheduled assessment consultant`}
              actions={<AdminPill>{visibleDeals.length} deals</AdminPill>}
            />
            <AdminCardBody className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-black/[0.03] hover:bg-black/[0.03]">
                      <TableHead className="text-xs font-semibold text-black">Closed</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Claimant</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Matter</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Referring Attorney</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleDeals.length > 0 ? visibleDeals.map(deal => (
                      <TableRow key={deal.appointment_id}>
                        <TableCell className="text-sm">{new Date(deal.closed_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</TableCell>
                        <TableCell className="text-sm font-medium">{deal.claimant_name}<span className="block text-[11px] text-slate-500">{deal.claimant_auto_id}</span></TableCell>
                        <TableCell className="text-sm">{deal.matter_type || 'RAF'}</TableCell>
                        <TableCell className="text-sm">{deal.referring_attorney}</TableCell>
                        <TableCell><AdminPill tone="teal">{deal.payment_status || 'Payment Received'}</AdminPill></TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-slate-500 py-8">No closed scheduled assessments found for this period</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardHeader
              title="Strike and override history"
              icon={History}
              actions={<AdminPill>{viewStrikeHistory.length} actions</AdminPill>}
            />
            <AdminCardBody className="space-y-3">
              {viewStrikeHistory.length > 0 ? viewStrikeHistory.map(item => (
                <div key={item.id} className="border border-black/10 bg-black/[0.02] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AdminPill tone={item.action === 'issued' ? 'destructive' : 'neutral'} className="capitalize">
                        {item.action}
                      </AdminPill>
                      {item.strike_type && <span className="text-sm font-semibold capitalize text-black">{item.strike_type} strike</span>}
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-slate-500 md:grid-cols-2">
                    <p>Performed by: <span className="font-medium text-black">{item.performed_by_name || 'System (automated)'}</span></p>
                    <p>Payout: <span className="font-medium text-black">{item.payout_month && item.payout_year ? `${new Date(item.payout_year, item.payout_month - 1).toLocaleString('en-ZA', { month: 'long' })} ${item.payout_year}` : 'Not linked'}</span></p>
                  </div>
                  {item.reason && <p className="mt-2 text-sm text-black break-words">{item.reason}</p>}
                </div>
              )) : (
                <div className="border border-dashed border-black/15 p-6 text-center text-sm text-slate-500">
                  No strike or override history recorded for this consultant.
                </div>
              )}
            </AdminCardBody>
          </AdminCard>
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

      <AlertDialog open={!!pendingStrikeAction} onOpenChange={(open) => !open && setPendingStrikeAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {pendingStrikeAction?.action === 'override' ? 'strike override' : 'strike issuance'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Review the selected details before submitting this admin action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingStrikeAction && viewingConsultant && (
            <div className="space-y-3 rounded-md border bg-muted/30 p-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Consultant</span><span className="font-medium text-right">{viewingConsultant.name}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Payout period</span><span className="font-medium text-right">{monthName} payout • {periodLabel}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Action</span><span className="font-medium text-right capitalize">{pendingStrikeAction.action}</span></div>
              <div className="flex justify-between gap-4"><span className="text-muted-foreground">Strike type</span><span className="font-medium text-right capitalize">{pendingStrikeAction.action === 'issue' ? pendingStrikeAction.type : pendingStrikeAction.strike.type}</span></div>
              <div className="space-y-1"><span className="text-muted-foreground">Selected reason</span><p className="font-medium text-foreground break-words">{pendingStrikeAction.reason}</p></div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={strikeSaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingStrikeAction} disabled={strikeSaving}>
              Confirm Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesDashboard;
