import React, { useState, useEffect } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDebts } from '@/hooks/useAttorneyDebts';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  CreditCard,
  Wallet,
  DollarSign,
  Calendar,
  FileText,
  Download,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface AODDocument {
  id: string;
  file_name: string;
  total_contract_value: number | null;
  deposit_amount: number | null;
  payments_made: number | null;
  total_reports_agreed: number | null;
  payment_status: string | null;
  next_payment_date: string | null;
  created_at: string;
}

interface PaymentRecord {
  id: string;
  payment_amount: number;
  payment_date: string;
  payment_type: string;
  payment_notes: string | null;
}

const AttorneyPayments: React.FC = () => {
  const { debtSummary, debtCases, loading: debtsLoading } = useAttorneyDebts();
  const [aodDocuments, setAodDocuments] = useState<AODDocument[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch AOD documents
      const { data: aodData } = await supabase
        .from('aod_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (aodData) {
        setAodDocuments(aodData);

        // Fetch payments for these AODs
        const aodIds = aodData.map(d => d.id);
        if (aodIds.length > 0) {
          const { data: paymentData } = await supabase
            .from('aod_payments')
            .select('*')
            .in('aod_document_id', aodIds)
            .order('payment_date', { ascending: false });

          if (paymentData) {
            setPayments(paymentData);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching payment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalContractValue = aodDocuments.reduce((sum, d) => sum + (d.total_contract_value || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.payment_amount, 0);
  const totalDeposits = aodDocuments.reduce((sum, d) => sum + (d.deposit_amount || 0), 0);
  const outstandingBalance = totalContractValue - totalPaid;
  const paymentProgress = totalContractValue > 0 ? (totalPaid / totalContractValue) * 100 : 0;

  return (
    <AttorneyPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-8 w-8 text-kutlwano-blue" />
            AOD & Payments
          </h1>
          <p className="text-muted-foreground mt-1">
            View your agreements, balances, and payment history
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Debt</p>
                  <p className="text-2xl font-bold text-foreground">
                    R{totalContractValue.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Deposits Paid</p>
                  <p className="text-2xl font-bold text-success">
                    R{totalDeposits.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-success/10 rounded-lg">
                  <DollarSign className="h-6 w-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Paid</p>
                  <p className="text-2xl font-bold text-kutlwano-teal">
                    R{totalPaid.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-kutlwano-teal/10 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-kutlwano-teal" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-2xl font-bold text-destructive">
                    R{outstandingBalance.toLocaleString()}
                  </p>
                </div>
                <div className="p-3 bg-destructive/10 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Progress */}
        <Card className="bg-gradient-card border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-kutlwano-blue" />
              Payment Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{paymentProgress.toFixed(1)}%</span>
              </div>
              <Progress value={paymentProgress} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>R{totalPaid.toLocaleString()} paid</span>
                <span>R{outstandingBalance.toLocaleString()} remaining</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="aod">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="aod">AOD Agreements</TabsTrigger>
            <TabsTrigger value="history">Payment History</TabsTrigger>
          </TabsList>

          <TabsContent value="aod" className="mt-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Your AOD Agreements</CardTitle>
                <CardDescription>View and download your Acknowledgement of Debt documents</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : aodDocuments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No AOD agreements found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Document</TableHead>
                          <TableHead>Contract Value</TableHead>
                          <TableHead>Reports Agreed</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Next Payment</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {aodDocuments.map((doc) => (
                          <TableRow key={doc.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-kutlwano-blue" />
                                <span className="font-medium">{doc.file_name}</span>
                              </div>
                            </TableCell>
                            <TableCell>R{(doc.total_contract_value || 0).toLocaleString()}</TableCell>
                            <TableCell>{doc.total_reports_agreed || 0}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  doc.payment_status === 'paid'
                                    ? 'bg-success/10 text-success border-success/20'
                                    : doc.payment_status === 'overdue'
                                    ? 'bg-destructive/10 text-destructive border-destructive/20'
                                    : 'bg-warning/10 text-warning border-warning/20'
                                }
                              >
                                {doc.payment_status || 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {doc.next_payment_date ? (
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-muted-foreground" />
                                  {format(new Date(doc.next_payment_date), 'dd MMM yyyy')}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="outline" size="sm">
                                <Download className="h-4 w-4 mr-1" />
                                Download
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>All payments made towards your AOD agreements</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : payments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No payment records found</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{payment.payment_type}</Badge>
                            </TableCell>
                            <TableCell className="font-medium text-success">
                              R{payment.payment_amount.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {payment.payment_notes || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AttorneyPortalLayout>
  );
};

export default AttorneyPayments;
