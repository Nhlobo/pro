import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, TrendingUp, BarChart3, Calendar, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { useSalesConsultantStats } from '@/hooks/useSalesConsultantStats';

interface SalesConsultantStatsProps {
  firstName: string;
  lastName?: string;
}

// Data-fetching logic lives in useSalesConsultantStats. This is the only
// live consumer of that hook, used on Index.tsx (the sales consultant's own
// home screen) and inside EditProfileDialog when an admin edits someone
// else's profile. (A second, "new-system-styled" component that supposedly
// shared this hook, SalesConsultantPitchActivity, was never actually
// wired up anywhere — removed 2026-09-01.)
const SalesConsultantStats: React.FC<SalesConsultantStatsProps> = ({ firstName, lastName }) => {
  const { consultantName, stats, isLoading } = useSalesConsultantStats(firstName, lastName);

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
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border/50">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-emerald-600">{stats.totalClosed}</p>
            <p className="text-[10px] text-muted-foreground">Closed Deals</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-primary">{stats.totalPitches}</p>
            <p className="text-[10px] text-muted-foreground">Total Pitches</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-2 text-center">
            <p className="text-lg font-bold text-amber-600">{stats.conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground">Conversion</p>
          </CardContent>
        </Card>
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
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1">
          <Calendar className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">This month:</span>
          <span className="font-semibold">{stats.thisMonthClosed} deals</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Last month:</span>
          <span className="font-semibold">{stats.lastMonthClosed} deals</span>
        </div>
        {stats.thisMonthClosed > stats.lastMonthClosed && (
          <TrendingUp className="h-3 w-3 text-emerald-600" />
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
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(stats.provinceBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([province, count]) => (
                <Card key={province} className="border-border/50">
                  <CardContent className="p-3 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate mr-2">{province}</span>
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
              <div key={idx} className="flex items-center justify-between text-[11px] p-1.5 rounded bg-muted/30">
                <div className="flex items-center gap-1.5 min-w-0">
                  <CheckCircle className="h-3 w-3 text-emerald-600 shrink-0" />
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
