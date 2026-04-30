import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, TrendingUp, Users, BarChart3, RefreshCw, Download, ChevronDown, UserPlus, AlertCircle, Search, CalendarIcon, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  filterPeriod?: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  periodLabel?: string;
  periodFilteredEntries?: PitchEntry[];
  selectedConsultantFilter?: string;
  isAdmin?: boolean;
}

interface ClosedDeal {
  pitchEntry: PitchEntry;
  referringAttorneyName: string;
  referringAttorneyId: string;
  appointmentCount: number;
  claimantCount: number;
  matchType: 'auto' | 'manual';
}

const PitchlogSalesReport: React.FC<Props> = ({ entries, filterMonthStr, monthLabel, filterPeriod, periodLabel, periodFilteredEntries, selectedConsultantFilter, isAdmin = false }) => {
  // Use global period filter if provided, otherwise fallback to internal
  const [internalPeriod, setInternalPeriod] = useState<'weekly' | 'monthly'>('monthly');
  const activePeriod = filterPeriod || internalPeriod;
  const activeLabel = periodLabel || (internalPeriod === 'weekly' ? 'Last 7 days' : monthLabel);
  // Sync with parent's sales person filter
  const [selectedConsultant, setSelectedConsultant] = useState<string>(selectedConsultantFilter || 'all');

  // Keep in sync when parent filter changes
  React.useEffect(() => {
    if (selectedConsultantFilter !== undefined) {
      setSelectedConsultant(selectedConsultantFilter);
    }
  }, [selectedConsultantFilter]);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimConsultant, setClaimConsultant] = useState<Record<string, string>>({});
  const [unattributedSearch, setUnattributedSearch] = useState('');
  const [claimDate, setClaimDate] = useState<Record<string, string>>({});
  const [claimPracticeArea, setClaimPracticeArea] = useState<Record<string, string>>({});
  // Sales Pipeline filters
  const [pipelineFromDate, setPipelineFromDate] = useState<string>('');
  const [pipelineToDate, setPipelineToDate] = useState<string>('');
  const [pipelineStatus, setPipelineStatus] = useState<'all' | 'closed' | 'pending'>('all');
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

  // Fetch all appointments from January 2026 to date for deal attribution (all statuses)
  const { data: appointmentStats = [] } = useQuery({
    queryKey: ['appointment-stats-for-deals'],
    queryFn: async () => {
      const allAppointments: any[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('appointments')
          .select('id, referring_attorney_id, referring_attorney, appointment_date, created_at, case_status, deposit_amount, service_fee')
          .is('deleted_at', null)
          .gte('appointment_date', '2026-01-01T00:00:00')
          .order('appointment_date', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        allAppointments.push(...(data || []));
        if (!data || data.length < pageSize) break;
        from += pageSize;
      }
      return allAppointments;
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: 1000 * 60 * 60, // hourly refresh for daily/monthly accuracy
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
    // If parent provides pre-filtered entries, use those
    if (periodFilteredEntries) return periodFilteredEntries;
    if (activePeriod === 'monthly') {
      return entries.filter(e => e.month_year === filterMonthStr);
    }
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return entries.filter(e => e.created_at && new Date(e.created_at) >= sevenDaysAgo);
  }, [entries, filterMonthStr, activePeriod, periodFilteredEntries]);

  // Closed deals are all-time (not period-filtered) since a deal is "closed" when
  // appointments exist, regardless of when the pitch entry was created
  const periodClosedDeals = useMemo(() => {
    let filtered = closedDeals;
    // Filter by consultant if selected
    if (selectedConsultant && selectedConsultant !== 'all') {
      filtered = filtered.filter(d => d.pitchEntry.sales_person === selectedConsultant);
    }
    // Only show deals from current month onwards (current month and future)
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    filtered = filtered.filter(d => {
      // Use the earliest appointment date or pitch created_at to determine deal timing
      const dealDate = d.pitchEntry.deal_closed_date 
        ? new Date(d.pitchEntry.deal_closed_date)
        : d.pitchEntry.created_at 
          ? new Date(d.pitchEntry.created_at) 
          : new Date(0);
      return dealDate >= currentMonthStart;
    });
    return filtered;
  }, [closedDeals, selectedConsultant]);

  const rePitchedEntries = useMemo(() => {
    return periodEntries.filter(e => e.pitch_status === 'Re-pitched');
  }, [periodEntries]);

  // Attorneys not doing RAF or Med Neg (practice_area = 'Not Applicable' or 'Other Service')
  const nonRAFMedNegEntries = useMemo(() => {
    return periodEntries.filter(e => 
      e.practice_area === 'Not Applicable' || e.practice_area === 'Other Service'
    );
  }, [periodEntries]);

  // Sales person pipeline summary — Deals Closed sourced from scheduled assessment appointments
  const salesPipeline = useMemo(() => {
    const NON_CONSULTANT_KEY = 'Non-Sales Consultant (Direct)';
    const grouped: Record<string, {
      person: string;
      totalPitched: number;
      rePitched: number;
      followedUp: number;
      dealsClosed: number;
      pending: number;
      conversionRate: number;
    }> = {};

    const ensure = (person: string) => {
      if (!grouped[person]) {
        grouped[person] = {
          person,
          totalPitched: 0,
          rePitched: 0,
          followedUp: 0,
          dealsClosed: 0,
          pending: 0,
          conversionRate: 0,
        };
      }
      return grouped[person];
    };

    // Pitchlog activity per sales person
    periodEntries.forEach(e => {
      const g = ensure(e.sales_person);
      g.totalPitched++;
      if (e.pitch_status === 'Re-pitched') g.rePitched++;
      if (e.pitch_status === 'Followed Up') g.followedUp++;
    });

    // Build attorney -> sales_person map from closed deals (pitchlog ↔ appointments match)
    const raToSalesPerson: Record<string, string> = {};
    closedDeals.forEach(d => {
      if (d.referringAttorneyId && d.pitchEntry.sales_person) {
        raToSalesPerson[d.referringAttorneyId] = d.pitchEntry.sales_person;
      }
    });

    // Count Deals Closed = scheduled assessment appointments (Jan 2026+).
    // Attribute each appointment to its sales consultant; otherwise to "Non-Sales Consultant (Direct)".
    appointmentStats.forEach(a => {
      const sp = a.referring_attorney_id ? raToSalesPerson[a.referring_attorney_id] : null;
      if (sp) {
        ensure(sp).dealsClosed++;
      } else {
        ensure(NON_CONSULTANT_KEY).dealsClosed++;
      }
    });

    return Object.values(grouped).map(g => ({
      ...g,
      pending: Math.max(g.totalPitched - g.dealsClosed, 0),
      conversionRate: g.totalPitched > 0 ? Math.round((g.dealsClosed / g.totalPitched) * 100) : 0,
    })).sort((a, b) => {
      // Keep Non-Sales Consultant row at the bottom
      if (a.person === NON_CONSULTANT_KEY) return 1;
      if (b.person === NON_CONSULTANT_KEY) return -1;
      return b.dealsClosed - a.dealsClosed;
    });
  }, [periodEntries, closedDeals, appointmentStats]);

  const totalConversion = periodEntries.length > 0
    ? Math.round((closedDeals.reduce((sum, d) => sum + d.appointmentCount, 0) / periodEntries.length) * 100) : 0;

  const salesPersonsList = useMemo(() => [...new Set(entries.map(e => e.sales_person))].sort(), [entries]);

  const downloadConsultantPdf = (consultantName: string) => {
    const isAll = consultantName === 'all';
    const consultantEntries = isAll ? periodEntries : periodEntries.filter(e => e.sales_person === consultantName);
    const consultantDeals = isAll ? periodClosedDeals : periodClosedDeals.filter(d => d.pitchEntry.sales_person === consultantName);
    const consultantRePitched = isAll ? rePitchedEntries : rePitchedEntries.filter(e => e.sales_person === consultantName);
    const titleName = isAll ? 'All Sales Consultants' : consultantName;
    const pdfPeriodLabel = activeLabel;

    const doc = new jsPDF({ orientation: 'landscape' });
    const startY = addBrandingToPDF(doc, `Sales Report — ${titleName}`, `${pdfPeriodLabel} | ${consultantEntries.length} pitched, ${consultantDeals.length} closed, ${consultantRePitched.length} re-pitched`);

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
        {!filterPeriod && (
          <Tabs value={internalPeriod} onValueChange={(v) => setInternalPeriod(v as 'weekly' | 'monthly')}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly Report</TabsTrigger>
              <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
        <span className="text-sm text-muted-foreground font-medium">
          {activeLabel}
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
            Sales Pipeline Summary — {activeLabel}
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

    </div>
  );
};

export default PitchlogSalesReport;
