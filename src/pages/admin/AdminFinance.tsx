import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

const AdminFinance: React.FC = () => {
  const [aodDocs, setAodDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('aod_documents')
        .select('id, file_name, total_contract_value, payments_made, payment_status, referring_attorney_id, referring_attorneys(name)')
        .order('created_at', { ascending: false })
        .limit(15);
      setAodDocs(data || []);
      setLoading(false);
    };
    fetch();
  }, []);

  const totalValue = aodDocs.reduce((s, d) => s + (d.total_contract_value || 0), 0);
  const totalPaid = aodDocs.reduce((s, d) => s + (d.payments_made || 0), 0);
  const outstanding = totalValue - totalPaid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance & Payments</h1>
        <p className="text-sm text-muted-foreground">Deposit approval workflow and outstanding balances</p>
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
            <CheckCircle2 className="h-5 w-5 text-success mb-2" />
            <p className="text-2xl font-bold text-success">R{(totalPaid / 1000).toFixed(0)}k</p>
            <p className="text-[11px] text-muted-foreground">Payments Received</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <AlertCircle className="h-5 w-5 text-warning mb-2" />
            <p className="text-2xl font-bold text-warning">R{(outstanding / 1000).toFixed(0)}k</p>
            <p className="text-[11px] text-muted-foreground">Outstanding</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-3 px-4">
            <Clock className="h-5 w-5 text-info mb-2" />
            <p className="text-2xl font-bold text-foreground">{aodDocs.length}</p>
            <p className="text-[11px] text-muted-foreground">Active AODs</p>
          </CardContent>
        </Card>
      </div>

      {/* AOD Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">AOD Agreements & Payments</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Attorney</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contract Value</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Paid</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                ) : aodDocs.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium text-foreground">
                      {(doc.referring_attorneys as any)?.name || '–'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      R{(doc.total_contract_value || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      R{(doc.payments_made || 0).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={`text-[10px] ${
                        doc.payment_status === 'paid' ? 'bg-success/10 text-success' :
                        doc.payment_status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                        'bg-warning/10 text-warning'
                      }`}>
                        {doc.payment_status || 'pending'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminFinance;
