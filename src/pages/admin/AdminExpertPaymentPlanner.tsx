import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronsUpDown } from 'lucide-react';
import { VirtualizedMultiSelect } from '@/components/ui/virtualized-multi-select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DollarSign, AlertTriangle, CheckCircle2, Clock, FileText,
  CalendarClock, TrendingDown, RefreshCw, Search, X, Plus,
} from 'lucide-react';
import { format } from 'date-fns';

type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';
type Priority = 'low' | 'normal' | 'high' | 'urgent';
type CaseType = 'raf' | 'medical_negligence';

interface InvoiceRow {
  id: string;
  invoice_number: string | null;
  invoice_date: string;
  amount: number;
  amount_paid: number;
  outstanding_balance: number;
  planned_payment_date: string | null;
  priority: Priority;
  payment_status: PaymentStatus;
  notes: string | null;
  expert: { id: string; full_name: string; profession: string; province: string | null } | null;
  attorney: { id: string; firm_name: string } | null;
  claimant: { id: string; full_name: string } | null;
  report: { id: string; case_type: CaseType; report_type: string; date_taken_out: string } | null;
}

const ZAR = (n: number) =>
  new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(n || 0);

const STATUS_STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partial: 'bg-amber-100 text-amber-800 border-amber-200',
  unpaid: 'bg-slate-100 text-slate-800 border-slate-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-200',
};

const PRIORITY_STYLES: Record<Priority, string> = {
  low: 'bg-slate-50 text-slate-600 border-slate-200',
  normal: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  urgent: 'bg-rose-50 text-rose-700 border-rose-200',
};

const CASE_TYPE_LABEL: Record<CaseType, string> = {
  raf: 'RAF',
  medical_negligence: 'Medical Negligence',
};

const AdminExpertPaymentPlanner: React.FC = () => {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allAttorneys, setAllAttorneys] = useState<Array<{ id: string; firm_name: string }>>([]);
  const [allExperts, setAllExperts] = useState<Array<{ id: string; full_name: string }>>([]);
  const [allProvinces, setAllProvinces] = useState<string[]>([]);
  const [allProfessions, setAllProfessions] = useState<string[]>([]);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(true);
  const [filterOptionsError, setFilterOptionsError] = useState<{ step: string; message: string; code?: string; details?: string } | null>(null);
  const [loadError, setLoadError] = useState<{ step: string; message: string; code?: string; details?: string } | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [attorneyFilter, setAttorneyFilter] = useState<string[]>([]);
  const [expertFilter, setExpertFilter] = useState<string[]>([]);
  const [provinceFilter, setProvinceFilter] = useState<string>('all');
  const [professionFilter, setProfessionFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paidFilter, setPaidFilter] = useState<string>('all'); // all | paid | unpaid
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Fixed business window: from 1 Jan 2025 to today
  const DATA_WINDOW_START = '2025-01-01';

  const load = async () => {
    setLoading(true);
    const step = 'load epp_invoices (1 Jan 2025 → today)';
    const todayIso = new Date().toISOString().slice(0, 10);
    try {
      const { data, error } = await supabase
        .from('epp_invoices')
        .select(`
          id, invoice_number, invoice_date, amount, amount_paid, outstanding_balance,
          planned_payment_date, priority, payment_status, notes,
          expert:epp_experts!epp_invoices_expert_id_fkey ( id, full_name, profession, province ),
          attorney:epp_attorneys!epp_invoices_attorney_id_fkey ( id, firm_name ),
          claimant:epp_claimants!epp_invoices_claimant_id_fkey ( id, full_name ),
          report:epp_reports!epp_invoices_report_id_fkey ( id, case_type, report_type, date_taken_out )
        `)
        .gte('invoice_date', DATA_WINDOW_START)
        .lte('invoice_date', todayIso)
        .order('planned_payment_date', { ascending: true, nullsFirst: false })
        .order('invoice_date', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setLoadError(null);
      setRows((data ?? []) as unknown as InvoiceRow[]);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[ExpertPaymentPlanner] ${step} failed:`, err);
      setLoadError({ step, message: msg, code: err?.code, details: err?.details });
      toast.error(`Failed at: ${step}`, { description: msg });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Load filter options for accuracy from the SAME sources as:
  //   - Experts: Expert Credit Control (medical_experts via get_medical_experts_secure, scoped to appointments)
  //   - Attorneys: Schedule Assessment (appointments) + Debt Tracker (aod_documents, short_term_agreements)
  // Window: 1 Jan 2025 → today
  const loadFilterOptions = async () => {
    setFilterOptionsLoading(true);
    setFilterOptionsError(null);
    let step = 'initialize';
    try {
      const SA_PROVINCES = [
        'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo',
        'Mpumalanga', 'Northern Cape', 'North West', 'Western Cape',
      ];

      // 1) Experts — Credit Control source (medical_experts) filtered to those with appointments since window
      step = 'load medical_experts (Credit Control source)';
      const expRes = await supabase.rpc('get_medical_experts_secure');
      if (expRes.error) throw expRes.error;

      step = 'load appointments (Schedule Assessment source)';
      const aptRes = await supabase
        .from('appointments')
        .select('expert_id, referring_attorney_id, appointment_date')
        .gte('appointment_date', DATA_WINDOW_START)
        .is('deleted_at', null)
        .limit(10000);
      if (aptRes.error) throw aptRes.error;

      // 2) Attorneys — Debt Tracker sources (also appointments above)
      step = 'load referring_attorneys (Debt Tracker source)';
      const attRes = await supabase
        .from('referring_attorneys')
        .select('id, name, is_system_company')
        .order('name')
        .limit(10000);
      if (attRes.error) throw attRes.error;

      step = 'load aod_documents (Debt Tracker source)';
      const aodRes = await supabase
        .from('aod_documents')
        .select('referring_attorney_id, created_at')
        .gte('created_at', DATA_WINDOW_START)
        .limit(10000);
      if (aodRes.error) throw aodRes.error;

      step = 'load short_term_agreements (Debt Tracker source)';
      const stRes = await supabase
        .from('short_term_agreements')
        .select('referring_attorney_id, created_at')
        .gte('created_at', DATA_WINDOW_START)
        .limit(10000);
      if (stRes.error) throw stRes.error;

      step = 'process filter option results';
      const appointments = aptRes.data ?? [];
      const expertIdsWithAppts = new Set<string>(
        appointments.map((a: any) => a.expert_id).filter(Boolean)
      );
      const attorneyIdsActive = new Set<string>([
        ...appointments.map((a: any) => a.referring_attorney_id).filter(Boolean),
        ...(aodRes.data ?? []).map((d: any) => d.referring_attorney_id).filter(Boolean),
        ...(stRes.data ?? []).map((s: any) => s.referring_attorney_id).filter(Boolean),
      ]);

      // Attorneys: drop system companies (per Core rule — exclude Kutlwano Associate / is_system_company)
      const atts = (attRes.data ?? [])
        .filter((a: any) => !a.is_system_company && !/kutlwano\s*associate/i.test(a.name || ''))
        .filter((a: any) => attorneyIdsActive.has(a.id))
        .map((a: any) => ({ id: a.id, firm_name: a.name }));
      setAllAttorneys(atts);

      // Experts: only those that have appointments in the window
      const experts = (expRes.data ?? []) as Array<any>;
      const activeExperts = experts.filter(e => expertIdsWithAppts.has(e.id));
      setAllExperts(activeExperts.map(e => ({
        id: e.id,
        full_name: `${e.first_name ?? ''} ${e.last_name ?? ''}`.trim(),
      })));

      const provSet = new Set<string>(SA_PROVINCES);
      const profSet = new Set<string>();
      activeExperts.forEach((e: any) => {
        if (e.province) provSet.add(e.province);
        if (e.expert_type) profSet.add(e.expert_type);
      });
      setAllProvinces(Array.from(provSet).sort());
      setAllProfessions(Array.from(profSet).sort());
      toast.success(`Loaded ${atts.length} attorneys & ${activeExperts.length} experts`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.error(`[ExpertPaymentPlanner] ${step} failed:`, err);
      setFilterOptionsError({ step, message: msg, code: err?.code, details: err?.details });
      toast.error(`Filters failed at: ${step}`, { description: msg });
    } finally {
      setFilterOptionsLoading(false);
    }
  };

  useEffect(() => { loadFilterOptions(); }, []);

  // Realtime sync — any change to invoices/reports refreshes the view
  useEffect(() => {
    const channel = supabase
      .channel('epp-invoices-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'epp_invoices' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const attorneyOptions = useMemo(
    () => allAttorneys.map(a => ({ id: a.id, label: a.firm_name })),
    [allAttorneys]
  );
  const expertOptions = useMemo(
    () => allExperts.map(e => ({ id: e.id, label: e.full_name })),
    [allExperts]
  );
  const provinces = allProvinces;
  const professions = allProfessions;


  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      // Kutlwano Associate hide rule
      if (r.attorney && /kutlwano\s*associate/i.test(r.attorney.firm_name)) return false;

      if (attorneyFilter.length > 0 && (!r.attorney || !attorneyFilter.includes(r.attorney.id))) return false;
      if (expertFilter.length > 0 && (!r.expert || !expertFilter.includes(r.expert.id))) return false;
      if (provinceFilter !== 'all' && r.expert?.province !== provinceFilter) return false;
      if (professionFilter !== 'all' && r.expert?.profession !== professionFilter) return false;
      if (statusFilter !== 'all' && r.payment_status !== statusFilter) return false;
      if (paidFilter === 'paid' && r.payment_status !== 'paid') return false;
      if (paidFilter === 'unpaid' && r.payment_status === 'paid') return false;
      if (urgentOnly && r.priority !== 'urgent') return false;

      if (dateFrom && r.invoice_date < dateFrom) return false;
      if (dateTo && r.invoice_date > dateTo) return false;

      if (q) {
        const hay = [
          r.expert?.full_name, r.attorney?.firm_name, r.claimant?.full_name,
          r.invoice_number, r.report?.report_type, r.expert?.profession,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, attorneyFilter, expertFilter, provinceFilter, professionFilter, statusFilter, paidFilter, urgentOnly, dateFrom, dateTo]);

  // KPIs
  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

    let totalPayable = 0, totalPaid = 0, outstanding = 0;
    let unpaidExpertSet = new Set<string>();
    let reportsTaken = new Set<string>();
    let plannedThisMonth = 0;
    let upcomingPlanned = 0;

    for (const r of rows) {
      if (r.attorney && /kutlwano\s*associate/i.test(r.attorney.firm_name)) continue;
      totalPayable += Number(r.amount || 0);
      totalPaid += Number(r.amount_paid || 0);
      outstanding += Number(r.outstanding_balance || 0);
      if (r.payment_status !== 'paid' && r.expert) unpaidExpertSet.add(r.expert.id);
      if (r.report) reportsTaken.add(r.report.id);
      if (r.planned_payment_date) {
        if (r.planned_payment_date >= monthStart && r.planned_payment_date <= monthEnd) plannedThisMonth += 1;
        if (r.planned_payment_date >= new Date().toISOString().slice(0, 10)) upcomingPlanned += 1;
      }
    }
    return {
      totalPayable, totalPaid, outstanding,
      unpaidExperts: unpaidExpertSet.size,
      reportsTaken: reportsTaken.size,
      plannedThisMonth, upcomingPlanned,
    };
  }, [rows]);

  const selectedTotal = useMemo(
    () => filtered.filter(r => selected.has(r.id)).reduce((a, r) => a + Number(r.outstanding_balance || 0), 0),
    [filtered, selected]
  );

  const toggleAll = (checked: boolean) => {
    if (checked) setSelected(new Set(filtered.map(r => r.id)));
    else setSelected(new Set());
  };

  const clearFilters = () => {
    setSearch(''); setSearchInput(''); setAttorneyFilter([]); setExpertFilter([]); setProvinceFilter('all');
    setProfessionFilter('all'); setStatusFilter('all'); setPaidFilter('all');
    setUrgentOnly(false); setDateFrom(''); setDateTo('');
    setSelected(new Set());
    load();
    toast.success('Filters cleared');
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 lg:p-6 space-y-6 max-w-[1600px]">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Expert Payment Planner</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Plan monthly expert payments, monitor outstanding invoices, group obligations per attorney.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
            <Button size="sm" disabled>
              <Plus className="h-4 w-4 mr-2" /> New Invoice
            </Button>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <KpiCard label="Total Payable" value={ZAR(kpis.totalPayable)} icon={<DollarSign className="h-4 w-4" />} />
          <KpiCard label="Outstanding Balance" value={ZAR(kpis.outstanding)} icon={<TrendingDown className="h-4 w-4" />} tone="warning" />
          <KpiCard label="Paid to Date" value={ZAR(kpis.totalPaid)} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
          <KpiCard label="Unpaid Experts" value={String(kpis.unpaidExperts)} icon={<AlertTriangle className="h-4 w-4" />} />
          <KpiCard label="Reports Taken Out" value={String(kpis.reportsTaken)} icon={<FileText className="h-4 w-4" />} />
          <KpiCard label="Planned This Month" value={String(kpis.plannedThisMonth)} icon={<CalendarClock className="h-4 w-4" />} />
          <KpiCard label="Upcoming Planned" value={String(kpis.upcomingPlanned)} icon={<Clock className="h-4 w-4" />} />
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Filters
              {filterOptionsLoading && (
                <span className="inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Loading attorneys & experts…
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(filterOptionsError || loadError) && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm mb-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <div className="space-y-2 flex-1">
                    {filterOptionsError && (
                      <div>
                        <div className="font-medium text-destructive">
                          Filters failed at: <span className="font-mono">{filterOptionsError.step}</span>
                        </div>
                        <div className="text-muted-foreground break-words">
                          {filterOptionsError.message}{filterOptionsError.code ? ` (code: ${filterOptionsError.code})` : ''}
                        </div>
                        {filterOptionsError.details && (
                          <div className="text-xs text-muted-foreground">{filterOptionsError.details}</div>
                        )}
                      </div>
                    )}
                    {loadError && (
                      <div>
                        <div className="font-medium text-destructive">
                          Invoices failed at: <span className="font-mono">{loadError.step}</span>
                        </div>
                        <div className="text-muted-foreground break-words">
                          {loadError.message}{loadError.code ? ` (code: ${loadError.code})` : ''}
                        </div>
                        {loadError.details && (
                          <div className="text-xs text-muted-foreground">{loadError.details}</div>
                        )}
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={filterOptionsLoading || loading}
                      onClick={() => {
                        if (filterOptionsError) loadFilterOptions();
                        if (loadError || !filterOptionsError) load();
                      }}
                    >
                      {(filterOptionsLoading || loading) ? 'Retrying…' : 'Retry'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="flex gap-2 md:col-span-2 lg:col-span-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search expert, attorney, claimant, invoice…"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') setSearch(searchInput); }}
                    className="pl-9"
                    disabled={filterOptionsLoading}
                  />
                </div>
                <Button size="sm" onClick={() => setSearch(searchInput)} disabled={filterOptionsLoading}>
                  <Search className="h-4 w-4 mr-1" /> Search
                </Button>
              </div>
              <VirtualizedMultiSelect
                options={attorneyOptions}
                value={attorneyFilter}
                onChange={setAttorneyFilter}
                placeholderAll="All attorneys"
                searchPlaceholder="Search attorneys…"
                emptyText="No attorneys found."
                loading={filterOptionsLoading}
              />
              <VirtualizedMultiSelect
                options={expertOptions}
                value={expertFilter}
                onChange={setExpertFilter}
                placeholderAll="All experts"
                searchPlaceholder="Search experts…"
                emptyText="No experts found."
                loading={filterOptionsLoading}
              />
              <Select value={provinceFilter} onValueChange={setProvinceFilter} disabled={filterOptionsLoading}>
                <SelectTrigger><SelectValue placeholder="Province" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All provinces</SelectItem>
                  {provinces.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={professionFilter} onValueChange={setProfessionFilter} disabled={filterOptionsLoading}>
                <SelectTrigger><SelectValue placeholder="Profession" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All professions</SelectItem>
                  {professions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter} disabled={filterOptionsLoading}>
                <SelectTrigger><SelectValue placeholder="Payment status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial">Partial</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Select value={paidFilter} onValueChange={setPaidFilter} disabled={filterOptionsLoading}>
                <SelectTrigger><SelectValue placeholder="Paid / unpaid" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Paid + Unpaid</SelectItem>
                  <SelectItem value="paid">Paid only</SelectItem>
                  <SelectItem value="unpaid">Unpaid only</SelectItem>
                </SelectContent>
              </Select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="From" disabled={filterOptionsLoading} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="To" disabled={filterOptionsLoading} />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={urgentOnly} onCheckedChange={(v) => setUrgentOnly(!!v)} disabled={filterOptionsLoading} />
                Urgent only
              </label>
              <Button variant="outline" size="sm" onClick={clearFilters} disabled={loading || filterOptionsLoading}>
                <X className="h-4 w-4 mr-1" /> Clear filters & reload
              </Button>
              <div className="ml-auto text-sm text-muted-foreground">
                {filtered.length} row{filtered.length === 1 ? '' : 's'}
                {selected.size > 0 && (
                  <span className="ml-3 font-medium text-foreground">
                    Selected: {selected.size} · {ZAR(selectedTotal)}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expert Payment Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Expert Invoices</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
                        onCheckedChange={(v) => toggleAll(!!v)}
                      />
                    </TableHead>
                    <TableHead>Expert</TableHead>
                    <TableHead>Profession</TableHead>
                    <TableHead>Province</TableHead>
                    <TableHead>Attorney</TableHead>
                    <TableHead>Claimant</TableHead>
                    <TableHead>Case Type</TableHead>
                    <TableHead>Report Type</TableHead>
                    <TableHead>Date Taken Out</TableHead>
                    <TableHead className="text-right">Invoice</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Planned</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-10 text-muted-foreground">Loading…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={16} className="text-center py-10 text-muted-foreground">
                        No expert invoices match the current filters. Add experts, attorneys and invoices to begin planning.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((r) => (
                      <TableRow key={r.id} className="hover:bg-muted/40">
                        <TableCell>
                          <Checkbox
                            checked={selected.has(r.id)}
                            onCheckedChange={(v) => {
                              setSelected(prev => {
                                const n = new Set(prev);
                                if (v) n.add(r.id); else n.delete(r.id);
                                return n;
                              });
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium whitespace-nowrap">{r.expert?.full_name ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.expert?.profession ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.expert?.province ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.attorney?.firm_name ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.claimant?.full_name ?? '—'}</TableCell>
                        <TableCell>{r.report ? CASE_TYPE_LABEL[r.report.case_type] : '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">{r.report?.report_type ?? '—'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.report?.date_taken_out ? format(new Date(r.report.date_taken_out), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap font-medium">{ZAR(r.amount)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">{ZAR(r.amount_paid)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap font-semibold">{ZAR(r.outstanding_balance)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.planned_payment_date ? format(new Date(r.planned_payment_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={PRIORITY_STYLES[r.priority]}>
                            {r.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={STATUS_STYLES[r.payment_status]}>
                            {r.payment_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{r.notes ?? ''}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const KpiCard: React.FC<{
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: 'default' | 'success' | 'warning';
}> = ({ label, value, icon, tone = 'default' }) => {
  const toneClass =
    tone === 'success' ? 'text-emerald-600'
    : tone === 'warning' ? 'text-amber-600'
    : 'text-muted-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className={`flex items-center gap-2 text-xs font-medium ${toneClass}`}>
          {icon}<span className="uppercase tracking-wide">{label}</span>
        </div>
        <div className="mt-2 text-xl font-bold tracking-tight truncate" title={value}>{value}</div>
      </CardContent>
    </Card>
  );
};

export default AdminExpertPaymentPlanner;
