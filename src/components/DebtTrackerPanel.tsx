import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Check, FileText, CreditCard, Pencil, TrendingDown, X } from 'lucide-react';

interface DebtTrackerPanelProps {
  referringAttorneyId: string;
  paymentTerms: string;
}

interface AgreementDebt {
  id: string;
  source: 'aod' | 'short_term';
  file_name: string;
  total_contract_value: number;
  deposit_amount: number;
  payments_made: number;
  payment_status: string;
  total_reports_agreed: number;
  reports_released: number;
  agreement_type: string | null;
}

type EditableAgreement = Pick<AgreementDebt, 'total_contract_value' | 'deposit_amount' | 'payments_made' | 'total_reports_agreed' | 'reports_released' | 'payment_status'>;

interface AodPayment {
  id: string;
  payment_amount: number;
  payment_date: string;
  payment_type: string;
  reports_taken_out: number | null;
  payment_notes: string | null;
}

const DebtTrackerPanel: React.FC<DebtTrackerPanelProps> = ({ referringAttorneyId, paymentTerms }) => {
  const [loading, setLoading] = useState(true);
  const [agreementDocs, setAgreementDocs] = useState<AgreementDebt[]>([]);
  const [payments, setPayments] = useState<AodPayment[]>([]);
  const [attorneyName, setAttorneyName] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditableAgreement | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!referringAttorneyId) return;
    fetchDebtData();
  }, [referringAttorneyId]);

  const fetchDebtData = async () => {
    setLoading(true);
    try {
      // Fetch attorney name
      const { data: attorney } = await supabase
        .from('referring_attorneys')
        .select('name, contact_person')
        .eq('id', referringAttorneyId)
        .single();

      if (attorney) {
        setAttorneyName(attorney.contact_person || attorney.name);
      }

      const { data: aodDocs } = await supabase
        .from('aod_documents')
        .select('id, file_name, total_contract_value, deposit_amount, payments_made, payment_status, total_reports_agreed, reports_released, agreement_type')
        .eq('referring_attorney_id', referringAttorneyId)
        .order('created_at', { ascending: false });

      const { data: shortTermDocs } = await supabase
        .from('short_term_agreements')
        .select('id, file_name, agreement_reference, contract_description, total_contract_value, deposit_amount, payments_made, payment_status, total_reports_agreed, reports_completed')
        .eq('referring_attorney_id', referringAttorneyId)
        .order('created_at', { ascending: false });

      const combinedDocs: AgreementDebt[] = [
        ...((aodDocs || []).map((doc) => ({
          id: doc.id,
          source: 'aod' as const,
          file_name: doc.file_name || 'AOD Document',
          total_contract_value: Number(doc.total_contract_value || 0),
          deposit_amount: Number(doc.deposit_amount || 0),
          payments_made: Number(doc.payments_made || 0),
          payment_status: doc.payment_status || 'pending',
          total_reports_agreed: Number(doc.total_reports_agreed || 0),
          reports_released: Number(doc.reports_released || 0),
          agreement_type: doc.agreement_type,
        }))),
        ...((shortTermDocs || []).map((doc) => ({
          id: doc.id,
          source: 'short_term' as const,
          file_name: doc.file_name || doc.agreement_reference || doc.contract_description || 'Short-Term Agreement',
          total_contract_value: Number(doc.total_contract_value || 0),
          deposit_amount: Number(doc.deposit_amount || 0),
          payments_made: Number(doc.payments_made || 0),
          payment_status: doc.payment_status || 'pending',
          total_reports_agreed: Number(doc.total_reports_agreed || 0),
          reports_released: Number(doc.reports_completed || 0),
          agreement_type: 'short_term',
        }))),
      ];

      setAgreementDocs(combinedDocs);

      // Fetch payments for these documents
      if (aodDocs && aodDocs.length > 0) {
        const docIds = aodDocs.map(d => d.id);
        const { data: paymentData } = await supabase
          .from('aod_payments')
          .select('id, payment_amount, payment_date, payment_type, reports_taken_out, payment_notes')
          .in('aod_document_id', docIds)
          .order('payment_date', { ascending: false })
          .limit(20);

        setPayments(paymentData || []);
      } else {
        setPayments([]);
      }
    } catch (error) {
      console.error('Error fetching debt data:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAOD = paymentTerms === 'aod';
  const isShortTerm = paymentTerms === 'short-term';
  const agreementLabel = isAOD ? 'AOD (Acknowledgment of Debt)' : isShortTerm ? 'Short-Term Agreement' : 'Payment Agreement';

  const startEditing = (doc: AgreementDebt) => {
    setEditingKey(`${doc.source}:${doc.id}`);
    setEditForm({
      total_contract_value: doc.total_contract_value || 0,
      deposit_amount: doc.deposit_amount || 0,
      payments_made: doc.payments_made || 0,
      total_reports_agreed: doc.total_reports_agreed || 0,
      reports_released: doc.reports_released || 0,
      payment_status: doc.payment_status || 'pending',
    });
  };

  const updateEditNumber = (field: keyof EditableAgreement, value: string) => {
    setEditForm((current) => current ? { ...current, [field]: Number(value) || 0 } : current);
  };

  const saveAgreement = async (doc: AgreementDebt) => {
    if (!editForm) return;
    setSaving(true);
    try {
      const paymentStatus = editForm.payment_status || 'pending';
      if (doc.source === 'aod') {
        const { error } = await supabase
          .from('aod_documents')
          .update({
            total_contract_value: editForm.total_contract_value,
            deposit_amount: editForm.deposit_amount,
            payments_made: editForm.payments_made,
            total_reports_agreed: editForm.total_reports_agreed,
            reports_released: editForm.reports_released,
            payment_status: paymentStatus,
          })
          .eq('id', doc.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('short_term_agreements')
          .update({
            total_contract_value: editForm.total_contract_value,
            deposit_amount: editForm.deposit_amount,
            payments_made: editForm.payments_made,
            total_reports_agreed: editForm.total_reports_agreed,
            reports_completed: editForm.reports_released,
            payment_status: paymentStatus as 'pending' | 'partial' | 'paid' | 'overdue',
          })
          .eq('id', doc.id);

        if (error) throw error;
      }

      toast.success(`${doc.source === 'aod' ? 'AOD' : 'Short-term agreement'} updated`);
      setEditingKey(null);
      setEditForm(null);
      await fetchDebtData();
    } catch (error: any) {
      console.error('Error updating agreement:', error);
      toast.error(error.message || 'Failed to update agreement');
    } finally {
      setSaving(false);
    }
  };

  // Filter docs by type if relevant
  const relevantDocs = agreementDocs.filter(doc => {
    if (isShortTerm) return doc.source === 'short_term' || doc.agreement_type === 'short-term' || doc.agreement_type === 'short_term';
    if (isAOD) return doc.source === 'aod' && (!doc.agreement_type || doc.agreement_type === 'aod' || doc.agreement_type === 'long-term');
    return true;
  });

  // If no relevant docs, show all
  const displayDocs = relevantDocs.length > 0 ? relevantDocs : agreementDocs;

  const totalContractValue = displayDocs.reduce((sum, d) => sum + (d.total_contract_value || 0), 0);
  const totalDeposits = displayDocs.reduce((sum, d) => sum + (d.deposit_amount || 0), 0);
  const totalPaymentsMade = displayDocs.reduce((sum, d) => sum + Math.max(0, (d.payments_made || 0) - (d.deposit_amount || 0)), 0) + payments.reduce((sum, p) => sum + (p.payment_amount || 0), 0);
  const outstandingBalance = Math.max(0, totalContractValue - totalDeposits - totalPaymentsMade);

  if (loading) {
    return (
      <Card className="col-span-2 border-primary/20">
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-2 border-primary/20 bg-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          {agreementLabel} — Debt Tracker
          {attorneyName && (
            <Badge variant="outline" className="ml-2 font-normal text-xs">
              {attorneyName}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Total Contract Value</p>
            <p className="text-lg font-bold text-foreground">R {totalContractValue.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Deposits Made
            </p>
            <p className="text-lg font-bold text-foreground">R {totalDeposits.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Regular Payments</p>
            <p className="text-lg font-bold text-foreground">R {totalPaymentsMade.toFixed(2)}</p>
          </div>
          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <TrendingDown className="h-3 w-3" /> Outstanding Balance
            </p>
            <p className={`text-lg font-bold ${outstandingBalance > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
              R {outstandingBalance.toFixed(2)}
            </p>
          </div>
        </div>

        {/* Existing Agreements */}
        {displayDocs.length > 0 ? (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Existing Agreements</h4>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Agreement</TableHead>
                    <TableHead className="text-xs">Contract Value</TableHead>
                    <TableHead className="text-xs">Deposit</TableHead>
                    <TableHead className="text-xs">Reports</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayDocs.map(doc => (
                    <TableRow key={doc.id}>
                      <TableCell className="text-xs font-medium">{doc.file_name || 'AOD Document'}</TableCell>
                      <TableCell className="text-xs">R {(doc.total_contract_value || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">R {(doc.deposit_amount || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{doc.reports_released || 0} / {doc.total_reports_agreed || 0}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={doc.payment_status === 'paid' ? 'default' : 'secondary'}
                          className={doc.payment_status === 'paid' 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 text-xs' 
                            : 'text-xs'}
                        >
                          {doc.payment_status || 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-3 border rounded-md bg-background">
            No existing {isShortTerm ? 'short-term agreements' : 'AOD documents'} for this attorney. A new one will be created upon submission.
          </div>
        )}

        {/* Recent Payments */}
        {payments.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Recent Payments</h4>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">Amount</TableHead>
                    <TableHead className="text-xs">Reports Taken</TableHead>
                    <TableHead className="text-xs">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.slice(0, 10).map(payment => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-xs">
                        {new Date(payment.payment_date).toLocaleDateString('en-ZA')}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{payment.payment_type}</TableCell>
                      <TableCell className="text-xs font-medium">R {payment.payment_amount.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{payment.reports_taken_out || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">
                        {payment.payment_notes || '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DebtTrackerPanel;
