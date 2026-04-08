import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, FileText, Zap, CheckCircle2, Calendar, Users, Search, X, CheckSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  syncAODPaymentToAppointments,
  syncShortTermPaymentToAppointments,
  recalculateShortTermFromAppointments,
} from '@/hooks/usePaymentSync';
import { useAppointmentSync } from '@/contexts/AppointmentSyncContext';

interface RegularPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agreementId: string;
  agreementType: 'aod' | 'short_term';
  attorneyName: string;
  referringAttorneyId: string;
  onPaymentRecorded: () => void;
}

interface PaymentSummary {
  totalDebt: number;
  totalDeposits: number;
  totalRegularPayments: number;
  totalPaid: number;
  balance: number;
  reportsTakenOut: number;
  totalReportsAgreed: number;
  remainingReports: number;
}

interface PaymentRecord {
  id: string;
  payment_amount: number;
  payment_type: string;
  payment_date: string;
  reports_taken_out: number;
  payment_notes: string | null;
}

interface ClaimantOption {
  claimantId: string;
  claimantName: string;
  appointmentId: string;
  appointmentDate: string;
  expertType: string;
  reportStatus: string;
}

export const RegularPaymentDialog: React.FC<RegularPaymentDialogProps> = ({
  open,
  onOpenChange,
  agreementId,
  agreementType,
  attorneyName,
  referringAttorneyId,
  onPaymentRecorded,
}) => {
  const { triggerSync } = useAppointmentSync();
  const [summary, setSummary] = useState<PaymentSummary>({
    totalDebt: 0, totalDeposits: 0, totalRegularPayments: 0, totalPaid: 0,
    balance: 0, reportsTakenOut: 0, totalReportsAgreed: 0, remainingReports: 0,
  });
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Claimant selection state
  const [claimantOptions, setClaimantOptions] = useState<ClaimantOption[]>([]);
  const [selectedClaimants, setSelectedClaimants] = useState<Set<string>>(new Set());
  const [previousAllocations, setPreviousAllocations] = useState<Array<{ claimant_name: string; payment_id: string; created_at: string }>>([]);

  // Form state
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');
  const [claimantSearch, setClaimantSearch] = useState('');
  const [claimantSectionOpen, setClaimantSectionOpen] = useState(true);

  useEffect(() => {
    if (open) {
      fetchSummary();
      fetchClaimants();
      fetchPreviousAllocations();
    }
  }, [open, agreementId]);

  const fetchClaimants = async () => {
    try {
      const { data: appointments } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, payment_status,
          claimants (id, first_name, last_name),
          medical_experts (expert_type)
        `)
        .eq('referring_attorney_id', referringAttorneyId)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: true });

      if (!appointments) return;

      const appointmentIds = appointments.map(a => a.id);
      const { data: reports } = await supabase
        .from('expert_reports')
        .select('appointment_id, report_status')
        .in('appointment_id', appointmentIds);

      // Get already allocated claimant-appointment combos
      const { data: existing } = await supabase
        .from('payment_report_allocations')
        .select('claimant_id, appointment_id')
        .eq('referring_attorney_id', referringAttorneyId);

      const allocatedSet = new Set((existing || []).map(e => `${e.claimant_id}_${e.appointment_id}`));

      const options: ClaimantOption[] = [];
      for (const apt of appointments) {
        const claimant = apt.claimants as any;
        const expert = apt.medical_experts as any;
        if (!claimant) continue;

        const key = `${claimant.id}_${apt.id}`;
        if (allocatedSet.has(key)) continue; // Already taken out

        const report = reports?.find(r => r.appointment_id === apt.id);
        options.push({
          claimantId: claimant.id,
          claimantName: `${claimant.first_name} ${claimant.last_name}`,
          appointmentId: apt.id,
          appointmentDate: apt.appointment_date,
          expertType: expert?.expert_type || 'N/A',
          reportStatus: report?.report_status || 'pending',
        });
      }
      setClaimantOptions(options);
    } catch (error) {
      console.error('Error fetching claimants:', error);
    }
  };

  const fetchPreviousAllocations = async () => {
    try {
      const { data } = await supabase
        .from('payment_report_allocations')
        .select('claimant_name, payment_id, created_at')
        .eq('referring_attorney_id', referringAttorneyId)
        .order('created_at', { ascending: false })
        .limit(20);
      setPreviousAllocations(data || []);
    } catch (error) {
      console.error('Error fetching allocations:', error);
    }
  };

  const fetchSummary = async () => {
    setLoading(true);
    try {
      if (agreementType === 'aod') {
        const { data: doc } = await supabase
          .from('aod_documents')
          .select('total_contract_value, deposit_amount, total_reports_agreed')
          .eq('id', agreementId)
          .single();

        const { data: payments } = await supabase
          .from('aod_payments')
          .select('*')
          .eq('aod_document_id', agreementId)
          .order('payment_date', { ascending: false });

        const allPayments = (payments || []) as PaymentRecord[];
        const deposits = allPayments.filter(p => p.payment_type === 'deposit').reduce((s, p) => s + p.payment_amount, 0);
        const initialDeposit = doc?.deposit_amount || 0;
        const totalDeposits = initialDeposit + deposits;
        const regularPayments = allPayments.filter(p => p.payment_type !== 'deposit').reduce((s, p) => s + p.payment_amount, 0);
        const totalPaid = totalDeposits + regularPayments;
        const totalDebt = doc?.total_contract_value || 0;
        const reportsTaken = allPayments.filter(p => p.payment_type !== 'deposit').reduce((s, p) => s + (p.reports_taken_out || 0), 0);
        const totalReportsAgreed = doc?.total_reports_agreed || 0;

        setSummary({
          totalDebt, totalDeposits, totalRegularPayments: regularPayments, totalPaid,
          balance: Math.max(0, totalDebt - totalPaid),
          reportsTakenOut: reportsTaken, totalReportsAgreed,
          remainingReports: Math.max(0, totalReportsAgreed - reportsTaken),
        });
        setRecentPayments(allPayments.slice(0, 5));
      } else {
        const { data: doc } = await supabase
          .from('short_term_agreements')
          .select('total_contract_value, deposit_amount, payments_made, total_reports_agreed, reports_completed')
          .eq('id', agreementId)
          .single();

        const totalDebt = doc?.total_contract_value || 0;
        const totalDeposits = doc?.deposit_amount || 0;
        const totalPaid = doc?.payments_made || totalDeposits;
        const reportsTaken = doc?.reports_completed || 0;
        const totalReportsAgreed = doc?.total_reports_agreed || 0;

        setSummary({
          totalDebt, totalDeposits, totalRegularPayments: Math.max(0, totalPaid - totalDeposits),
          totalPaid, balance: Math.max(0, totalDebt - totalPaid),
          reportsTakenOut: reportsTaken, totalReportsAgreed,
          remainingReports: Math.max(0, totalReportsAgreed - reportsTaken),
        });
        setRecentPayments([]);
      }
    } catch (error) {
      console.error('Error fetching payment summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleClaimant = (key: string) => {
    setSelectedClaimants(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const filteredClaimants = claimantOptions.filter(c => {
    if (!claimantSearch.trim()) return true;
    const search = claimantSearch.toLowerCase();
    return c.claimantName.toLowerCase().includes(search) ||
      c.expertType.toLowerCase().includes(search) ||
      c.reportStatus.toLowerCase().includes(search);
  });

  const reportsCount = selectedClaimants.size;

  const selectAllFiltered = () => {
    setSelectedClaimants(prev => {
      const next = new Set(prev);
      filteredClaimants.forEach(c => next.add(`${c.claimantId}_${c.appointmentId}`));
      return next;
    });
  };

  const deselectAllFiltered = () => {
    setSelectedClaimants(prev => {
      const next = new Set(prev);
      filteredClaimants.forEach(c => next.delete(`${c.claimantId}_${c.appointmentId}`));
      return next;
    });
  };
  const handleRecordPayment = async () => {
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (reportsCount <= 0) {
      toast.error('Select at least one claimant whose report is being taken out');
      return;
    }

    setSubmitting(true);
    try {
      let paymentId = '';

      if (agreementType === 'aod') {
        const { data: inserted, error } = await supabase.from('aod_payments').insert({
          aod_document_id: agreementId,
          payment_amount: paymentAmount,
          payment_type: 'regular',
          payment_date: paymentDate,
          reports_taken_out: reportsCount,
          payment_notes: notes || `Regular payment: ${reportsCount} report(s) taken out`,
        }).select('id').single();
        if (error) throw error;
        paymentId = inserted.id;

        await syncAODPaymentToAppointments(
          agreementId, referringAttorneyId, paymentAmount, reportsCount, 'regular', paymentDate
        );

        const { data: allPayments } = await supabase
          .from('aod_payments')
          .select('payment_amount')
          .eq('aod_document_id', agreementId);

        const totalPaidNow = (allPayments || []).reduce((s, p) => s + p.payment_amount, 0);
        const { data: doc } = await supabase
          .from('aod_documents')
          .select('total_contract_value, deposit_amount')
          .eq('id', agreementId)
          .single();

        const contractValue = doc?.total_contract_value || 0;
        const totalWithDeposit = totalPaidNow + (doc?.deposit_amount || 0);
        let newStatus = 'pending';
        if (totalWithDeposit >= contractValue && contractValue > 0) newStatus = 'paid';
        else if (totalWithDeposit > 0) newStatus = 'partial';

        await supabase.from('aod_documents').update({
          payment_status: newStatus,
          payments_made: totalPaidNow,
          last_payment_date: paymentDate,
          updated_at: new Date().toISOString(),
        }).eq('id', agreementId);

      } else {
        paymentId = crypto.randomUUID();
        await syncShortTermPaymentToAppointments(
          agreementId, referringAttorneyId, paymentAmount, reportsCount, 'regular', paymentDate
        );
        await recalculateShortTermFromAppointments(agreementId, referringAttorneyId);
      }

      // Record claimant allocations
      const selectedOptions = claimantOptions.filter(c => selectedClaimants.has(`${c.claimantId}_${c.appointmentId}`));
      if (selectedOptions.length > 0) {
        const allocations = selectedOptions.map(c => ({
          payment_id: paymentId,
          payment_type: agreementType,
          claimant_id: c.claimantId,
          claimant_name: c.claimantName,
          appointment_id: c.appointmentId,
          referring_attorney_id: referringAttorneyId,
        }));
        await supabase.from('payment_report_allocations').insert(allocations);
      }

      const claimantNames = selectedOptions.map(c => c.claimantName).join(', ');
      toast.success(`R${paymentAmount.toLocaleString()} recorded — ${reportsCount} report(s): ${claimantNames}`);

      // Reset form
      setAmount('');
      setSelectedClaimants(new Set());
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
      setClaimantSearch('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      await fetchSummary();
      await fetchClaimants();
      await fetchPreviousAllocations();
      triggerSync();
      onPaymentRecorded();
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error('Failed to record payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Record Payment — {attorneyName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {agreementType === 'aod' ? 'AOD Agreement' : 'Short-term Agreement'} • Select claimants whose reports are being taken out
          </p>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading payment summary...</div>
        ) : (
          <div className="space-y-4">
            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Total Debt</p>
                  <p className="text-lg font-bold text-foreground mt-1">R{summary.totalDebt.toLocaleString()}</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Deposit / Paid</p>
                  <p className="text-lg font-bold text-green-600 mt-1">R{summary.totalPaid.toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground">
                    Dep: R{summary.totalDeposits.toLocaleString()} + Pay: R{summary.totalRegularPayments.toLocaleString()}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50 border-orange-200">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Balance</p>
                  <p className={`text-lg font-bold mt-1 ${summary.balance > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                    R{summary.balance.toLocaleString()}
                  </p>
                  {summary.balance === 0 && (
                    <Badge className="text-[9px] bg-green-500/10 text-green-600 mt-1">Paid in Full</Badge>
                  )}
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="p-3 text-center">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reports</p>
                  <div className="mt-1">
                    <p className="text-lg font-bold text-foreground">
                      {summary.reportsTakenOut}/{summary.totalReportsAgreed || '—'}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {summary.remainingReports > 0 ? `${summary.remainingReports} remaining` : summary.totalReportsAgreed > 0 ? 'All taken' : 'Not set'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            {/* Claimant Selection */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <div
                className="flex items-center justify-between cursor-pointer select-none"
                onClick={() => setClaimantSectionOpen(!claimantSectionOpen)}
              >
                <p className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Select Claimants — Reports Taken Out
                </p>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {reportsCount} selected
                  </Badge>
                  {claimantSectionOpen ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {claimantSectionOpen && (
                <div className="mt-2 space-y-2">
                  {/* Search & Bulk Actions */}
                  {claimantOptions.length > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                          placeholder="Search claimant name, expert type, status..."
                          value={claimantSearch}
                          onChange={(e) => setClaimantSearch(e.target.value)}
                          className="h-8 pl-8 pr-8 text-xs"
                        />
                        {claimantSearch && (
                          <button
                            onClick={() => setClaimantSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-[10px] gap-1"
                        onClick={selectAllFiltered}
                      >
                        <CheckSquare className="h-3 w-3" />
                        All
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] gap-1"
                        onClick={deselectAllFiltered}
                      >
                        <X className="h-3 w-3" />
                        Clear
                      </Button>
                    </div>
                  )}

                  {claimantOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No pending claimant reports available for this attorney.</p>
                  ) : filteredClaimants.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No claimants match "{claimantSearch}"</p>
                  ) : (
                    <div className="rounded-md border overflow-auto max-h-[220px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-[10px] w-[40px]"></TableHead>
                            <TableHead className="text-[10px]">Claimant Name</TableHead>
                            <TableHead className="text-[10px]">Assessment Date</TableHead>
                            <TableHead className="text-[10px]">Expert Type</TableHead>
                            <TableHead className="text-[10px]">Report Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredClaimants.map((c) => {
                            const key = `${c.claimantId}_${c.appointmentId}`;
                            const isSelected = selectedClaimants.has(key);
                            return (
                              <TableRow
                                key={key}
                                className={`text-xs cursor-pointer transition-colors hover:bg-accent/50 ${isSelected ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                                onClick={() => toggleClaimant(key)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleClaimant(key)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">
                                  {c.claimantName}
                                  {claimantOptions.filter(o => o.claimantId === c.claimantId).length > 1 && (
                                    <Badge variant="outline" className="ml-1.5 text-[8px] px-1 py-0">
                                      Multiple
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    {c.assessmentDate}
                                  </span>
                                </TableCell>
                                <TableCell>{c.expertType}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-[9px]">{c.reportStatus}</Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {filteredClaimants.length > 0 && claimantSearch && (
                    <p className="text-[9px] text-muted-foreground mt-1">
                      Showing {filteredClaimants.length} of {claimantOptions.length} claimants
                    </p>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Payment Capture Form */}
            <div className="border-2 border-primary/20 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm text-foreground">Capture Regular Payment</span>
                {success && (
                  <span className="flex items-center gap-1 text-xs text-green-600 ml-auto">
                    <CheckCircle2 className="h-3 w-3" /> Recorded & Synced!
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Amount (R) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 15000"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Reports Taken Out</Label>
                  <Input
                    type="number"
                    value={reportsCount}
                    readOnly
                    className="mt-1 bg-muted"
                  />
                  <p className="text-[9px] text-muted-foreground mt-0.5">Auto-calculated from selected claimants</p>
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" /> Date
                  </Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Notes</Label>
                  <Input
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional"
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-muted-foreground">
                  Auto-updates: Scheduled Assessments • Report status • Agreement balance • Claimant tracking
                </p>
                <Button
                  onClick={handleRecordPayment}
                  disabled={submitting || !amount || reportsCount === 0}
                  size="sm"
                >
                  {submitting ? 'Recording...' : (
                    <>
                      <Zap className="h-3 w-3 mr-1" />
                      Record & Sync
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Previously Allocated Reports */}
            {previousAllocations.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Previously Allocated Reports
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previousAllocations.map((a, i) => (
                      <Badge key={i} variant="secondary" className="text-[9px]">
                        {a.claimant_name} — {format(new Date(a.created_at), 'dd MMM yyyy')}
                      </Badge>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Recent Payments */}
            {recentPayments.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Recent Payments
                  </p>
                  <div className="rounded-md border overflow-auto max-h-[160px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Date</TableHead>
                          <TableHead className="text-[10px]">Type</TableHead>
                          <TableHead className="text-[10px] text-right">Amount</TableHead>
                          <TableHead className="text-[10px] text-right">Reports</TableHead>
                          <TableHead className="text-[10px]">Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {recentPayments.map((p) => (
                          <TableRow key={p.id} className="text-xs">
                            <TableCell>{format(new Date(p.payment_date), 'dd MMM yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant={p.payment_type === 'deposit' ? 'secondary' : 'default'} className="text-[9px]">
                                {p.payment_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">R{p.payment_amount.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{p.reports_taken_out || '—'}</TableCell>
                            <TableCell className="text-muted-foreground truncate max-w-[120px]">
                              {p.payment_notes || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
