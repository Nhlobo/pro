import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, AlertCircle, CheckCircle2, Clock, RefreshCw, ArrowRightLeft, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { recalculateAODFromAppointments, recalculateShortTermFromAppointments } from '@/hooks/usePaymentSync';
import { RegularPaymentDialog } from '@/components/RegularPaymentDialog';

const AdminFinance: React.FC = () => {
  const [aodDocs, setAodDocs] = useState<any[]>([]);
  const [shortTermDocs, setShortTermDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

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
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [aodResult, stResult] = await Promise.all([
      supabase
        .from('aod_documents')
        .select('id, file_name, total_contract_value, deposit_amount, payments_made, payment_status, referring_attorney_id, total_reports_agreed, referring_attorneys!aod_documents_referring_attorney_id_fkey(name)')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('short_term_agreements')
        .select('id, contract_description, total_contract_value, deposit_amount, payments_made, payment_status, referring_attorney_id, status, total_reports_agreed, reports_completed')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setAodDocs(aodResult.data || []);
    setShortTermDocs(stResult.data || []);
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
      const totals: Record<string, { paid: number; reportsTaken: number }> = {};
      for (const doc of aodDocs) {
        const { data } = await supabase
          .from('aod_payments')
          .select('payment_amount, reports_taken_out, payment_type')
          .eq('aod_document_id', doc.id);
        const paid = (data || []).reduce((s, p) => s + p.payment_amount, 0);
        const reportsTaken = (data || []).filter(p => p.payment_type !== 'deposit').reduce((s, p) => s + (p.reports_taken_out || 0), 0);
        totals[doc.id] = { paid, reportsTaken };
      }
      setAodPaymentTotals(totals);
    };
    if (aodDocs.length > 0) fetchPaymentTotals();
  }, [aodDocs]);

  const totalAODValue = aodDocs.reduce((s, d) => s + (d.total_contract_value || 0), 0);
  const totalAODPaid = aodDocs.reduce((s, d) => s + (aodPaymentTotals[d.id]?.paid || d.deposit_amount || 0), 0);
  const totalSTValue = shortTermDocs.reduce((s, d) => s + (d.total_contract_value || 0), 0);
  const totalSTPaid = shortTermDocs.reduce((s, d) => s + (d.payments_made || d.deposit_amount || 0), 0);
  const totalValue = totalAODValue + totalSTValue;
  const totalPaid = totalAODPaid + totalSTPaid;
  const outstanding = totalValue - totalPaid;

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

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <AlertCircle className="h-5 w-5 text-orange-500 mb-2" />
            <p className="text-2xl font-bold text-orange-500">R{(outstanding / 1000).toFixed(0)}k</p>
            <p className="text-[11px] text-muted-foreground">Outstanding Balance</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <Clock className="h-5 w-5 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{aodDocs.length + shortTermDocs.length}</p>
            <p className="text-[11px] text-muted-foreground">Active Agreements</p>
          </CardContent>
        </Card>
      </div>

      {/* AOD Agreements Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">AOD Agreements & Payments</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{aodDocs.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Attorney</th>
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
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : aodDocs.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No AOD agreements</td></tr>
                ) : aodDocs.map((doc) => {
                  const initialDeposit = doc.deposit_amount || 0;
                  const aodPaid = aodPaymentTotals[doc.id]?.paid || 0;
                  const totalDocPaid = initialDeposit + aodPaid;
                  const balance = Math.max(0, (doc.total_contract_value || 0) - totalDocPaid);
                  const reportsTaken = aodPaymentTotals[doc.id]?.reportsTaken || 0;
                  const totalReports = doc.total_reports_agreed || 0;
                  const attorneyName = (doc.referring_attorneys as any)?.name || '–';

                  return (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-medium text-foreground">{attorneyName}</td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        R{(doc.total_contract_value || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-green-600 font-medium">
                        R{totalDocPaid.toLocaleString()}
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
                          doc.payment_status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                          doc.payment_status === 'partial' ? 'bg-blue-500/10 text-blue-600' :
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
                          onClick={() => openPaymentDialog(doc.id, 'aod', attorneyName, doc.referring_attorney_id)}
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

      {/* Short-term Agreements Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Short-term Agreements</CardTitle>
            <Badge variant="secondary" className="text-[10px]">{shortTermDocs.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
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
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : shortTermDocs.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No active short-term agreements</td></tr>
                ) : shortTermDocs.map((doc) => {
                  const paid = doc.payments_made || doc.deposit_amount || 0;
                  const balance = Math.max(0, (doc.total_contract_value || 0) - paid);
                  const reportsTaken = doc.reports_completed || 0;
                  const totalReports = doc.total_reports_agreed || 0;

                  return (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
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
                          onClick={() => openPaymentDialog(doc.id, 'short_term', doc.contract_description || 'Short-term', doc.referring_attorney_id)}
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
