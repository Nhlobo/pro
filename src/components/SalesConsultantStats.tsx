import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, TrendingUp, BarChart3, Calendar, Target, MapPin } from 'lucide-react';
import { format, subMonths } from 'date-fns';

interface SalesConsultantStatsProps {
  firstName: string;
  lastName?: string;
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const SalesConsultantStats: React.FC<SalesConsultantStatsProps> = ({ firstName, lastName }) => {
  const consultantName = firstName?.trim();

  // Fetch pitchlog entries for this consultant
  const { data: pitchlogEntries = [], isLoading: loadingPitchlog } = useQuery({
    queryKey: ['sales-consultant-pitchlog', consultantName],
    queryFn: async () => {
      if (!consultantName) return [];
      const { data, error } = await supabase
        .from('attorney_pitchlog')
        .select('id, pitch_status, deal_closed, deal_closed_date, month_year, law_firm_name, practice_area, province, matched_referring_attorney_id, created_at')
        .ilike('sales_person', `%${consultantName}%`);
      if (error) throw error;
      return data || [];
    },
    enabled: !!consultantName,
  });

  // Fetch referring attorneys for matching
  const { data: referringAttorneys = [] } = useQuery({
    queryKey: ['referring-attorneys-for-consultant-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referring_attorneys')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!consultantName,
  });

  // Fetch sales_consultants to find this consultant's ID by name
  const { data: salesConsultants = [] } = useQuery({
    queryKey: ['sales-consultants-for-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_consultants')
        .select('id, name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!consultantName,
  });

  const matchedConsultantId = React.useMemo(() => {
    if (!consultantName) return null;
    const target = normalise(consultantName + (lastName ? ' ' + lastName : ''));
    const targetFirst = normalise(consultantName);
    const match = salesConsultants.find(c => {
      const n = normalise(c.name);
      return n === target || n.includes(targetFirst) || targetFirst.includes(n);
    });
    return match?.id || null;
  }, [consultantName, lastName, salesConsultants]);

  // Fetch live appointments attributed to this consultant (deals closed)
  const { data: appointmentStats = [] } = useQuery({
    queryKey: ['appointment-stats-for-consultant-stats', matchedConsultantId],
    queryFn: async () => {
      if (!matchedConsultantId) return [];
      const { data, error } = await supabase
        .from('appointments')
        .select('id, referring_attorney_id, appointment_date, matter_type')
        .is('deleted_at', null)
        .eq('sales_consultant_id', matchedConsultantId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!consultantName && !!matchedConsultantId,
  });

  const isLoading = loadingPitchlog;

  const stats = React.useMemo(() => {
    if (!consultantName) return null;
    if (pitchlogEntries.length === 0 && appointmentStats.length === 0) return null;

    const all = pitchlogEntries;
    const now = new Date();
    const currentMonth = format(now, 'yyyy-MM');
    const lastMonth = format(subMonths(now, 1), 'yyyy-MM');

    // LIVE deals = scheduled appointments attributed to this sales consultant
    const totalClosed = appointmentStats.length;
    const thisMonthClosed = appointmentStats.filter(a => {
      if (!a.appointment_date) return false;
      return format(new Date(a.appointment_date), 'yyyy-MM') === currentMonth;
    }).length;
    const lastMonthClosed = appointmentStats.filter(a => {
      if (!a.appointment_date) return false;
      return format(new Date(a.appointment_date), 'yyyy-MM') === lastMonth;
    }).length;

    // Build a lookup of RA name by id
    const raById = new Map(referringAttorneys.map(r => [r.id, r.name]));

    // Recent closed deals (last 5) — from live appointments
    const recentDeals = [...appointmentStats]
      .sort((a, b) => (b.appointment_date || '').localeCompare(a.appointment_date || ''))
      .slice(0, 5)
      .map(a => ({
        firmName: raById.get(a.referring_attorney_id) || 'Unknown firm',
        date: a.appointment_date,
        practiceArea: a.matter_type || null,
      }));

    // Practice area breakdown from live appointments
    const practiceBreakdown: Record<string, number> = {};
    appointmentStats.forEach(a => {
      const area = a.matter_type || 'Unknown';
      practiceBreakdown[area] = (practiceBreakdown[area] || 0) + 1;
    });

    // Pitchlog-derived metrics (activity, not deals)
    const totalPitches = all.length;
    const attributed = all.filter(e => e.matched_referring_attorney_id).length;
    const pitched = all.filter(e => e.pitch_status === 'Pitched').length;
    const rePitched = all.filter(e => e.pitch_status === 'Re-pitched').length;
    const followedUp = all.filter(e => e.pitch_status === 'Followed Up').length;
    const interested = all.filter(e => e.pitch_status === 'Interested').length;
    const conversionRate = totalPitches > 0 ? ((totalClosed / totalPitches) * 100).toFixed(1) : '0';

    // Province breakdown of all pitches
    const provinceBreakdown: Record<string, number> = {};
    all.forEach(entry => {
      const province = entry.province || 'Unknown';
      provinceBreakdown[province] = (provinceBreakdown[province] || 0) + 1;
    });

    return {
      totalPitches,
      totalClosed,
      thisMonthClosed,
      lastMonthClosed,
      attributed,
      pitched,
      rePitched,
      followedUp,
      interested,
      conversionRate,
      practiceBreakdown,
      provinceBreakdown,
      recentDeals,
    };
  }, [consultantName, pitchlogEntries, referringAttorneys, appointmentStats]);

  if (!consultantName) return null;
  if (isLoading) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">Loading sales performance...</div>
    );
  }
  if (!stats || stats.totalPitches === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-3">No pitchlog activity found for this consultant.</div>
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
