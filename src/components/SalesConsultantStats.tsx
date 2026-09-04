import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, TrendingUp, BarChart3, Calendar, MapPin, Target } from 'lucide-react';
import { format } from 'date-fns';
import { useSalesConsultantStats } from '@/hooks/useSalesConsultantStats';

/**
 * Metric tile matching the same "bg-gradient-card / icon-in-box / text-3xl"
 * language as DashboardStatsGrid's StatCard — the tile pattern every other
 * role sees on this exact page (Index.tsx). Kept local rather than reusing
 * DashboardStatsGrid's StatCard directly since that component's props are
 * shaped around its own fixed 6-metric spec list, not a reusable export.
 */
const MetricTile: React.FC<{
  title: string;
  value: React.ReactNode;
  hint: string;
  Icon: typeof CheckCircle;
  iconBg: string;
  iconText: string;
  valueText: string;
}> = ({ title, value, hint, Icon, iconBg, iconText, valueText }) => (
  <Card className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300 hover:scale-105 group">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 px-4 pt-4">
      <CardTitle className="text-xs font-medium text-foreground">{title}</CardTitle>
      <div className={`p-1.5 ${iconBg} rounded-lg transition-colors duration-300`}>
        <Icon className={`h-4 w-4 ${iconText}`} />
      </div>
    </CardHeader>
    <CardContent className="px-4 pb-4">
      <div className={`text-3xl font-bold ${valueText} mb-1`}>{value}</div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </CardContent>
  </Card>
);

interface SalesConsultantStatsProps {
  // Auth user id of the person these stats belong to (i.e. whose
  // sales_consultants row to look up). This is the reliable identifier —
  // firstName/lastName are a display fallback only, for the legacy path in
  // useSalesConsultantStats. See that hook for why this matters: name
  // matching alone can miss or misattribute data once RLS is scoped by
  // consultant_id.
  userId: string | undefined;
  firstName: string;
  lastName?: string;
}

// Data-fetching logic lives in useSalesConsultantStats. This is the only
// live consumer of that hook, used on Index.tsx (the sales consultant's own
// home screen) and inside EditProfileDialog when an admin edits someone
// else's profile. (A second, "new-system-styled" component that supposedly
// shared this hook, SalesConsultantPitchActivity, was never actually
// wired up anywhere — removed 2026-09-01.)
const SalesConsultantStats: React.FC<SalesConsultantStatsProps> = ({ userId, firstName, lastName }) => {
  const { consultantName, stats, isLoading } = useSalesConsultantStats(userId, firstName, lastName);

  if (!consultantName) return null;
  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">Loading sales performance...</div>
    );
  }
  if (!stats || (stats.totalPitches === 0 && stats.totalClosed === 0)) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">No sales activity found for this consultant.</div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Sales Performance</span>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricTile
          title="Closed Deals"
          value={stats.totalClosed}
          hint="All-time closed"
          Icon={CheckCircle}
          iconBg="bg-success/10 group-hover:bg-success/20"
          iconText="text-success"
          valueText="text-success"
        />
        <MetricTile
          title="Total Pitches"
          value={stats.totalPitches}
          hint="All-time pitched"
          Icon={Target}
          iconBg="bg-kutlwano-blue/10 group-hover:bg-kutlwano-blue/20"
          iconText="text-kutlwano-blue"
          valueText="text-kutlwano-blue"
        />
        <MetricTile
          title="Conversion"
          value={`${stats.conversionRate}%`}
          hint="Closed / pitched"
          Icon={TrendingUp}
          iconBg="bg-warning/10 group-hover:bg-warning/20"
          iconText="text-warning"
          valueText="text-warning"
        />
      </div>

      {/* Activity Breakdown */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="outline" className="text-[10px]">Pitched: {stats.pitched}</Badge>
        <Badge variant="outline" className="text-[10px]">Re-pitched: {stats.rePitched}</Badge>
        <Badge variant="outline" className="text-[10px]">Followed Up: {stats.followedUp}</Badge>
        <Badge variant="outline" className="text-[10px]">Interested: {stats.interested}</Badge>
        <Badge variant="outline" className="text-[10px]">Attributed: {stats.attributed}</Badge>
      </div>

      {/* Monthly Comparison */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">This month:</span>
          <span className="font-semibold">{stats.thisMonthClosed} deals</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Last month:</span>
          <span className="font-semibold">{stats.lastMonthClosed} deals</span>
        </div>
        {stats.thisMonthClosed > stats.lastMonthClosed && (
          <TrendingUp className="h-3 w-3 text-emerald-600 shrink-0" />
        )}
      </div>

      {/* Practice Area Breakdown */}
      {Object.keys(stats.practiceBreakdown).length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Deals by Practice Area</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(stats.practiceBreakdown).map(([area, count]) => (
              <Badge key={area} variant="secondary" className="text-[10px]">
                {area}: {count}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Province Pitched Table */}
      {Object.keys(stats.provinceBreakdown).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Province Pitched</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(stats.provinceBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([province, count]) => (
                <Card
                  key={province}
                  className="bg-gradient-card border-border/50 shadow-soft hover:shadow-elegant transition-all duration-300"
                >
                  <CardContent className="p-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{province}</span>
                    <Badge className="bg-primary text-primary-foreground text-xs shrink-0">
                      {count}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Recent Closed Deals */}
      {stats.recentDeals.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] font-medium text-muted-foreground">Recent Closed Deals</p>
          <div className="space-y-1 max-h-28 overflow-y-auto">
            {stats.recentDeals.map((deal, idx) => (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px] p-2 rounded bg-muted/30">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle className="h-3 w-3 text-success shrink-0" />
                  <span className="truncate font-medium">{deal.firmName}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {deal.practiceArea && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{deal.practiceArea}</Badge>
                  )}
                  <span className="text-muted-foreground">
                    {deal.date ? format(new Date(deal.date), 'dd MMM yy') : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesConsultantStats;
