import React, { useState, useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { TrendingUp, Award, AlertTriangle, Eye, EyeOff, Briefcase, Users, ChevronDown, ChevronUp, CalendarIcon, History, MapPin, Home } from "lucide-react";
import { Link } from 'react-router-dom';
import { useSalesIncentives, SalesConsultant, ConsultantStrike, getTargetForConsultant, formatDateOnlyForDisplay } from '@/hooks/useSalesIncentives';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import IncentiveTable from '@/components/sales/IncentiveTable';
import IncentiveRules from '@/components/sales/IncentiveRules';
import StrikeTracker from '@/components/sales/StrikeTracker';
import TeamTargetsCard from '@/components/sales/TeamTargetsCard';
import { RandSign } from "@/components/icons/RandSign";
import { AdminCard, AdminCardBody, AdminPill, BRAND_TEAL } from '@/components/admin/ui/AdminUI';

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

interface SalesDashboardProps {
  /** True when rendered inside the Admin Attorney CRM (directly, or nested
   *  inside the embedded Pitchlog). Hides the "Home" link, which is
   *  redundant once the CRM's own header/tabs already provide navigation. */
  embedded?: boolean;
}

/** Small flat metric tile — same visual language as AdminStatCard, but
 *  allows an extra footer row (progress bar / breakdown) beneath the
 *  value, which the shared primitive doesn't support. */
const MetricCard: React.FC<{
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  valueClassName?: string;
  iconClassName?: string;
  footer?: React.ReactNode;
}> = ({ label, value, icon: Icon, valueClassName, iconClassName, footer }) => (
  <AdminCard className="min-w-0">
    <AdminCardBody className="pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className={cn('text-2xl font-bold tabular-nums text-black md:text-3xl', valueClassName)}>{value}</p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/5">
          <Icon className={cn('h-4.5 w-4.5', iconClassName)} style={!iconClassName ? { color: BRAND_TEAL } : undefined} />
        </div>
      </div>
      {footer && <div className="mt-3">{footer}</div>}
    </AdminCardBody>
  </AdminCard>
);

const SalesDashboard: React.FC<SalesDashboardProps> = ({ embedded = false }) => {
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
      <div className="flex min-h-[50vh] items-center justify-center">
        <span
          className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-[#00BAAD]"
          aria-hidden="true"
        />
      </div>
    );
  }

  const hiddenCount = SECTION_KEYS.filter(k => !sectionVisibility[k]).length;
  const showIndividual = !admin || selectedConsultantId !== 'all';

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-black md:text-2xl">Sales Dashboard</h1>
          <p className="text-xs text-slate-500 md:text-sm">
            {admin
              ? selectedConsultantId === 'all'
                ? `All Consultants • ${monthName} payout • ${periodLabel}`
                : `${viewingConsultant?.name || ''} • ${monthName} payout • ${periodLabel}`
              : `${consultant?.name || 'Loading...'} • ${monthName} payout • ${periodLabel}`
            }
          </p>
        </div>
        <div className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          {!embedded && (
            <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-2 rounded-none border-black/15 text-black hover:bg-black/5">
              <Link to="/">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="h-9 shrink-0 gap-2 rounded-none border-black/15 text-black hover:bg-black/5">
            <Link to="/availability-heatmap">
              <MapPin className="h-4 w-4" />
              Availability Heatmap
            </Link>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  'h-9 shrink-0 justify-start gap-2 rounded-none border-black/15 text-left font-normal text-black hover:bg-black/5',
                  !selectedPayoutDate && 'text-slate-500'
                )}
              >
                <CalendarIcon className="h-4 w-4" />
                {selectedDateLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto rounded-none border-black/10 p-0" align="end">
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
              <SelectTrigger className="h-9 w-[220px] shrink-0 rounded-none border-black/15">
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
              <AdminPill tone="neutral">{consultant?.type || 'N/A'}</AdminPill>
              {consultant?.region && <AdminPill tone="teal">{consultant.region}</AdminPill>}
            </>
          )}
        </div>
      </div>

      {/* Section Visibility Toggles */}
      <AdminCard>
        <AdminCardBody className="pt-4 pb-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium text-black">Show / Hide Sections</p>
            {hiddenCount > 0 && <AdminPill tone="neutral">{hiddenCount} hidden</AdminPill>}
          </div>
          <div className="flex flex-wrap gap-2">
            {SECTION_KEYS.map(key => {
              const visible = sectionVisibility[key];
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleSection(key)}
                  className={cn(
                    'flex h-9 items-center gap-1.5 rounded-none border px-3 text-xs font-medium transition-colors duration-150',
                    visible
                      ? 'border-black bg-black text-white'
                      : 'border-black/15 text-slate-600 hover:text-black hover:bg-black/5'
                  )}
                >
                  {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  {SECTION_LABELS[key]}
                </button>
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
              className="mb-3 flex cursor-pointer select-none items-center justify-between"
              onClick={() => setTeamOverviewOpen(!teamOverviewOpen)}
            >
              <div className="flex min-w-0 items-center gap-2">
                <Users className="h-5 w-5 shrink-0" style={{ color: BRAND_TEAL }} />
                <h3 className="truncate text-base font-semibold text-black md:text-lg">
                  Team Overview — {monthName} payout • {periodLabel}
                </h3>
                <AdminPill tone="neutral" className="shrink-0">{teamData.length} consultants</AdminPill>
              </div>
              {teamOverviewOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />}
            </div>

            {teamOverviewOpen && (
              <>
                {/* Summary cards */}
                <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  <div className="rounded-none border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Total Deals</p>
                    <p className="text-2xl font-bold text-black">{teamData.reduce((s, d) => s + d.totalAppts, 0)}</p>
                  </div>
                  <div className="rounded-none border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Total Earnings</p>
                    <p className="text-2xl font-bold text-black">R{teamData.reduce((s, d) => s + d.totalEarnings, 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-none border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Targets Met</p>
                    <p className="text-2xl font-bold text-black">{teamData.filter(d => d.targetMet).length}/{teamData.length}</p>
                  </div>
                  <div className="rounded-none border border-black/10 bg-black/[0.02] p-3">
                    <p className="text-[11px] text-slate-500">Active Strikes</p>
                    <p className="text-2xl font-bold text-black">{teamData.reduce((s, d) => s + d.activeStrikes, 0)}</p>
                  </div>
                </div>

                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-black/10 bg-black/[0.03] hover:bg-black/[0.03]">
                        <TableHead className="text-xs font-semibold text-black">Consultant</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-black">Type</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-black">RAF</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-black">Med Neg</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-black">Total Deals</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-black">Earnings</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-black">Strikes</TableHead>
                        <TableHead className="text-center text-xs font-semibold text-black">Target / Payout</TableHead>
                        <TableHead className="w-20 text-xs font-semibold text-black"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamData.length > 0 ? teamData.map(d => (
                        <TableRow key={d.consultant.id} className="border-black/10 hover:bg-black/[0.02]">
                          <TableCell className="text-sm font-medium text-black">{d.consultant.name}</TableCell>
                          <TableCell className="text-center">
                            <AdminPill tone="neutral">{d.consultant.type}</AdminPill>
                          </TableCell>
                          <TableCell className="text-center text-sm font-medium text-blue-600">{d.rafAppts}</TableCell>
                          <TableCell className="text-center text-sm font-medium text-teal-600">{d.mednegAppts}</TableCell>
                          <TableCell className="text-center text-sm font-bold text-black">{d.totalAppts}</TableCell>
                          <TableCell className="text-center text-sm font-medium text-black">R{d.totalEarnings.toLocaleString()}</TableCell>
                          <TableCell className="text-center">
                            {d.activeStrikes > 0 ? (
                              <AdminPill tone="destructive">{d.activeStrikes}</AdminPill>
                            ) : (
                              <span className="text-xs text-slate-500">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="mb-1 text-[10px] text-slate-500">Min {d.target}</div>
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
                            <button
                              type="button"
                              className="h-7 rounded-none px-2 text-xs font-medium text-slate-500 hover:text-black"
                              onClick={() => setSelectedConsultantId(d.consultant.id)}
                            >
                              View
                            </button>
                          </TableCell>
                        </TableRow>
                      )) : (
                        <TableRow>
                          <TableCell colSpan={9} className="py-8 text-center text-slate-500">
                            No active sales consultants found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile cards — same rows, no sideways scroll */}
                <div className="divide-y divide-black/10 border border-black/10 md:hidden">
                  {teamData.length > 0 ? teamData.map(d => (
                    <button
                      key={d.consultant.id}
                      type="button"
                      onClick={() => setSelectedConsultantId(d.consultant.id)}
                      className="block w-full p-3 text-left"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-black">{d.consultant.name}</p>
                        <AdminPill tone="neutral" className="shrink-0">{d.consultant.type}</AdminPill>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-500">
                        <span className="text-blue-600 font-medium">RAF {d.rafAppts}</span>
                        <span className="text-teal-600 font-medium">Med Neg {d.mednegAppts}</span>
                        <span className="font-semibold text-black">{d.totalAppts} total</span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs font-medium text-black">R{d.totalEarnings.toLocaleString()}</span>
                        {d.activeStrikes > 0 && <AdminPill tone="destructive">{d.activeStrikes} strike{d.activeStrikes > 1 ? 's' : ''}</AdminPill>}
                        {d.targetMet ? <AdminPill tone="success">Met ✓</AdminPill> : <AdminPill tone="destructive">Not met</AdminPill>}
                        <AdminPill tone={d.payoutUnlocked ? 'teal' : 'neutral'}>Payout {d.payoutUnlocked ? 'on' : '4+'}</AdminPill>
                      </div>
                    </button>
                  )) : (
                    <div className="py-8 text-center text-sm text-slate-500">No active sales consultants found</div>
                  )}
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
              <AdminPill tone="neutral">{viewingConsultant.type}</AdminPill>
              {viewingConsultant.region && <AdminPill tone="teal">{viewingConsultant.region}</AdminPill>}
              <button
                type="button"
                className="ml-auto text-xs font-medium text-slate-500 hover:text-black"
                onClick={() => setSelectedConsultantId('all')}
              >
                ← Back to Overview
              </button>
            </div>
          )}

          {canManageStrikes && (
            <AdminCard>
              <AdminCardBody className="space-y-3 pt-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <div className="space-y-1 md:w-44">
                    <p className="text-xs font-medium text-slate-500">Strike type</p>
                    <Select value={strikeType} onValueChange={(value) => setStrikeType(value as 'verbal' | 'written' | 'dismissal')}>
                      <SelectTrigger className="h-9 rounded-none border-black/15"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="verbal">Verbal</SelectItem>
                        <SelectItem value="written">Written</SelectItem>
                        <SelectItem value="dismissal">Dismissal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-xs font-medium text-slate-500">Admin reason</p>
                    <Textarea value={strikeReason} onChange={(e) => setStrikeReason(e.target.value)} className="min-h-9 rounded-none border-black/15" />
                  </div>
                  <Button
                    onClick={() => setPendingStrikeAction({ action: 'issue', type: strikeType, reason: strikeReason || 'Admin override' })}
                    disabled={strikeSaving}
                    className="rounded-none bg-black text-white hover:bg-black/90 md:w-36"
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
                        disabled={strikeSaving}
                        className="rounded-none border-black/15 text-black hover:bg-black/5"
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Deals Closed (Selected Period)"
              value={totalAppts}
              icon={Briefcase}
              footer={
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500">
                    <span>Target: {viewingTarget}</span>
                    <span>{Math.round(progressPct)}%</span>
                  </div>
                  <Progress value={progressPct} className="h-1.5" />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-slate-500">
                    <span className="font-medium text-blue-600">RAF: {rafAppts}</span>
                    <span className="font-medium text-teal-600">Med Neg: {mednegAppts}</span>
                    <span>Payout from {payoutEligibilityTarget}+</span>
                  </div>
                </div>
              }
            />

            <MetricCard
              label="RAF Earnings"
              value={`R${incentive.raf.toLocaleString()}`}
              valueClassName="text-blue-600"
              icon={TrendingUp}
              iconClassName="h-4.5 w-4.5 text-blue-600"
              footer={<p className="text-[11px] text-slate-500">{rafAppts} deals × R{incentive.rafRate?.toLocaleString() || 0}/deal</p>}
            />

            <MetricCard
              label="Med Neg Earnings"
              value={`R${incentive.medneg.toLocaleString()}`}
              valueClassName="text-teal-600"
              icon={Award}
              footer={<p className="text-[11px] text-slate-500">{mednegAppts} deals × R{incentive.mednegRate?.toLocaleString() || 0}/deal</p>}
            />

            <MetricCard
              label="Active Strikes"
              value={`${viewStrikes.length}/3`}
              icon={AlertTriangle}
              iconClassName={cn('h-4.5 w-4.5', viewStrikes.length > 0 ? 'text-destructive' : 'text-slate-400')}
              footer={<p className="text-[11px] text-slate-500">{viewStrikes.length === 0 ? 'Good standing' : `${viewStrikes.length} warning(s) active`}</p>}
            />
          </div>

          {/* Earnings Breakdown Card */}
          <AdminCard>
            <AdminCardBody className="pt-6">
              <div className="mb-4 flex items-center gap-2">
                <RandSign className="h-5 w-5" style={{ color: BRAND_TEAL }} />
                <h3 className="text-base font-semibold text-black md:text-lg">
                  Earnings Breakdown — {monthName} {currentYear}
                </h3>
              </div>

              <p className="mb-3 text-[11px] text-slate-500">
                Based on <strong className="text-black">{totalAppts}</strong> scheduled assessment(s) attributed to {admin ? viewingConsultant.name : 'you'} in {periodLabel}
              </p>

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Appointment Split</p>
              <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-none border border-black/10 bg-black/[0.02] p-4">
                  <p className="mb-1 text-xs font-medium text-blue-600">RAF Deals</p>
                  <p className="text-3xl font-bold text-black">{rafAppts}</p>
                  <p className="text-sm text-slate-500">
                    × R{incentive.rafRate?.toLocaleString() || 0} = <span className="font-semibold text-blue-600">R{incentive.raf.toLocaleString()}</span>
                  </p>
                </div>
                <div className="rounded-none border border-black/10 bg-black/[0.02] p-4">
                  <p className="mb-1 text-xs font-medium text-teal-600">Med Neg Deals</p>
                  <p className="text-3xl font-bold text-black">{mednegAppts}</p>
                  <p className="text-sm text-slate-500">
                    × R{incentive.mednegRate?.toLocaleString() || 0} = <span className="font-semibold text-teal-600">R{incentive.medneg.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Total Payout</p>
              <p className="text-3xl font-bold text-black">R{incentive.total.toLocaleString()}</p>
              <p className="mb-3 text-sm text-slate-500">
                Incentive tier: {incentive.label} • Based on {totalAppts} closed deal(s)
              </p>
              <div className="flex flex-wrap items-center gap-4 text-sm text-black">
                <span className="flex items-center gap-1.5">
                  Target:{' '}
                  {totalAppts >= viewingTarget ? (
                    <AdminPill tone="success">Met ✓</AdminPill>
                  ) : (
                    <AdminPill tone="destructive">Not met ✕</AdminPill>
                  )}
                </span>
                <span className="flex items-center gap-1.5">
                  Incentive:{' '}
                  {payoutUnlocked ? (
                    <span className="font-medium" style={{ color: BRAND_TEAL }}>Unlocked</span>
                  ) : (
                    <span className="font-medium text-slate-500">Locked</span>
                  )}
                </span>
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardBody className="pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-black md:text-lg">Closed deal details</h3>
                  <p className="text-xs text-slate-500">{periodLabel} • allocated by scheduled assessment consultant</p>
                </div>
                <AdminPill tone="neutral" className="shrink-0">{visibleDeals.length} deals</AdminPill>
              </div>

              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-black/10 bg-black/[0.03] hover:bg-black/[0.03]">
                      <TableHead className="text-xs font-semibold text-black">Closed</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Claimant</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Matter</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Referring Attorney</TableHead>
                      <TableHead className="text-xs font-semibold text-black">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleDeals.length > 0 ? visibleDeals.map(deal => (
                      <TableRow key={deal.appointment_id} className="border-black/10 hover:bg-black/[0.02]">
                        <TableCell className="text-sm text-black">{new Date(deal.closed_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</TableCell>
                        <TableCell className="text-sm font-medium text-black">
                          {deal.claimant_name}
                          <span className="block text-[11px] text-slate-500">{deal.claimant_auto_id}</span>
                        </TableCell>
                        <TableCell className="text-sm text-black">{deal.matter_type || 'RAF'}</TableCell>
                        <TableCell className="text-sm text-black">{deal.referring_attorney}</TableCell>
                        <TableCell><AdminPill tone="success">{deal.payment_status || 'Payment Received'}</AdminPill></TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-slate-500">No closed scheduled assessments found for this period</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <div className="divide-y divide-black/10 border border-black/10 md:hidden">
                {visibleDeals.length > 0 ? visibleDeals.map(deal => (
                  <div key={deal.appointment_id} className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-black">{deal.claimant_name}</p>
                        <p className="text-[11px] text-slate-500">{deal.claimant_auto_id}</p>
                      </div>
                      <AdminPill tone="success" className="shrink-0">{deal.payment_status || 'Payment Received'}</AdminPill>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span>{new Date(deal.closed_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span>
                      <span>{deal.matter_type || 'RAF'}</span>
                      <span className="truncate">{deal.referring_attorney}</span>
                    </div>
                  </div>
                )) : (
                  <div className="py-8 text-center text-sm text-slate-500">No closed scheduled assessments found for this period</div>
                )}
              </div>
            </AdminCardBody>
          </AdminCard>

          <AdminCard>
            <AdminCardBody className="pt-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5" style={{ color: BRAND_TEAL }} />
                  <h3 className="text-base font-semibold text-black md:text-lg">Strike and override history</h3>
                </div>
                <AdminPill tone="neutral">{viewStrikeHistory.length} actions</AdminPill>
              </div>
              <div className="space-y-3">
                {viewStrikeHistory.length > 0 ? viewStrikeHistory.map(item => (
                  <div key={item.id} className="rounded-none border border-black/10 bg-black/[0.02] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <AdminPill tone={item.action === 'issued' ? 'destructive' : 'teal'} className="capitalize">
                          {item.action}
                        </AdminPill>
                        {item.strike_type && <span className="text-sm font-semibold capitalize text-black">{item.strike_type} strike</span>}
                      </div>
                      <span className="text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-slate-500 md:grid-cols-2">
                      <p>Performed by: <span className="font-medium text-black">{item.performed_by_name || 'Admin user'}</span></p>
                      <p>Payout: <span className="font-medium text-black">{item.payout_month && item.payout_year ? `${new Date(item.payout_year, item.payout_month - 1).toLocaleString('en-ZA', { month: 'long' })} ${item.payout_year}` : 'Not linked'}</span></p>
                    </div>
                    {item.reason && <p className="mt-2 break-words text-sm text-black">{item.reason}</p>}
                  </div>
                )) : (
                  <div className="rounded-none border border-dashed border-black/15 p-6 text-center text-sm text-slate-500">
                    No strike or override history recorded for this consultant.
                  </div>
                )}
              </div>
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
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
          <IncentiveTable
            tiers={tiers}
            isAdmin={admin}
            onUpdateTier={updateTier}
          />
          <IncentiveRules />
        </div>
      )}

      {/* Strike Tracker */}
      <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
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
        <AlertDialogContent className="rounded-none border-black/10">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm {pendingStrikeAction?.action === 'override' ? 'strike override' : 'strike issuance'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Review the selected details before submitting this admin action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingStrikeAction && viewingConsultant && (
            <div className="space-y-3 rounded-none border border-black/10 bg-black/[0.02] p-4 text-sm">
              <div className="flex justify-between gap-4"><span className="text-slate-500">Consultant</span><span className="text-right font-medium text-black">{viewingConsultant.name}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Payout period</span><span className="text-right font-medium text-black">{monthName} payout • {periodLabel}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Action</span><span className="text-right font-medium capitalize text-black">{pendingStrikeAction.action}</span></div>
              <div className="flex justify-between gap-4"><span className="text-slate-500">Strike type</span><span className="text-right font-medium capitalize text-black">{pendingStrikeAction.action === 'issue' ? pendingStrikeAction.type : pendingStrikeAction.strike.type}</span></div>
              <div className="space-y-1"><span className="text-slate-500">Selected reason</span><p className="break-words font-medium text-black">{pendingStrikeAction.reason}</p></div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={strikeSaving} className="rounded-none border-black/15">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingStrikeAction} disabled={strikeSaving} className="rounded-none bg-black text-white hover:bg-black/90">
              Confirm Submit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SalesDashboard;
