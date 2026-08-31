import React from 'react';
import { CheckCircle2, TrendingUp, BarChart3, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useSalesConsultantStats } from '@/hooks/useSalesConsultantStats';
import { AdminCard, AdminCardHeader, AdminCardBody, AdminPill, AdminLoadingState, BRAND_TEAL } from '@/components/admin/ui/AdminUI';

interface SalesConsultantPitchActivityProps {
  firstName: string;
  lastName?: string;
  /** Whose activity this is, for the card description — "you" for a
   *  consultant viewing their own numbers, or the consultant's name when
   *  an admin has a specific consultant selected. */
  viewerLabel?: string;
}

/**
 * Pitching activity (as opposed to deal/incentive tracking, which the rest
 * of the Sales Dashboard tab already covers): total pitches, pitch-status
 * breakdown, province spread, and recent closed deals — restyled with the
 * Admin Portal's design system so it matches the rest of Attorney CRM.
 *
 * Data logic lives entirely in useSalesConsultantStats, shared with the
 * compact SalesConsultantStats card in EditProfileDialog — this component
 * only changes how that same data is presented, so the two stay in sync
 * by construction rather than by two copies of the same queries.
 */
const SalesConsultantPitchActivity: React.FC<SalesConsultantPitchActivityProps> = ({
  firstName,
  lastName,
  viewerLabel = 'you',
}) => {
  const { consultantName, stats, isLoading } = useSalesConsultantStats(firstName, lastName);

  if (!consultantName) return null;

  return (
    <AdminCard>
      <AdminCardHeader
        icon={BarChart3}
        title="Pitching Activity"
        description={`Live from Attorney Pitchlog & scheduled assessments — ${viewerLabel === 'you' ? 'your' : `${viewerLabel}'s`} pitches, deals and coverage`}
      />
      <AdminCardBody>
        {isLoading ? (
          <AdminLoadingState label="Loading pitching activity…" />
        ) : !stats || (stats.totalPitches === 0 && stats.totalClosed === 0) ? (
          <p className="py-6 text-center text-sm text-slate-500">No pitching activity found yet.</p>
        ) : (
          <div className="space-y-4">
            {/* Key metrics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-black/10 p-3 text-center">
                <p className="text-2xl font-bold text-black">{stats.totalClosed}</p>
                <p className="text-[11px] text-slate-500">Closed Deals</p>
              </div>
              <div className="border border-black/10 p-3 text-center">
                <p className="text-2xl font-bold" style={{ color: BRAND_TEAL }}>{stats.totalPitches}</p>
                <p className="text-[11px] text-slate-500">Total Pitches</p>
              </div>
              <div className="border border-black/10 p-3 text-center">
                <p className="text-2xl font-bold text-amber-600">{stats.conversionRate}%</p>
                <p className="text-[11px] text-slate-500">Conversion</p>
              </div>
            </div>

            {/* Activity breakdown */}
            <div className="flex flex-wrap gap-1.5">
              <AdminPill tone="neutral">Pitched: {stats.pitched}</AdminPill>
              <AdminPill tone="neutral">Re-pitched: {stats.rePitched}</AdminPill>
              <AdminPill tone="neutral">Followed Up: {stats.followedUp}</AdminPill>
              <AdminPill tone="neutral">Interested: {stats.interested}</AdminPill>
              <AdminPill tone="teal">Attributed: {stats.attributed}</AdminPill>
            </div>

            {/* Monthly comparison */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                This month: <span className="font-semibold text-black">{stats.thisMonthClosed} deals</span>
              </span>
              <span>
                Last month: <span className="font-semibold text-black">{stats.lastMonthClosed} deals</span>
              </span>
              {stats.thisMonthClosed > stats.lastMonthClosed && (
                <TrendingUp className="h-3.5 w-3.5 text-success" />
              )}
            </div>

            {/* Practice area breakdown */}
            {Object.keys(stats.practiceBreakdown).length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Deals by Practice Area</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(stats.practiceBreakdown).map(([area, count]) => (
                    <AdminPill key={area} tone="neutral">{area}: {count}</AdminPill>
                  ))}
                </div>
              </div>
            )}

            {/* Province pitched */}
            {Object.keys(stats.provinceBreakdown).length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">
                  <MapPin className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} />
                  Province Pitched
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(stats.provinceBreakdown)
                    .sort(([, a], [, b]) => b - a)
                    .map(([province, count]) => (
                      <div key={province} className="flex items-center justify-between border border-black/10 px-3 py-2">
                        <span className="truncate text-sm font-medium text-black">{province}</span>
                        <AdminPill tone="teal" className="shrink-0">{count}</AdminPill>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Recent closed deals */}
            {stats.recentDeals.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Recent Closed Deals</p>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {stats.recentDeals.map((deal, idx) => (
                    <div key={idx} className="flex items-center justify-between border border-black/10 px-3 py-1.5 text-xs">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        <span className="truncate font-medium text-black">{deal.firmName}</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {deal.practiceArea && <AdminPill tone="neutral">{deal.practiceArea}</AdminPill>}
                        <span className="text-slate-500">
                          {deal.date ? format(new Date(deal.date), 'dd MMM yy') : '—'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </AdminCardBody>
    </AdminCard>
  );
};

export default SalesConsultantPitchActivity;
