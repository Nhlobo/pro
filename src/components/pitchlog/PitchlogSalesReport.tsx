import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, TrendingUp, Users, BarChart3, RefreshCw, Download, ChevronDown, UserPlus, AlertCircle, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
import { toast } from 'sonner';
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
  const [selectedConsultant, setSelectedConsultant] = useState<string>('all');
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimConsultant, setClaimConsultant] = useState<Record<string, string>>({});
  const [unattributedSearch, setUnattributedSearch] = useState('');
  const [claimDate, setClaimDate] = useState<Record<string, string>>({});
  const [claimPracticeArea, setClaimPracticeArea] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();
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

  // Fetch appointments grouped by referring attorney (include created_by for attribution)
  const { data: appointmentStats = [] } = useQuery({
    queryKey: ['appointment-stats-for-deals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('appointments')
        .select('id, referring_attorney_id, referring_attorney, appointment_date, created_at, case_status')
        .is('deleted_at', null)
        .eq('case_status', 'scheduled')
        .gte('created_at', '2026-01-01T00:00:00')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch profiles to map user IDs to names for auto-suggesting deal owners
  const { data: profilesList = [] } = useQuery({
    queryKey: ['profiles-for-attribution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, role');
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

  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Match pitchlog entries to scheduled assessments (appointments) to determine closed deals
  // A closed deal MUST have at least one scheduled assessment to qualify
  const closedDeals = useMemo((): ClosedDeal[] => {
    const deals: ClosedDeal[] = [];

    for (const entry of entries) {
      let matchedRA: { id: string; name: string } | undefined;

      // Priority 1: Use matched_referring_attorney_id if already linked
      if ((entry as any).matched_referring_attorney_id) {
        matchedRA = referringAttorneys.find(ra => ra.id === (entry as any).matched_referring_attorney_id);
      }

      // Priority 2: Fuzzy match law_firm_name to referring attorney name
      if (!matchedRA && entry.law_firm_name) {
        matchedRA = referringAttorneys.find(ra =>
          normalise(ra.name).includes(normalise(entry.law_firm_name)) ||
          normalise(entry.law_firm_name).includes(normalise(ra.name))
        );
      }

      if (!matchedRA) continue;

      // A closed deal MUST have scheduled assessments (appointments) to qualify
      const appts = appointmentStats.filter(a => a.referring_attorney_id === matchedRA!.id);
      if (appts.length === 0) continue;

      const claimants = claimantStats.filter(c => c.referring_attorney_id === matchedRA!.id);
      const matchType: 'auto' | 'manual' = (entry as any).deal_closed ? 'manual' : 'auto';

      deals.push({
        pitchEntry: entry,
        referringAttorneyName: matchedRA.name,
        referringAttorneyId: matchedRA.id,
        appointmentCount: appts.length,
        claimantCount: claimants.length,
        matchType,
      });
    }

    // Deduplicate by referring attorney — keep the earliest pitch entry per attorney,
    // correctly attributing the deal to the sales consultant who first pitched
    const seen = new Set<string>();
    const sorted = [...deals].sort((a, b) => {
      const dateA = a.pitchEntry.created_at ? new Date(a.pitchEntry.created_at).getTime() : Infinity;
      const dateB = b.pitchEntry.created_at ? new Date(b.pitchEntry.created_at).getTime() : Infinity;
      return dateA - dateB;
    });
    return sorted.filter(d => {
      if (seen.has(d.referringAttorneyId)) return false;
      seen.add(d.referringAttorneyId);
      return true;
    });
  }, [entries, referringAttorneys, appointmentStats, claimantStats]);

  // Detect referring attorneys with appointments but NO pitchlog match (unattributed deals)
  const unattributedDeals = useMemo(() => {
    const matchedRAIds = new Set(closedDeals.map(d => d.referringAttorneyId));
    const raWithAppts: { raId: string; raName: string; appointmentCount: number; claimantCount: number; earliestAppt: string; suggestedSalesPerson: string }[] = [];

    // Group appointments by referring_attorney_id
    const apptsByRA: Record<string, typeof appointmentStats> = {};
    appointmentStats.forEach(a => {
      if (!apptsByRA[a.referring_attorney_id]) apptsByRA[a.referring_attorney_id] = [];
      apptsByRA[a.referring_attorney_id].push(a);
    });

    // Build a map of pitchlog sales_person by referring attorney name (fuzzy) for suggestion
    const pitchlogByRA: Record<string, string> = {};
    entries.forEach(e => {
      const normName = normalise(e.law_firm_name);
      referringAttorneys.forEach(ra => {
        if (normalise(ra.name).includes(normName) || normName.includes(normalise(ra.name))) {
          if (!pitchlogByRA[ra.id]) pitchlogByRA[ra.id] = e.sales_person;
        }
      });
    });

    for (const [raId, appts] of Object.entries(apptsByRA)) {
      if (matchedRAIds.has(raId)) continue; // already matched
      const ra = referringAttorneys.find(r => r.id === raId);
      if (!ra) continue;
      const claimants = claimantStats.filter(c => c.referring_attorney_id === raId);
      const earliest = appts.reduce((min, a) => {
        const d = a.created_at || a.appointment_date;
        return d < min ? d : min;
      }, appts[0]?.created_at || appts[0]?.appointment_date || '');

      // Auto-suggest salesperson: check pitchlog fuzzy match first, then fallback to who might be in profiles
      const suggestedSalesPerson = pitchlogByRA[raId] || '';

      raWithAppts.push({
        raId,
        raName: ra.name,
        appointmentCount: appts.length,
        claimantCount: claimants.length,
        earliestAppt: earliest,
        suggestedSalesPerson,
      });
    }

    return raWithAppts.sort((a, b) => a.raName.localeCompare(b.raName));
  }, [closedDeals, appointmentStats, claimantStats, referringAttorneys, entries, normalise]);

  const filteredUnattributedDeals = useMemo(() => {
    const term = unattributedSearch.toLowerCase().trim();
    if (!term) return unattributedDeals;
    return unattributedDeals.filter(d => d.raName.toLowerCase().includes(term));
  }, [unattributedDeals, unattributedSearch]);

  // Auto-populate suggested consultant for unattributed deals
  React.useEffect(() => {
    const newSuggestions: Record<string, string> = {};
    unattributedDeals.forEach(deal => {
      if (deal.suggestedSalesPerson && !claimConsultant[deal.raId]) {
        newSuggestions[deal.raId] = deal.suggestedSalesPerson;
      }
    });
    if (Object.keys(newSuggestions).length > 0) {
      setClaimConsultant(prev => ({ ...newSuggestions, ...prev }));
    }
  }, [unattributedDeals]);

  const handleClaimDeal = async (raId: string, raName: string) => {
    const consultant = claimConsultant[raId];
    if (!consultant) {
      toast.error('Please select a sales consultant first');
      return;
    }
    setClaimingId(raId);
    try {
      // Fetch referring attorney details for better data quality
      const { data: raDetails } = await supabase
        .from('referring_attorneys')
        .select('name, contact_person, province, email, phone')
        .eq('id', raId)
        .single();

      const now = new Date();
      const deal = unattributedDeals.find(d => d.raId === raId);
      // Use user-selected backdate, then earliest appointment, then today
      const selectedDate = claimDate[raId];
      const effectiveDate = selectedDate 
        ? new Date(selectedDate)
        : deal?.earliestAppt 
          ? new Date(deal.earliestAppt)
          : now;
      const monthYear = format(effectiveDate, 'yyyy-MM');

      const { error } = await supabase.from('attorney_pitchlog').insert({
        law_firm_name: raDetails?.name || raName,
        sales_person: consultant,
        contact_person: raDetails?.contact_person || raName,
        province: raDetails?.province || 'Unknown',
        email: raDetails?.email || null,
        telephone: raDetails?.phone || null,
        practice_area: claimPracticeArea[raId] || 'RAF',
        attorney_type: 'Plaintiff',
        pitch_status: 'Pitched',
        month_year: monthYear,
        deal_closed: true,
        deal_closed_date: format(effectiveDate, 'yyyy-MM-dd'),
        matched_referring_attorney_id: raId,
        comment: `Attributed from ${deal?.appointmentCount || 0} scheduled assessments, ${deal?.claimantCount || 0} claimants`,
      });
      if (error) throw error;
      toast.success(`Deal attributed to ${consultant}`);
      queryClient.invalidateQueries({ queryKey: ['attorney-pitchlog'] });
      queryClient.invalidateQueries({ queryKey: ['pitchlog-entries'] });
      queryClient.invalidateQueries({ queryKey: ['referring-attorneys-for-matching'] });
      queryClient.invalidateQueries({ queryKey: ['appointment-stats-for-deals'] });
    } catch (err: any) {
      toast.error(`Failed to attribute deal: ${err.message}`);
    } finally {
      setClaimingId(null);
    }
  };

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

  const salesPersonsList = useMemo(() => [...new Set(entries.map(e => e.sales_person))].sort(), [entries]);

  const downloadConsultantPdf = (consultantName: string) => {
    const isAll = consultantName === 'all';
    const consultantEntries = isAll ? periodEntries : periodEntries.filter(e => e.sales_person === consultantName);
    const consultantDeals = isAll ? periodClosedDeals : periodClosedDeals.filter(d => d.pitchEntry.sales_person === consultantName);
    const consultantRePitched = isAll ? rePitchedEntries : rePitchedEntries.filter(e => e.sales_person === consultantName);
    const titleName = isAll ? 'All Sales Consultants' : consultantName;
    const periodLabel = reportPeriod === 'weekly' ? 'Weekly' : monthLabel;

    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = addBrandingToPDF(doc, `Sales Report — ${titleName}`, `${periodLabel} | ${consultantEntries.length} pitched, ${consultantDeals.length} closed, ${consultantRePitched.length} re-pitched`);

    const tableOptions = getStyledTableOptions();

    // Pipeline summary
    const pipelineData = isAll ? salesPipeline : salesPipeline.filter(sp => sp.person === consultantName);
    autoTable(doc, {
      startY: startY + 5,
      head: [['Sales Person', 'Total Pitched', 'Re-pitched', 'Followed Up', 'Deals Closed', 'Pending', 'Conversion %']],
      body: pipelineData.map(sp => [sp.person, sp.totalPitched, sp.rePitched, sp.followedUp, sp.dealsClosed, sp.pending, `${sp.conversionRate}%`]),
      ...tableOptions,
      styles: { ...tableOptions.styles, fontSize: 8 },
    });

    const afterPipeline = (doc as any).lastAutoTable?.finalY || startY + 40;

    // Closed deals
    if (consultantDeals.length > 0) {
      autoTable(doc, {
        startY: afterPipeline + 10,
        head: [['Date', 'Law Firm', 'Matched Attorney', 'Appointments', 'Claimants', 'Match']],
        body: consultantDeals.map(d => [
          d.pitchEntry.created_at ? format(new Date(d.pitchEntry.created_at), 'dd MMM yyyy') : '—',
          d.pitchEntry.law_firm_name,
          d.referringAttorneyName,
          d.appointmentCount,
          d.claimantCount,
          d.matchType === 'auto' ? 'Auto' : 'Manual',
        ]),
        ...tableOptions,
        styles: { ...tableOptions.styles, fontSize: 8 },
      });
    }

    const afterDeals = (doc as any).lastAutoTable?.finalY || afterPipeline + 10;

    // Re-pitched
    if (consultantRePitched.length > 0) {
      autoTable(doc, {
        startY: afterDeals + 10,
        head: [['Date', 'Law Firm', 'Province', 'Contact', 'Sales Person', 'Follow-Up']],
        body: consultantRePitched.map(e => [
          e.created_at ? format(new Date(e.created_at), 'dd MMM yyyy') : '—',
          e.law_firm_name,
          e.province,
          e.contact_person,
          e.sales_person,
          e.follow_up_date ? format(new Date(e.follow_up_date), 'dd MMM') : '—',
        ]),
        ...tableOptions,
        styles: { ...tableOptions.styles, fontSize: 8 },
      });
    }

    addBrandingFooter(doc);
    const safeName = titleName.replace(/\s+/g, '_');
    doc.save(`Sales_Report_${safeName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Period Toggle & Download */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={reportPeriod} onValueChange={(v) => setReportPeriod(v as 'weekly' | 'monthly')}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly Report</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
          </TabsList>
        </Tabs>
        <span className="text-sm text-muted-foreground">
          {reportPeriod === 'weekly' ? 'Last 7 days' : monthLabel}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Select value={selectedConsultant} onValueChange={setSelectedConsultant}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select consultant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sales Consultants</SelectItem>
              {salesPersonsList.map(sp => <SelectItem key={sp} value={sp}>{sp}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => downloadConsultantPdf(selectedConsultant)}>
            <Download className="h-4 w-4 mr-2" />Download PDF
          </Button>
        </div>
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

      {/* Closed Deals Detail — Collapsible */}
      <Collapsible>
        <Card className="border-border/50 shadow-soft">
          <CardHeader className="cursor-pointer">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-emerald-600" />
                  Closed Deals
                  <Badge variant="secondary" className="ml-2">{periodClosedDeals.length}</Badge>
                </CardTitle>
                <CardDescription>
                  Click to view closed deals details
                </CardDescription>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
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
                        No closed deals found.
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Re-pitched Attorneys — Collapsible */}
      <Collapsible>
        <Card className="border-border/50 shadow-soft">
          <CardHeader className="cursor-pointer">
            <CollapsibleTrigger className="flex items-center justify-between w-full">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-purple-600" />
                  Re-pitched Attorneys — {reportPeriod === 'weekly' ? 'Weekly' : 'Monthly'}
                  <Badge variant="secondary" className="ml-2">{rePitchedEntries.length}</Badge>
                </CardTitle>
                <CardDescription>Click to view re-pitched attorneys</CardDescription>
              </div>
              <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Unattributed Deals — RAs with appointments but no pitchlog match (from Jan 2026) */}
      <Collapsible defaultOpen>
          <Card className="border-destructive/30 shadow-soft">
            <CardHeader className="cursor-pointer">
              <CollapsibleTrigger className="flex items-center justify-between w-full">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    Unattributed Deals
                    <Badge variant="destructive" className="ml-2">{unattributedDeals.length}</Badge>
                  </CardTitle>
                  <CardDescription>
                    Referring attorneys with scheduled assessments but no pitchlog match — attribute to a sales consultant
                  </CardDescription>
                </div>
                <ChevronDown className="h-5 w-5 text-muted-foreground transition-transform duration-200" />
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search unattributed deals..."
                    value={unattributedSearch}
                    onChange={(e) => setUnattributedSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referring Attorney</TableHead>
                      <TableHead className="text-center">Appointments</TableHead>
                      <TableHead className="text-center">Claimants</TableHead>
                      <TableHead>Earliest Assessment</TableHead>
                      <TableHead>Deal Date</TableHead>
                      <TableHead>Practice Area</TableHead>
                      <TableHead>Attribute To</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnattributedDeals.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                          No matching unattributed deals found.
                        </TableCell>
                      </TableRow>
                    ) : filteredUnattributedDeals.map(deal => (
                      <TableRow key={deal.raId}>
                        <TableCell className="font-medium">{deal.raName}</TableCell>
                        <TableCell className="text-center font-bold text-primary">{deal.appointmentCount}</TableCell>
                        <TableCell className="text-center">{deal.claimantCount}</TableCell>
                        <TableCell className="text-sm">
                          {deal.earliestAppt ? format(new Date(deal.earliestAppt), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            className="w-[140px] text-sm"
                            value={claimDate[deal.raId] || (deal.earliestAppt ? format(new Date(deal.earliestAppt), 'yyyy-MM-dd') : '')}
                            onChange={(e) => setClaimDate(prev => ({ ...prev, [deal.raId]: e.target.value }))}
                            placeholder="Backdate"
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            value={claimPracticeArea[deal.raId] || 'RAF'}
                            onValueChange={(v) => setClaimPracticeArea(prev => ({ ...prev, [deal.raId]: v }))}
                          >
                            <SelectTrigger className="w-[150px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="RAF">RAF</SelectItem>
                              <SelectItem value="Medical Negligence">Medical Negligence</SelectItem>
                              <SelectItem value="Both RAF & Med Neg">Both RAF & Med Neg</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {deal.suggestedSalesPerson && (
                              <Badge variant="outline" className="text-xs mb-1 border-primary/30 text-primary">
                                Suggested: {deal.suggestedSalesPerson}
                              </Badge>
                            )}
                            <Select
                              value={claimConsultant[deal.raId] || ''}
                              onValueChange={(v) => setClaimConsultant(prev => ({ ...prev, [deal.raId]: v }))}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Select consultant" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="In-House" className="font-semibold text-muted-foreground">In-House</SelectItem>
                                {salesPersonsList.map(sp => (
                                  <SelectItem key={sp} value={sp}>{sp}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={claimingId === deal.raId || !claimConsultant[deal.raId]}
                            onClick={() => handleClaimDeal(deal.raId, deal.raName)}
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            {claimingId === deal.raId ? 'Attributing...' : 'Attribute'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
        </Collapsible>
      </Card>
    </div>
  );
};

export default PitchlogSalesReport;
