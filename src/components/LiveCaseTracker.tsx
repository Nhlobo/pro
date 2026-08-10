import React, { useMemo, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Calendar,
  ClipboardCheck,
  UserCheck,
  Edit3,
  CheckCircle2,
  Download,
  Search,
  RefreshCw,
  ChevronRight,
  Circle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { LiveCaseStatus } from '@/hooks/useAttorneyDashboardStats';
import {
  PortalCard,
  PortalCardHeader,
  PortalPill,
  PortalEmptyState,
  type PortalPillTone,
} from '@/components/attorney-portal/ui/PortalPrimitives';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';

interface LiveCaseTrackerProps {
  cases: LiveCaseStatus[];
  loading: boolean;
  onRefresh: () => void;
  /**
   * When true, this renders as bare content (search + legend + list) with
   * no outer card/title of its own — for use inside a page that already
   * wraps it in a PortalCard + PortalCardHeader (e.g. the Attorney Portal
   * dashboard's "Live Case Progress" panel), so the title/description and
   * the card border aren't duplicated. Defaults to false so existing
   * standalone usages (e.g. the internal Referring Attorney CRM tab) are
   * unaffected.
   */
  embedded?: boolean;
}

const phaseIcons: Record<string, React.ReactNode> = {
  'Referral Received': <FileText className="h-3.5 w-3.5" />,
  'Documents Verified': <ClipboardCheck className="h-3.5 w-3.5" />,
  'Appointment Scheduled': <Calendar className="h-3.5 w-3.5" />,
  'Claimant Assessed': <UserCheck className="h-3.5 w-3.5" />,
  'Report Drafting': <Edit3 className="h-3.5 w-3.5" />,
  'Quality Review': <CheckCircle2 className="h-3.5 w-3.5" />,
  'Report Ready': <Download className="h-3.5 w-3.5" />
};

/**
 * Single-accent status system — same three states everywhere in the
 * Attorney Portal (PortalPill: neutral / teal / success), not a distinct
 * color per phase. Progress is still legible from position + icon + label,
 * it just no longer reads as seven unrelated brand colors.
 */
const STATUS_TONE: Record<'pending' | 'in_progress' | 'completed', PortalPillTone> = {
  pending: 'neutral',
  in_progress: 'teal',
  completed: 'success',
};

const STATUS_LABEL: Record<'pending' | 'in_progress' | 'completed', string> = {
  pending: 'Pending',
  in_progress: 'Active',
  completed: 'Done',
};

function stepClasses(status: 'pending' | 'in_progress' | 'completed') {
  if (status === 'completed') return 'text-white shadow-sm';
  if (status === 'in_progress') return 'text-white shadow-sm';
  return 'bg-black/5 text-slate-400';
}

function stepStyle(status: 'pending' | 'in_progress' | 'completed'): React.CSSProperties {
  if (status === 'completed') return { backgroundColor: '#16a34a' };
  if (status === 'in_progress') return { backgroundColor: BRAND_TEAL, boxShadow: `0 0 0 3px ${BRAND_TEAL}33` };
  return {};
}

export const LiveCaseTracker: React.FC<LiveCaseTrackerProps> = ({ cases, loading, onRefresh, embedded = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedCase, setExpandedCase] = useState<string | null>(null);

  // Filtering only runs when its inputs actually change, not on every
  // unrelated re-render (e.g. expanding/collapsing a different case).
  const filteredCases = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return cases;
    return cases.filter((c) =>
      c.claimantName.toLowerCase().includes(term) ||
      c.claimantAutoId.toLowerCase().includes(term) ||
      c.expertType.toLowerCase().includes(term)
    );
  }, [cases, searchTerm]);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedCase((current) => (current === id ? null : id));
  }, []);

  const searchAndList = (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          placeholder="Search by claimant name, ID, or expert type…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="rounded-none border-black/15 pl-9"
        />
      </div>

      {/* Status legend — three states, not seven colors */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {(['pending', 'in_progress', 'completed'] as const).map((status) => (
          <div key={status} className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <Circle
              className="h-2.5 w-2.5 shrink-0"
              style={{ color: status === 'pending' ? '#cbd5e1' : status === 'completed' ? '#16a34a' : BRAND_TEAL }}
              fill="currentColor"
              strokeWidth={0}
            />
            {STATUS_LABEL[status]}
          </div>
        ))}
      </div>

      <ScrollArea className="mt-4 max-h-[70vh] pr-2 sm:max-h-[520px]">
        <div className="space-y-3">
          {filteredCases.map((caseItem) => {
            const isExpanded = expandedCase === caseItem.id;
            const currentStatus =
              caseItem.phases.find((p) => p.name === caseItem.currentPhase)?.status || 'pending';

            return (
              <div
                key={caseItem.id}
                className={cn(
                  'cursor-pointer border border-black/10 bg-white transition-colors hover:border-black/25',
                  isExpanded && 'border-[#00BAAD]/50'
                )}
                onClick={() => toggleExpanded(caseItem.id)}
              >
                <div className="p-3 sm:p-4">
                  {/* Case header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-black">{caseItem.claimantName}</div>
                      <div className="truncate text-xs text-slate-500">
                        {caseItem.claimantAutoId} · {caseItem.expertType}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PortalPill tone={STATUS_TONE[currentStatus]} className="hidden sm:inline-flex">
                        {caseItem.currentPhase}
                      </PortalPill>
                      <ChevronRight
                        className={cn('h-4 w-4 text-slate-400 transition-transform', isExpanded && 'rotate-90')}
                      />
                    </div>
                  </div>
                  <PortalPill tone={STATUS_TONE[currentStatus]} className="mt-2 sm:hidden">
                    {caseItem.currentPhase}
                  </PortalPill>

                  {/* Timeline — horizontally scrollable so it never gets
                      crushed on narrow screens; each step keeps a fixed
                      minimum width instead of squeezing to a percentage. */}
                  <div className="mt-4 -mx-1 overflow-x-auto px-1 pb-1">
                    <div className="flex min-w-max items-start">
                      {caseItem.phases.map((phase, index) => (
                        <div key={phase.name} className="flex items-start">
                          <div className="flex w-16 flex-col items-center text-center sm:w-20">
                            <div
                              className={cn(
                                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors sm:h-8 sm:w-8',
                                stepClasses(phase.status)
                              )}
                              style={stepStyle(phase.status)}
                              title={`${phase.name} — ${STATUS_LABEL[phase.status]}`}
                            >
                              {phaseIcons[phase.name]}
                            </div>
                            <span className="mt-1 line-clamp-2 text-[10px] leading-tight text-slate-500">
                              {phase.name}
                            </span>
                          </div>
                          {index < caseItem.phases.length - 1 && (
                            <div
                              className={cn('mt-3.5 h-0.5 w-6 shrink-0 sm:mt-4 sm:w-10')}
                              style={{ backgroundColor: phase.status === 'completed' ? '#16a34a' : '#e2e8f0' }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-4 border-t border-black/10 pt-3">
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-400">Appointment</div>
                          <div className="text-sm font-medium text-black">
                            {caseItem.appointmentDate ? format(new Date(caseItem.appointmentDate), 'MMM d, yyyy') : 'Not scheduled'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-400">Current Stage</div>
                          <div className="truncate text-sm font-medium text-black">{caseItem.currentPhase}</div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-400">Progress</div>
                          <div className="text-sm font-medium text-black">
                            {caseItem.phases.filter((p) => p.status === 'completed').length} / {caseItem.phases.length} steps
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-slate-400">Expert Type</div>
                          <div className="truncate text-sm font-medium text-black">{caseItem.expertType}</div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-1">
                        {caseItem.phases.map((phase, index) => (
                          <div key={phase.name} className="flex items-center justify-between gap-3 py-1.5">
                            <div className="flex min-w-0 items-center gap-2.5">
                              <div
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-white"
                                style={
                                  phase.status === 'pending'
                                    ? { backgroundColor: '#cbd5e1', color: '#475569' }
                                    : stepStyle(phase.status)
                                }
                              >
                                {index + 1}
                              </div>
                              <span className={cn('truncate text-sm', phase.status === 'pending' ? 'text-slate-500' : 'text-black')}>
                                {phase.name}
                              </span>
                            </div>
                            <PortalPill tone={STATUS_TONE[phase.status]} className="shrink-0">
                              {STATUS_LABEL[phase.status]}
                            </PortalPill>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {filteredCases.length === 0 && (
            <PortalEmptyState
              icon={FileText}
              title="No cases found"
              description={searchTerm ? 'Try adjusting your search terms.' : 'No active cases to display.'}
            />
          )}
        </div>
      </ScrollArea>
    </>
  );

  if (embedded) {
    // Parent page already supplies the PortalCard + PortalCardHeader
    // ("Live Case Progress"), so this stays content-only.
    return loading ? (
      <div className="flex items-center justify-center py-12 text-sm text-slate-500">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        Loading case tracker…
      </div>
    ) : (
      searchAndList
    );
  }

  return (
    <PortalCard>
      <PortalCardHeader
        icon={FileText}
        title="Live Case Tracker"
        description="Real-time progress tracking for all your matters"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-none border border-[#00BAAD]/40 text-[#00BAAD] hover:bg-[#00BAAD]/10 hover:text-[#00BAAD]"
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-slate-500">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Loading case tracker…
          </div>
        ) : (
          searchAndList
        )}
      </div>
    </PortalCard>
  );
};
