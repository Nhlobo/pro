import React, { useEffect, useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle2, Clock, RefreshCw, ArrowRightLeft, Zap, Users, Search, X, Landmark, FileStack, History } from "lucide-react";
import { toast } from 'sonner';
import { recalculateAODFromAppointments, recalculateShortTermFromAppointments } from '@/hooks/usePaymentSync';
import { RegularPaymentDialog } from '@/components/RegularPaymentDialog';
import FinanceAuditTrail from '@/components/FinanceAuditTrail';
import {
  AdminPage,
  AdminHeader,
  AdminCard,
  AdminCardHeader,
  AdminCardBody,
  AdminStatCard,
  AdminEmptyState,
  AdminLoadingState,
  AdminTabList,
  AdminTabTrigger,
} from '@/components/admin/ui/AdminUI';

import { RandSign } from "@/components/icons/RandSign";
interface ConsolidatedAttorney {
  attorneyId: string;
  attorneyName: string;
  totalDebt: number;
  totalDeposits: number;
  totalPayments: number;
  totalPaid: number;
  totalDiscount: number;
  balance: number;
  reportsTaken: number;
  totalReports: number;
  aodCount: number;
  latestAodId: string;
  paymentStatus: string;
}

interface AttorneyRef {
  name?: string | null;
  is_system_company?: boolean | null;
}

interface AodFinanceDoc {
  id: string;
  total_contract_value: number | null;
  deposit_amount: number | null;
  discount_amount: number | null;
  referring_attorney_id: string;
  total_reports_agreed: number | null;
  referring_attorneys?: AttorneyRef | null;
}

interface ShortTermFinanceDoc {
  id: string;
  contract_description: string | null;
  total_contract_value: number | null;
  deposit_amount: number | null;
  payments_made: number | null;
  discount_amount: number | null;
  payment_status: string | null;
  referring_attorney_id: string;
  total_reports_agreed: number | null;
  reports_completed: number | null;
  debtor_law_firm_name?: string | null;
  referring_attorneys?: AttorneyRef | null;
}

const AdminFinance: React.FC = () => {
  const [aodDocs, setAodDocs] = useState<AodFinanceDoc[]>([]);
  const [shortTermDocs, setShortTermDocs] = useState<ShortTermFinanceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [attorneySearchDraft, setAttorneySearchDraft] = useState('');
  const [attorneySearch, setAttorneySearch] = useState('');

  // Payment dialog state
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    agreementId: string;
    agreementType: 'aod' | 'short_term';
    attorneyName: string;
    referringAttorneyId: string;
  }>({ open: false, agreementId: '', agreementType: 'aod', attorneyName: '', referringAttorneyId: '' });

  useEffect(() => {
    fetchAll();
    window.addEventListener('agreement-data-updated', fetchAll);
    window.addEventListener('appointment-financials-updated', fetchAll);

    // Real-time subscriptions: any change to AODs, short-term agreements,
    // or appointments triggers an immediate refresh so totals stay in sync.
    let debounce: any = null;
    const scheduleRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => fetchAll(), 400);
    };
    const channel = supabase
      .channel('admin-finance-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aod_documents' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'short_term_agreements' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'aod_payments' }, scheduleRefresh)
      .subscribe();

    return () => {
      window.removeEventListener('agreement-data-updated', fetchAll);
      window.removeEventListener('appointment-financials-updated', fetchAll);
      if (debounce) clearTimeout(debounce);
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const aodSelect = 'id, file_name, total_contract_value, deposit_amount, payments_made, discount_amount, payment_status, referring_attorney_id, total_reports_agreed, reports_released, created_at, referring_attorneys!aod_documents_law_firm_id_fkey(name, is_system_company)';
    const stSelect = 'id, contract_description, total_contract_value, deposit_amount, payments_made, discount_amount, payment_status, referring_attorney_id, status, total_reports_agreed, reports_completed, debtor_law_firm_name, referring_attorneys(name, is_system_company)';

    const [aodResult, stResult] = await Promise.all([
      supabase.from('aod_documents').select(aodSelect).order('created_at', { ascending: false }),
      supabase.from('short_term_agreements').select(stSelect).order('created_at', { ascending: false }).limit(100),
    ]);
    const filtered = ((aodResult.data || []) as AodFinanceDoc[]).filter((d) => !d.referring_attorneys?.is_system_company);
    const filteredShortTerm = ((stResult.data || []) as ShortTermFinanceDoc[]).filter((d) => !d.referring_attorneys?.is_system_company);

    // Auto-recalc from live appointments so any payment / discount captured in
    // Scheduled Assessment is reflected on AOD + Short-term tables (best-effort).
    try {
      await Promise.all([
        ...filtered.map((d) => recalculateAODFromAppointments(d.id, d.referring_attorney_id)),
        ...filteredShortTerm.map((d) => recalculateShortTermFromAppointments(d.id, d.referring_attorney_id)),
      ]);
      const [aodResult2, stResult2] = await Promise.all([
        supabase.from('aod_documents').select(aodSelect).order('created_at', { ascending: false }),
        supabase.from('short_term_agreements').select(stSelect).order('created_at', { ascending: false }).limit(100),
      ]);
      setAodDocs(((aodResult2.data || []) as AodFinanceDoc[]).filter((d) => !d.referring_attorneys?.is_system_company));
      setShortTermDocs(((stResult2.data || []) as ShortTermFinanceDoc[]).filter((d) => !d.referring_attorneys?.is_system_company));
    } catch (e) {
      console.warn('[AdminFinance] auto-recalc failed (non-fatal)', e);
      setAodDocs(filtered);
      setShortTermDocs(filteredShortTerm);
    }
    setLoading(false);
  };

  const handleFullSync = async () => {
    setSyncing(true);
    try {
      for (const doc of aodDocs) {
        await recalculateAODFromAppointments(doc.id, doc.referring_attorney_id);
      }
      for (const doc of shortTermDocs) {
        await recalculateShortTermFromAppointments(doc.id, doc.referring_attorney_id);
      }
      await fetchAll();
      toast.success('All payment data synced between assessments, AODs, and short-term agreements');
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync payment data');
    } finally {
      setSyncing(false);
    }
  };

  // Get AOD payments total for each doc
  const [aodPaymentTotals, setAodPaymentTotals] = useState<Record<string, { paid: number; reportsTaken: number }>>({});
  useEffect(() => {
    const fetchPaymentTotals = async () => {
      if (aodDocs.length === 0) return;
      const docIds = aodDocs.map(d => d.id);
      const { data } = await supabase
        .from('aod_payments')
        .select('aod_document_id, payment_amount, reports_taken_out, payment_type')
        .in('aod_document_id', docIds);

      const totals: Record<string, { paid: number; reportsTaken: number }> = {};
      for (const doc of aodDocs) {
        const docPayments = (data || []).filter(p => p.aod_document_id === doc.id);
        const paid = docPayments.reduce((s, p) => s + p.payment_amount, 0);
        const reportsTaken = docPayments.filter(p => p.payment_type !== 'deposit').reduce((s, p) => s + (p.reports_taken_out || 0), 0);
        totals[doc.id] = { paid, reportsTaken };
      }
      setAodPaymentTotals(totals);
    };
    fetchPaymentTotals();
  }, [aodDocs]);

  // Consolidate AOD docs by referring attorney for long-term view
  const consolidatedAttorneys = useMemo((): ConsolidatedAttorney[] => {
    const attorneyMap = new Map<string, ConsolidatedAttorney>();

    for (const doc of aodDocs) {
      const name = (doc.referring_attorneys?.name || '–').toLowerCase().trim();
      const deposit = Number(doc.deposit_amount || 0);
      // After recalc, doc.deposit_amount holds the collected total from appointments.
      // aod_payments may also contain explicit ledger entries — use whichever is higher.
      const recordedAodPayments = aodPaymentTotals[doc.id]?.paid || 0;
      const docPaymentsMade = Number((doc as any).payments_made || 0);
      const aodPaid = Math.max(recordedAodPayments, docPaymentsMade);
      const reportsTaken = Math.max(
        aodPaymentTotals[doc.id]?.reportsTaken || 0,
        Number((doc as any).reports_released || 0)
      );

      if (!attorneyMap.has(name)) {
        attorneyMap.set(name, {
          attorneyId: doc.referring_attorney_id,
          attorneyName: doc.referring_attorneys?.name || '–',
          totalDebt: 0,
          totalDeposits: 0,
          totalPayments: 0,
          totalPaid: 0,
          totalDiscount: 0,
          balance: 0,
          reportsTaken: 0,
          totalReports: 0,
          aodCount: 0,
          latestAodId: doc.id,
          paymentStatus: 'pending',
        });
      }

      const entry = attorneyMap.get(name)!;
      entry.totalDebt += Number(doc.total_contract_value || 0);
      entry.totalDeposits += deposit;
      entry.totalPayments += aodPaid;
      entry.totalDiscount += Number(doc.discount_amount || 0);
      // Avoid double-counting when payments_made was already folded into deposit during recalc
      entry.totalPaid = Math.max(entry.totalDeposits, entry.totalDeposits + entry.totalPayments - deposit);
      entry.balance = Math.max(0, entry.totalDebt - entry.totalPaid);
      entry.reportsTaken += reportsTaken;
      entry.totalReports += Number(doc.total_reports_agreed || 0);
      entry.aodCount += 1;
      entry.paymentStatus = entry.balance <= 0 && entry.totalDebt > 0 ? 'paid' : entry.totalPaid > 0 ? 'partial' : 'pending';
    }

    return Array.from(attorneyMap.values()).sort((a, b) => b.balance - a.balance);
  }, [aodDocs, aodPaymentTotals]);

  const normalizedAttorneySearch = attorneySearch.trim().toLowerCase();
  const filteredConsolidatedAttorneys = useMemo(() => {
    if (!normalizedAttorneySearch) return consolidatedAttorneys;
    return consolidatedAttorneys.filter((att) =>
      att.attorneyName.toLowerCase().includes(normalizedAttorneySearch)
    );
  }, [consolidatedAttorneys, normalizedAttorneySearch]);

  const filteredShortTermDocs = useMemo(() => {
    if (!normalizedAttorneySearch) return shortTermDocs;
    return shortTermDocs.filter((doc) => {
      const attorneyName = (doc.referring_attorneys?.name || doc.debtor_law_firm_name || '').toLowerCase();
      return attorneyName.includes(normalizedAttorneySearch);
    });
  }, [shortTermDocs, normalizedAttorneySearch]);

  const applyAttorneySearch = () => setAttorneySearch(attorneySearchDraft);
  const clearAttorneySearch = () => {
    setAttorneySearchDraft('');
    setAttorneySearch('');
  };

  const totalAODValue = filteredConsolidatedAttorneys.reduce((s, a) => s + a.totalDebt, 0);
  const totalAODPaid = filteredConsolidatedAttorneys.reduce((s, a) => s + a.totalPaid, 0);
  const totalAODDiscount = filteredConsolidatedAttorneys.reduce((s, a) => s + a.totalDiscount, 0);
  const totalSTValue = filteredShortTermDocs.reduce((s, d) => s + (d.total_contract_value || 0), 0);
  const totalSTPaid = filteredShortTermDocs.reduce((s, d) => s + (d.payments_made || d.deposit_amount || 0), 0);
  const totalSTDiscount = filteredShortTermDocs.reduce((s, d) => s + (d.discount_amount || 0), 0);
  const totalValue = totalAODValue + totalSTValue;
  const totalPaid = totalAODPaid + totalSTPaid;
  const totalDiscount = totalAODDiscount + totalSTDiscount;
  const outstanding = Math.max(0, totalValue - totalPaid);

  const openPaymentDialog = (id: string, type: 'aod' | 'short_term', name: string, attorneyId: string) => {
    setPaymentDialog({ open: true, agreementId: id, agreementType: type, attorneyName: name, referringAttorneyId: attorneyId });
  };

  // ===== UI-only state for the redesigned layout (no business/data logic here) =====
  // Long-Term AOD, Short-term Agreements and the Audit Trail used to sit stacked on
  // one long page. Splitting them into tabs — the same module-switcher pattern as
  // Appointment Engine / System Control / Sales Performance — means staff land on
  // one focused table instead of scrolling past everything to find it.
  const [activeTab, setActiveTab] = useState<'aod' | 'short_term' | 'audit'>('aod');
  const dateLabel = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <AdminPage className="max-w-7xl">
      <AdminHeader
        eyebrow="Finance"
        title="Finance & Payments"
        description={dateLabel}
        icon={RandSign as any}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-none"
            onClick={handleFullSync}
            disabled={syncing}
          >
            {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
            {syncing ? 'Syncing…' : 'Sync All Payments'}
          </Button>
        }
      />

      <p className="-mt-2 text-xs text-slate-500">
        Bidirectional payment sync: Assessments ↔ AOD ↔ Short-term Agreements
      </p>

      {/* -------- Search (filters both AOD and Short-term tables) -------- */}
      <AdminCard>
        <AdminCardBody className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search referring attorney…"
              value={attorneySearchDraft}
              onChange={(event) => setAttorneySearchDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') applyAttorneySearch(); }}
              className="rounded-none pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gradient-teal rounded-none border" onClick={applyAttorneySearch}>
              <Search className="h-4 w-4 mr-2" /> Search
            </Button>
            {attorneySearch && (
              <Button size="sm" variant="outline" className="rounded-none" onClick={clearAttorneySearch}>
                <X className="h-4 w-4 mr-2" /> Clear
              </Button>
            )}
          </div>
        </AdminCardBody>
      </AdminCard>

      {/* -------- Financial summary -------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <AdminStatCard label="Total contract value" value={`R${(totalValue / 1000).toFixed(0)}k`} icon={RandSign as any} loading={loading} />
        <AdminStatCard label="Total payments received" value={`R${(totalPaid / 1000).toFixed(0)}k`} icon={CheckCircle2} loading={loading} />
        <AdminStatCard label="Discount applied" value={`R${(totalDiscount / 1000).toFixed(1)}k`} icon={Clock} loading={loading} />
        <AdminStatCard label="Outstanding balance" value={`R${(outstanding / 1000).toFixed(0)}k`} icon={AlertCircle} loading={loading} />
        <AdminStatCard label="Long-term attorneys" value={String(filteredConsolidatedAttorneys.length)} icon={Users} loading={loading} />
      </div>

      {/* -------- Module switcher: AOD / Short-term / Audit Trail -------- */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <AdminTabList sticky columns={3}>
          <AdminTabTrigger
            value="aod"
            label="Long-Term AOD"
            icon={Landmark}
            badge={filteredConsolidatedAttorneys.length || undefined}
            center
          />
          <AdminTabTrigger
            value="short_term"
            label="Short-term Agreements"
            icon={FileStack}
            badge={filteredShortTermDocs.length || undefined}
            center
          />
          <AdminTabTrigger value="audit" label="Audit Trail" icon={History} center />
        </AdminTabList>

        <div className="mt-4">
          {/* ================= LONG-TERM AOD ================= */}
          <TabsContent value="aod" className="mt-0 focus-visible:outline-none">
            <AdminCard>
              <AdminCardHeader
                icon={Landmark}
                title="Long-Term AOD — Referring Attorney Debts"
                description={`${filteredConsolidatedAttorneys.length} attorney${filteredConsolidatedAttorneys.length === 1 ? '' : 's'}`}
              />
              {loading ? (
                <AdminLoadingState label="Loading long-term AOD debts…" />
              ) : filteredConsolidatedAttorneys.length === 0 ? (
                <AdminEmptyState
                  icon={Landmark}
                  title="No long-term AOD agreements"
                  description={attorneySearch ? 'Try a different attorney name, or clear the search.' : undefined}
                  action={attorneySearch ? (
                    <Button variant="outline" size="sm" className="rounded-none mt-2" onClick={clearAttorneySearch}>
                      <X className="h-4 w-4 mr-2" />Clear search
                    </Button>
                  ) : undefined}
                />
              ) : (
                <div className="max-h-[65vh] overflow-auto">
                  <Table className="text-xs [&_th]:h-8 [&_th]:px-3 [&_th]:py-1 [&_th]:text-[11px] [&_td]:px-3 [&_td]:py-2 [&_td]:align-middle">
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                      <TableRow>
                        <TableHead>Referring Attorney</TableHead>
                        <TableHead className="text-center">AODs</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Total Debt</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Discount</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Deposits</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Payments</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
                        <TableHead className="text-center">Reports</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredConsolidatedAttorneys.map((att) => (
                        <TableRow key={att.attorneyId} className="hover:bg-black/[0.02]">
                          <TableCell className="font-medium">{att.attorneyName}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="rounded-none text-[10px]">{att.aodCount}</Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                            R{att.totalDebt.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium text-blue-600">
                            R{att.totalDiscount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                            R{att.totalDeposits.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap font-medium text-emerald-700">
                            R{att.totalPayments.toLocaleString()}
                          </TableCell>
                          <TableCell className={`text-right whitespace-nowrap font-bold ${att.balance > 0 ? 'text-orange-600' : 'text-emerald-700'}`}>
                            R{att.balance.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className="rounded-none text-[10px]">
                              {att.reportsTaken}{att.totalReports > 0 ? `/${att.totalReports}` : ''}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`rounded-none text-[10px] ${
                                att.paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                att.paymentStatus === 'partial' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                'bg-amber-100 text-amber-800 border-amber-200'
                              }`}
                            >
                              {att.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 rounded-none text-xs"
                              onClick={() => openPaymentDialog(att.latestAodId, 'aod', att.attorneyName, att.attorneyId)}
                            >
                              <Zap className="h-3.5 w-3.5 mr-1" /> Record Payment
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AdminCard>
          </TabsContent>

          {/* ================= SHORT-TERM AGREEMENTS ================= */}
          <TabsContent value="short_term" className="mt-0 focus-visible:outline-none">
            <AdminCard>
              <AdminCardHeader
                icon={FileStack}
                title="Short-term Agreements"
                description={`${filteredShortTermDocs.length} agreement${filteredShortTermDocs.length === 1 ? '' : 's'}`}
              />
              {loading ? (
                <AdminLoadingState label="Loading short-term agreements…" />
              ) : filteredShortTermDocs.length === 0 ? (
                <AdminEmptyState
                  icon={FileStack}
                  title="No short-term agreements found"
                  description={attorneySearch ? 'Try a different attorney name, or clear the search.' : undefined}
                  action={attorneySearch ? (
                    <Button variant="outline" size="sm" className="rounded-none mt-2" onClick={clearAttorneySearch}>
                      <X className="h-4 w-4 mr-2" />Clear search
                    </Button>
                  ) : undefined}
                />
              ) : (
                <div className="max-h-[65vh] overflow-auto">
                  <Table className="text-xs [&_th]:h-8 [&_th]:px-3 [&_th]:py-1 [&_th]:text-[11px] [&_td]:px-3 [&_td]:py-2 [&_td]:align-middle">
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                      <TableRow>
                        <TableHead>Referring Attorney</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Total Debt</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Discount</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Deposit / Paid</TableHead>
                        <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
                        <TableHead className="text-center">Reports Taken</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredShortTermDocs.map((doc) => {
                        const paid = doc.payments_made || doc.deposit_amount || 0;
                        const balance = Math.max(0, (doc.total_contract_value || 0) - paid);
                        const reportsTaken = doc.reports_completed || 0;
                        const totalReports = doc.total_reports_agreed || 0;
                        const referringAttorneyName = doc.referring_attorneys?.name || doc.debtor_law_firm_name || '–';

                        return (
                          <TableRow key={doc.id} className="hover:bg-black/[0.02]">
                            <TableCell className="font-medium">{referringAttorneyName}</TableCell>
                            <TableCell className="font-medium">{doc.contract_description || '–'}</TableCell>
                            <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                              R{(doc.total_contract_value || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap font-medium text-blue-600">
                              R{(doc.discount_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap font-medium text-emerald-700">
                              R{paid.toLocaleString()}
                            </TableCell>
                            <TableCell className={`text-right whitespace-nowrap font-bold ${balance > 0 ? 'text-orange-600' : 'text-emerald-700'}`}>
                              R{balance.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className="rounded-none text-[10px]">
                                {reportsTaken}{totalReports > 0 ? `/${totalReports}` : ''}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                className={`rounded-none text-[10px] ${
                                  doc.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                                  doc.payment_status === 'partial' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                                  doc.payment_status === 'overdue' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                                  'bg-amber-100 text-amber-800 border-amber-200'
                                }`}
                              >
                                {doc.payment_status || 'pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 rounded-none text-xs"
                                onClick={() => openPaymentDialog(doc.id, 'short_term', referringAttorneyName, doc.referring_attorney_id)}
                              >
                                <Zap className="h-3.5 w-3.5 mr-1" /> Record Payment
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AdminCard>
          </TabsContent>

          {/* ================= AUDIT TRAIL ================= */}
          <TabsContent value="audit" className="mt-0 focus-visible:outline-none">
            <FinanceAuditTrail />
          </TabsContent>
        </div>
      </Tabs>

      {/* Regular Payment Dialog */}
      <RegularPaymentDialog
        open={paymentDialog.open}
        onOpenChange={(open) => setPaymentDialog(prev => ({ ...prev, open }))}
        agreementId={paymentDialog.agreementId}
        agreementType={paymentDialog.agreementType}
        attorneyName={paymentDialog.attorneyName}
        referringAttorneyId={paymentDialog.referringAttorneyId}
        onPaymentRecorded={fetchAll}
      />
    </AdminPage>
  );
};

export default AdminFinance;
