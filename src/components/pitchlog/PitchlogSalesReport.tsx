import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckCircle, TrendingUp, Users, BarChart3, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import type { PitchEntry } from './PitchlogInlineRow';

interface Props {
  entries: PitchEntry[];
  filterMonthStr: string;
  monthLabel: string;
}

interface ClosedDeal {
  pitchEntry: PitchEntry;
  referringAttorneyName: string;
  referringAttorneyId: string;
  appointmentCount: number;
  claimantCount: number;
  matchType: 'auto' | 'manual';
}

const PitchlogSalesReport: React.FC<Props> = ({ entries, filterMonthStr, monthLabel }) => {
  const [reportPeriod, setReportPeriod] = useState<'weekly' | 'monthly'>('monthly');

  // Fetch referring attorneys with their appointment counts
  const { data: referringAttorneys = [] } = useQuery({
    queryKey: ['referring-attorneys-for-matching'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('referring_attorneys')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch appointments grouped by referring attorney
  const { data: appointmentStats = [] } = useQuery({
    queryKey: ['appointment-stats-for-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, referring_attorney_id, referring_attorney, appointment_date, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch claimants grouped by referring attorney
  const { data: claimantStats = [] } = useQuery({
    queryKey: ['claimant-stats-for-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('claimants')
        .select('id, referring_attorney_id');
      if (error) throw error;
      return data || [];
    },
  });

  // Auto-match pitchlog entries to referring attorneys
  const closedDeals = useMemo((): ClosedDeal[] => {
    const deals: ClosedDeal[] = [];
    const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const entry of entries) {
      // Check manual flag first
      if ((entry as any).deal_closed) {
        const matchedRA = referringAttorneys.find(ra =>
          normalise(ra.name).includes(normalise(entry.law_firm_name)) ||
          normalise(entry.law_firm_name).includes(normalise(ra.name))
        );
        if (matchedRA) {
          const appts = appointmentStats.filter(a => a.referring_attorney_id === matchedRA.id);
          const claimants = claimantStats.filter(c => c.referring_attorney_id === matchedRA.id);
          deals.push({
            pitchEntry: entry,
            referringAttorneyName: matchedRA.name,
            referringAttorneyId: matchedRA.id,
            appointmentCount: appts.length,
            claimantCount: claimants.length,
            matchType: 'manual',
          });
        }
        continue;
      }

      // Auto-match: find referring attorney whose name matches pitchlog law_firm_name
      const matchedRA = referringAttorneys.find(ra =>
        normalise(ra.name).includes(normalise(entry.law_firm_name)) ||
        normalise(entry.law_firm_name).includes(normalise(ra.name))
      );

      if (matchedRA) {
        const appts = appointmentStats.filter(a => a.referring_attorney_id === matchedRA.id);
        const claimants = claimantStats.filter(c => c.referring_attorney_id === matchedRA.id);
        if (appts.length > 0) {
          deals.push({
            pitchEntry: entry,
            referringAttorneyName: matchedRA.name,
            referringAttorneyId: matchedRA.id,
            appointmentCount: appts.length,
            claimantCount: claimants.length,
            matchType: 'auto',
          });
        }
      }
    }

    // Deduplicate by referring attorney (keep earliest pitch)
    const seen = new Set<string>();
    return deals.filter(d => {
      if (seen.has(d.referringAttorneyId)) return false;
      seen.add(d.referringAttorneyId);
      return true;
    });
  }, [entries, referringAttorneys, appointmentStats, claimantStats]);

  // Filter by period
  const periodEntries = useMemo(() => {
    if (reportPeriod === 'monthly') {
      return entries.filter(e => e.month_year === filterMonthStr);
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return entries.filter(e => e.created_at && new Date(e.created_at) >= sevenDaysAgo);
  }, [entries, filterMonthStr, reportPeriod]);

  const periodClosedDeals = useMemo(() => {
    if (reportPeriod === 'monthly') {
      return closedDeals.filter(d => d.pitchEntry.month_year === filterMonthStr);
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return closedDeals.filter(d => d.pitchEntry.created_at && new Date(d.pitchEntry.created_at) >= sevenDaysAgo);
  }, [closedDeals, filterMonthStr, reportPeriod]);

  const rePitchedEntries = useMemo(() => {
    return periodEntries.filter(e => e.pitch_status === 'Re-pitched');
  }, [periodEntries]);

  // Sales person pipeline summary
  const salesPipeline = useMemo(() => {
    const grouped: Record<string, {
      person: string;
      totalPitched: number;
      rePitched: number;
      followedUp: number;
      dealsClosed: number;
      pending: number;
      conversionRate: number;
    }> = {};

    periodEntries.forEach(e => {
      if (!grouped[e.sales_person]) {
        grouped[e.sales_person] = {
          person: e.sales_person,
          totalPitched: 0,
          rePitched: 0,
          followedUp: 0,
          dealsClosed: 0,
          pending: 0,
          conversionRate: 0,
        };
      }
      grouped[e.sales_person].totalPitched++;
      if (e.pitch_status === 'Re-pitched') grouped[e.sales_person].rePitched++;
      if (e.pitch_status === 'Followed Up') grouped[e.sales_person].followedUp++;
    });

    periodClosedDeals.forEach(d => {
      const sp = d.pitchEntry.sales_person;
      if (grouped[sp]) {
        grouped[sp].dealsClosed++;
      }
    });

    return Object.values(grouped).map(g => ({
      ...g,
      pending: g.totalPitched - g.dealsClosed,
      conversionRate: g.totalPitched > 0 ? Math.round((g.dealsClosed / g.totalPitched) * 100) : 0,
    })).sort((a, b) => b.dealsClosed - a.dealsClosed);
  }, [periodEntries, periodClosedDeals]);

  const totalConversion = periodEntries.length > 0
    ? Math.round((periodClosedDeals.length / periodEntries.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Period Toggle */}
      <div className="flex items-center gap-2">
        <Tabs value={reportPeriod} onValueChange={(v) => setReportPeriod(v as 'weekly' | 'monthly')}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly Report</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-sm text-muted-foreground ml-2">
          {reportPeriod === 'weekly' ? 'Last 7 days' : monthLabel}
        </span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-kutlwano-blue" />
              <span className="text-sm text-muted-foreground">Total Pitched</span>
            </div>
            <p className="text-2xl font-bold mt-1">{periodEntries.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-muted-foreground">Deals Closed</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-emerald-600">{periodClosedDeals.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-purple-600" />
              <span className="text-sm text-muted-foreground">Re-pitched</span>
            </div>
            <p className="text-2xl font-bold mt-1 text-purple-600">{rePitchedEntries.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-kutlwano-teal" />
              <span className="text-sm text-muted-foreground">Conversion</span>
            </div>
            <p className="text-2xl font-bold mt-1">{totalConversion}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales Person Pipeline */}
      <Card className="border-border/50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-kutlwano-blue" />
            Sales Pipeline Summary — {reportPeriod === 'weekly' ? 'Weekly' : 'Monthly'}
          </CardTitle>
          <CardDescription>Performance per sales person with deal tracking</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sales Person</TableHead>
                <TableHead className="text-center">Total Pitched</TableHead>
                <TableHead className="text-center">Re-pitched</TableHead>
                <TableHead className="text-center">Followed Up</TableHead>
                <TableHead className="text-center">Deals Closed</TableHead>
                <TableHead className="text-center">Pending</TableHead>
                <TableHead className="text-center">Conversion %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesPipeline.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No data for this period.</TableCell>
                </TableRow>
              ) : salesPipeline.map(sp => (
                <TableRow key={sp.person}>
                  <TableCell className="font-medium">{sp.person}</TableCell>
                  <TableCell className="text-center font-bold">{sp.totalPitched}</TableCell>
                  <TableCell className="text-center">
                    {sp.rePitched > 0 ? <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/30">{sp.rePitched}</Badge> : '0'}
                  </TableCell>
                  <TableCell className="text-center">{sp.followedUp}</TableCell>
                  <TableCell className="text-center">
                    {sp.dealsClosed > 0 ? <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">{sp.dealsClosed}</Badge> : '0'}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">{sp.pending}</TableCell>
                  <TableCell className="text-center font-semibold">{sp.conversionRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Closed Deals Detail */}
      <Card className="border-border/50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600" />
            Closed Deals
          </CardTitle>
          <CardDescription>
            Pitched firms matched to referring attorneys with assessments — {periodClosedDeals.length} deal(s) closed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pitched Date</TableHead>
                <TableHead>Law Firm (Pitchlog)</TableHead>
                <TableHead>Matched Attorney</TableHead>
                <TableHead>Sales Person</TableHead>
                <TableHead className="text-center">Appointments</TableHead>
                <TableHead className="text-center">Claimants</TableHead>
                <TableHead>Match</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {periodClosedDeals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No closed deals found. Deals are auto-detected when a pitched law firm appears in the referring attorney list with appointments.
                  </TableCell>
                </TableRow>
              ) : periodClosedDeals.map(deal => (
                <TableRow key={deal.pitchEntry.id}>
                  <TableCell className="text-sm">
                    {deal.pitchEntry.created_at ? format(new Date(deal.pitchEntry.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-medium">{deal.pitchEntry.law_firm_name}</TableCell>
                  <TableCell>{deal.referringAttorneyName}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{deal.pitchEntry.sales_person}</Badge>
                  </TableCell>
                  <TableCell className="text-center font-bold text-kutlwano-blue">{deal.appointmentCount}</TableCell>
                  <TableCell className="text-center">{deal.claimantCount}</TableCell>
                  <TableCell>
                    <Badge className={deal.matchType === 'auto' 
                      ? 'bg-kutlwano-blue/10 text-kutlwano-blue border-kutlwano-blue/30' 
                      : 'bg-amber-500/10 text-amber-600 border-amber-500/30'}>
                      {deal.matchType === 'auto' ? 'Auto' : 'Manual'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Re-pitched Attorneys */}
      <Card className="border-border/50 shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-purple-600" />
            Re-pitched Attorneys — {reportPeriod === 'weekly' ? 'Weekly' : 'Monthly'}
          </CardTitle>
          <CardDescription>{rePitchedEntries.length} attorney(s) re-pitched this period</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Law Firm</TableHead>
                <TableHead>Province</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Sales Person</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Follow-Up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rePitchedEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No re-pitched attorneys this period.
                  </TableCell>
                </TableRow>
              ) : rePitchedEntries.map(entry => (
                <TableRow key={entry.id}>
                  <TableCell className="text-sm">
                    {entry.created_at ? format(new Date(entry.created_at), 'dd MMM yyyy') : '—'}
                  </TableCell>
                  <TableCell className="font-medium">{entry.law_firm_name}</TableCell>
                  <TableCell>{entry.province}</TableCell>
                  <TableCell>{entry.contact_person}</TableCell>
                  <TableCell><Badge variant="outline">{entry.sales_person}</Badge></TableCell>
                  <TableCell className="text-xs max-w-[120px] truncate">{entry.comment || '—'}</TableCell>
                  <TableCell className="text-sm">
                    {entry.follow_up_date ? format(new Date(entry.follow_up_date), 'dd MMM') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PitchlogSalesReport;
