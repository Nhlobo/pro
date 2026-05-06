import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, AlertCircle, CheckCircle2, Clock, RefreshCw, ArrowRightLeft, Zap, Users, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { recalculateAODFromAppointments, recalculateShortTermFromAppointments } from '@/hooks/usePaymentSync';
import { RegularPaymentDialog } from '@/components/RegularPaymentDialog';

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance & Payments</h1>
          <p className="text-sm text-muted-foreground">Bidirectional payment sync: Assessments ↔ AOD ↔ Short-term Agreements</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFullSync}
          disabled={syncing}
          className="gap-2"
        >
          {syncing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
          {syncing ? 'Syncing...' : 'Sync All Payments'}
        </Button>
      </div>

      <Card className="border-border/50">
        <CardContent className="pt-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search referring attorney..."
                value={attorneySearchDraft}
                onChange={(event) => setAttorneySearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') applyAttorneySearch();
                }}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={applyAttorneySearch} className="gap-2">
                <Search className="h-4 w-4" />
                Search
              </Button>
              {attorneySearch && (
                <Button variant="outline" onClick={clearAttorneySearch} className="gap-2">
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <DollarSign className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">R{(totalValue / 1000).toFixed(0)}k</p>
            <p className="text-[11px] text-muted-foreground">Total Contract Value</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 mb-2" />
            <p className="text-2xl font-bold text-green-600">R{(totalPaid / 1000).toFixed(0)}k</p>
            <p className="text-[11px] text-muted-foreground">Total Payments Received</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <Clock className="h-5 w-5 text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-blue-500">R{(totalDiscount / 1000).toFixed(1)}k</p>
            <p className="text-[11px] text-muted-foreground">Discount Applied</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <AlertCircle className="h-5 w-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold text-orange-500">R{(outstanding / 1000).toFixed(0)}k</p>
            <p className="text-[11px] text-muted-foreground">Outstanding Balance</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <Users className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{filteredConsolidatedAttorneys.length}</p>
            <p className="text-[11px] text-muted-foreground">Long-Term Attorneys</p>
          </CardContent>
        </Card>
      </div>

      {/* Long-Term AOD – Consolidated by Referring Attorney */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Long-Term AOD – Referring Attorney Debts</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{filteredConsolidatedAttorneys.length} attorneys</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Referring Attorney</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">AODs</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Debt</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Discount</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Deposits</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Payments</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Balance</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Reports</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredConsolidatedAttorneys.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">No long-term AOD agreements</td></tr>
                ) : filteredConsolidatedAttorneys.map((att) => (
                  <tr key={att.attorneyId} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium text-foreground">{att.attorneyName}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="text-[10px]">{att.aodCount}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      R{att.totalDebt.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-blue-500 font-medium">
                      R{att.totalDiscount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      R{att.totalDeposits.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right text-green-600 font-medium">
                      R{att.totalPayments.toLocaleString()}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${att.balance > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                      R{att.balance.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant="outline" className="text-[10px]">
                        {att.reportsTaken}{att.totalReports > 0 ? `/${att.totalReports}` : ''}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`text-[10px] ${
                        att.paymentStatus === 'paid' ? 'bg-green-500/10 text-green-600' :
                        att.paymentStatus === 'partial' ? 'bg-blue-500/10 text-blue-600' :
                        'bg-orange-500/10 text-orange-500'
                      }`}>
                        {att.paymentStatus}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs gap-1 h-7"
                        onClick={() => openPaymentDialog(att.latestAodId, 'aod', att.attorneyName, att.attorneyId)}
                      >
                        <Zap className="h-3 w-3" />
                        Record Payment
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Short-term Agreements Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Short-term Agreements</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{filteredShortTermDocs.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Referring Attorney</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Debt</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Deposit / Paid</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Balance</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Reports Taken</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : filteredShortTermDocs.length === 0 ? (
                  <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No short-term agreements found</td></tr>
                ) : filteredShortTermDocs.map((doc) => {
                  const paid = doc.payments_made || doc.deposit_amount || 0;
                  const balance = Math.max(0, (doc.total_contract_value || 0) - paid);
                  const reportsTaken = doc.reports_completed || 0;
                  const totalReports = doc.total_reports_agreed || 0;
                  const referringAttorneyName = doc.referring_attorneys?.name || doc.debtor_law_firm_name || '–';

                  return (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-medium text-foreground">
                        {referringAttorneyName}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">
                        {doc.contract_description || '–'}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        R{(doc.total_contract_value || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-green-600 font-medium">
                        R{paid.toLocaleString()}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold ${balance > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                        R{balance.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant="outline" className="text-[10px]">
                          {reportsTaken}{totalReports > 0 ? `/${totalReports}` : ''}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={`text-[10px] ${
                          doc.payment_status === 'paid' ? 'bg-green-500/10 text-green-600' :
                          doc.payment_status === 'partial' ? 'bg-blue-500/10 text-blue-600' :
                          doc.payment_status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                          'bg-orange-500/10 text-orange-500'
                        }`}>
                          {doc.payment_status || 'pending'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 h-7"
                          onClick={() => openPaymentDialog(doc.id, 'short_term', referringAttorneyName, doc.referring_attorney_id)}
                        >
                          <Zap className="h-3 w-3" />
                          Record Payment
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
};

export default AdminFinance;
