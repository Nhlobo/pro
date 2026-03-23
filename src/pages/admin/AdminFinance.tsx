import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle2, Clock, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import { recalculateAODFromAppointments, recalculateShortTermFromAppointments } from '@/hooks/usePaymentSync';

const AdminFinance: React.FC = () => {
  const [aodDocs, setAodDocs] = useState<any[]>([]);
  const [shortTermDocs, setShortTermDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [aodResult, stResult] = await Promise.all([
      supabase
        .from('aod_documents')
        .select('id, file_name, total_contract_value, deposit_amount, payments_made, payment_status, referring_attorney_id, referring_attorneys(name)')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('short_term_agreements')
        .select('id, contract_description, total_contract_value, deposit_amount, payments_made, payment_status, referring_attorney_id, status')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);
    setAodDocs(aodResult.data || []);
    setShortTermDocs(stResult.data || []);
    setLoading(false);
  };

  // Full bidirectional sync: recalculate all AODs and short-term from appointments
  const handleFullSync = async () => {
    setSyncing(true);
    try {
      // Get unique attorney IDs from AODs
      const aodAttorneyIds = [...new Set(aodDocs.map(d => d.referring_attorney_id))];
      const stAttorneyIds = [...new Set(shortTermDocs.map(d => d.referring_attorney_id))];

      // Recalculate AODs
      for (const doc of aodDocs) {
        await recalculateAODFromAppointments(doc.id, doc.referring_attorney_id);
      }

      // Recalculate short-term agreements
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
  const [aodPaymentTotals, setAodPaymentTotals] = useState<Record<string, number>>({});
  useEffect(() => {
    const fetchPaymentTotals = async () => {
      const totals: Record<string, number> = {};
      for (const doc of aodDocs) {
        const { data } = await supabase
          .from('aod_payments')
          .select('payment_amount')
          .eq('aod_document_id', doc.id);
        totals[doc.id] = (data || []).reduce((s, p) => s + p.payment_amount, 0);
      }
      setAodPaymentTotals(totals);
    };
    if (aodDocs.length > 0) fetchPaymentTotals();
  }, [aodDocs]);

  const totalAODValue = aodDocs.reduce((s, d) => s + (d.total_contract_value || 0), 0);
  const totalAODPaid = aodDocs.reduce((s, d) => s + (aodPaymentTotals[d.id] || d.deposit_amount || 0), 0);
  const totalSTValue = shortTermDocs.reduce((s, d) => s + (d.total_contract_value || 0), 0);
  const totalSTPaid = shortTermDocs.reduce((s, d) => s + (d.payments_made || d.deposit_amount || 0), 0);
  const totalValue = totalAODValue + totalSTValue;
  const totalPaid = totalAODPaid + totalSTPaid;
  const outstanding = totalValue - totalPaid;

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
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Contract Value</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Balance</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : aodDocs.map((doc) => {
                  const paid = aodPaymentTotals[doc.id] || doc.deposit_amount || 0;
                  const balance = (doc.total_contract_value || 0) - paid;
                  return (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-medium text-foreground">
                        {(doc.referring_attorneys as any)?.name || '–'}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        R{(doc.total_contract_value || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        R{paid.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-foreground">
                        R{Math.max(0, balance).toLocaleString()}
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
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Contract Value</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Paid</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Balance</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : shortTermDocs.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No active short-term agreements</td></tr>
                ) : shortTermDocs.map((doc) => {
                  const paid = doc.payments_made || doc.deposit_amount || 0;
                  const balance = (doc.total_contract_value || 0) - paid;
                  return (
                    <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-3 px-4 font-medium text-foreground">
                        {doc.contract_description || '–'}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        R{(doc.total_contract_value || 0).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">
                        R{paid.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-foreground">
                        R{Math.max(0, balance).toLocaleString()}
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
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinance;
