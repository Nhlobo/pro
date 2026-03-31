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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DollarSign, FileText, Zap, CheckCircle2, Calendar, TrendingDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  syncAODPaymentToAppointments,
  syncShortTermPaymentToAppointments,
  recalculateAODFromAppointments,
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

  // Form state
  const [amount, setAmount] = useState('');
  const [reports, setReports] = useState('1');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (open) {
      fetchSummary();
    }
  }, [open, agreementId]);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      if (agreementType === 'aod') {
        // Fetch AOD doc
        const { data: doc } = await supabase
          .from('aod_documents')
          .select('total_contract_value, deposit_amount, total_reports_agreed')
          .eq('id', agreementId)
          .single();

        // Fetch AOD payments
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
          totalDebt,
          totalDeposits,
          totalRegularPayments: regularPayments,
          totalPaid,
          balance: Math.max(0, totalDebt - totalPaid),
          reportsTakenOut: reportsTaken,
          totalReportsAgreed,
          remainingReports: Math.max(0, totalReportsAgreed - reportsTaken),
        });
        setRecentPayments(allPayments.slice(0, 5));
      } else {
        // Short-term agreement
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
          totalDebt,
          totalDeposits,
          totalRegularPayments: Math.max(0, totalPaid - totalDeposits),
          totalPaid,
          balance: Math.max(0, totalDebt - totalPaid),
          reportsTakenOut: reportsTaken,
          totalReportsAgreed,
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

  const handleRecordPayment = async () => {
    const paymentAmount = parseFloat(amount);
    const reportsCount = parseInt(reports) || 0;

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    if (reportsCount <= 0) {
      toast.error('Specify how many reports are being taken out');
      return;
    }

    setSubmitting(true);
    try {
      if (agreementType === 'aod') {
        // Insert AOD payment
        const { error } = await supabase.from('aod_payments').insert({
          aod_document_id: agreementId,
          payment_amount: paymentAmount,
          payment_type: 'regular',
          payment_date: paymentDate,
          reports_taken_out: reportsCount,
          payment_notes: notes || `Regular payment: ${reportsCount} report(s) taken out`,
        });
        if (error) throw error;

        // Sync to appointments and update scheduled assessments
        const syncResults = await syncAODPaymentToAppointments(
          agreementId, referringAttorneyId, paymentAmount, reportsCount, 'regular', paymentDate
        );

        // Update AOD document status
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

        toast.success(`R${paymentAmount.toLocaleString()} recorded — ${syncResults.appointmentsSynced} assessment(s) updated, ${reportsCount} report(s) marked taken out`);
      } else {
        // Short-term payment sync
        const syncResults = await syncShortTermPaymentToAppointments(
          agreementId, referringAttorneyId, paymentAmount, reportsCount, 'regular', paymentDate
        );

        // Update short-term agreement
        await recalculateShortTermFromAppointments(agreementId, referringAttorneyId);

        toast.success(`R${paymentAmount.toLocaleString()} recorded — ${syncResults.appointmentsSynced} assessment(s) updated`);
      }

      // Reset form
      setAmount('');
      setReports('1');
      setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
      setNotes('');
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);

      // Refresh summary
      await fetchSummary();

      // Trigger global sync
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Record Payment — {attorneyName}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {agreementType === 'aod' ? 'AOD Agreement' : 'Short-term Agreement'} • Payment date stamped automatically
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
                  <Label className="text-xs">Reports Taken *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={reports}
                    onChange={(e) => setReports(e.target.value)}
                    className="mt-1"
                  />
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
                  Auto-updates: Scheduled Assessments deposit/payment • Report status • Agreement balance
                </p>
                <Button
                  onClick={handleRecordPayment}
                  disabled={submitting || !amount}
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

            {/* Recent Payments */}
            {recentPayments.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <FileText className="h-3 w-3" /> Recent Payments
                  </p>
                  <div className="rounded-md border overflow-auto max-h-[200px]">
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
