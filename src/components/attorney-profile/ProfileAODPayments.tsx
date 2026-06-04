import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAttorneyDebts } from '@/hooks/useAttorneyDebts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  Wallet,
  Calendar,
  FileText,
  Download,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileSignature,
  Receipt,
  User
} from "lucide-react";
import { format } from 'date-fns';
import { formatExpertType } from '@/utils/expertTypeMapping';

import { RandSign } from "@/components/icons/RandSign";
interface AODDocument {
  id: string;
  file_name: string;
  total_contract_value: number | null;
  deposit_amount: number | null;
  payments_made: number | null;
  total_reports_agreed: number | null;
  reports_released: number | null;
  payment_status: string | null;
  next_payment_date: string | null;
  created_at: string;
  document_url: string;
  document_status: string | null;
}

interface PaymentRecord {
  id: string;
  payment_amount: number;
  payment_date: string;
  payment_type: string;
  payment_notes: string | null;
}

interface CaseSummary {
  claimant_name: string;
  service_fee: number;
  deposit_amount: number;
  expert_type: string;
  appointment_date: string;
  payment_status: string | null;
}

interface ProfileAODPaymentsProps {
  referringAttorneyId?: string;
  cases?: CaseSummary[];
}

const ProfileAODPayments: React.FC<ProfileAODPaymentsProps> = ({ referringAttorneyId, cases }) => {
  const { debtSummary, loading: debtsLoading } = useAttorneyDebts();
  const [aodDocuments, setAodDocuments] = useState<AODDocument[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [referringAttorneyId]);

  const fetchData = async () => {
    try {
      let query = supabase
        .from('aod_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (referringAttorneyId) {
        query = query.eq('referring_attorney_id', referringAttorneyId);
      }

      const { data: aodData } = await query;

      if (aodData) {
        setAodDocuments(aodData);
        const aodIds = aodData.map(d => d.id);
        if (aodIds.length > 0) {
          const { data: paymentData } = await supabase
            .from('aod_payments')
            .select('*')
            .in('aod_document_id', aodIds)
            .order('payment_date', { ascending: false });
          if (paymentData) setPayments(paymentData);
        }
      }
    } catch (error) {
      console.error('Error fetching AOD data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalContractValue = aodDocuments.reduce((sum, d) => sum + (d.total_contract_value || 0), 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.payment_amount, 0);
  const totalDeposits = aodDocuments.reduce((sum, d) => sum + (d.deposit_amount || 0), 0);
  const outstandingBalance = totalContractValue - totalPaid;
  const paymentProgress = totalContractValue > 0 ? (totalPaid / totalContractValue) * 100 : 0;

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'paid': return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'overdue': return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertCircle className="h-3 w-3 mr-1" />Overdue</Badge>;
      case 'partial': return <Badge className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />Partial</Badge>;
      default: return <Badge className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Contract</p>
                <p className="text-lg font-bold">R{totalContractValue.toLocaleString()}</p>
              </div>
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Deposits</p>
                <p className="text-lg font-bold text-success">R{totalDeposits.toLocaleString()}</p>
              </div>
              <RandSign className="h-5 w-5 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-lg font-bold text-kutlwano-teal">R{totalPaid.toLocaleString()}</p>
              </div>
              <TrendingUp className="h-5 w-5 text-kutlwano-teal" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-card border-border/50">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-destructive">R{outstandingBalance.toLocaleString()}</p>
              </div>
              <AlertCircle className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Progress */}
      <Card className="bg-gradient-card border-border/50">
        <CardContent className="pt-4 pb-3">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment Progress</span>
              <span className="font-medium">{paymentProgress.toFixed(1)}%</span>
            </div>
            <Progress value={paymentProgress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>R{totalPaid.toLocaleString()} paid</span>
              <span>R{outstandingBalance.toLocaleString()} remaining</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="aod">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="aod">AOD Agreements</TabsTrigger>
          <TabsTrigger value="history">Payment History</TabsTrigger>
          <TabsTrigger value="invoices" className="flex items-center gap-1">
            <Receipt className="h-3 w-3" /> Tax Invoices
          </TabsTrigger>
        </TabsList>

        <TabsContent value="aod" className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : aodDocuments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileSignature className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No AOD agreements found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Contract Value</TableHead>
                    <TableHead>Reports</TableHead>
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
                          <FileSignature className="h-4 w-4 text-kutlwano-blue" />
                          <div>
                            <span className="font-medium text-sm">{doc.file_name}</span>
                            {doc.document_status && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                {doc.document_status === 'sent' ? '✉ Sent' : doc.document_status === 'generated' ? '✓ Generated' : doc.document_status}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">R{(doc.total_contract_value || 0).toLocaleString()}</TableCell>
                      <TableCell>
                        <span className="text-sm">{doc.reports_released || 0}/{doc.total_reports_agreed || 0}</span>
                      </TableCell>
                      <TableCell>{getStatusBadge(doc.payment_status)}</TableCell>
                      <TableCell>
                        {doc.next_payment_date ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
                            {format(new Date(doc.next_payment_date), 'dd MMM yyyy')}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="outline" size="sm">
                          <Download className="h-4 w-4 mr-1" /> Download
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {payments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <RandSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
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
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {format(new Date(p.payment_date), 'dd MMM yyyy')}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.payment_type}</Badge></TableCell>
                      <TableCell className="font-medium text-success">R{p.payment_amount.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{p.payment_notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Tax Invoices Tab — per-claimant outstanding invoice with VAT */}
        <TabsContent value="invoices" className="mt-4">
          {(!cases || cases.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No invoice data available</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Assessment fees are <strong>VAT-inclusive (15%)</strong>. VAT is extracted from the total fee below.
              </p>
              <ScrollArea className="h-[500px]">
                <div className="space-y-3 pr-2">
                  {cases.map((c, idx) => {
                    const VAT_RATE = 0.15;
                    const totalInclVat = c.service_fee || 0;
                    const vat = totalInclVat - totalInclVat / (1 + VAT_RATE);
                    const exclVat = totalInclVat - vat;
                    const deposit = c.deposit_amount || 0;
                    const balance = totalInclVat - deposit;
                    const isPaid = c.payment_status?.toLowerCase() === 'paid';

                    return (
                      <Card key={idx} className={`border-border/50 ${isPaid ? 'bg-success/5' : balance > 0 ? 'bg-destructive/5' : 'bg-gradient-card'}`}>
                        <CardHeader className="pb-2 pt-3 px-4">
                          <CardTitle className="text-sm flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span>{c.claimant_name}</span>
                              <Badge variant="outline" className="text-xs">{formatExpertType(c.expert_type)}</Badge>
                            </div>
                            {isPaid
                              ? <Badge className="bg-success/10 text-success border-success/20 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>
                              : balance > 0
                                ? <Badge className="bg-destructive/10 text-destructive border-destructive/20 text-xs"><AlertCircle className="h-3 w-3 mr-1" />Balance Due</Badge>
                                : <Badge variant="outline" className="text-xs">Cleared</Badge>
                            }
                          </CardTitle>
                          <p className="text-xs text-muted-foreground pl-6">
                            Assessment: {c.appointment_date ? format(new Date(c.appointment_date), 'dd MMM yyyy') : 'N/A'}
                          </p>
                        </CardHeader>
                        <CardContent className="px-4 pb-3">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            <span className="text-muted-foreground">Fee (excl. VAT)</span>
                            <span className="text-right font-medium">R {exclVat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            <span className="text-muted-foreground">VAT (15%)</span>
                            <span className="text-right font-medium">R {vat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            <span className="font-semibold">Total (incl. VAT)</span>
                            <span className="text-right font-semibold">R {totalInclVat.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                          </div>
                          <Separator className="my-2" />
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                            <span className="text-muted-foreground">Deposit Paid</span>
                            <span className="text-right text-success font-medium">- R {deposit.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                            <span className={`font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>
                              {balance > 0 ? 'Outstanding Balance' : 'Balance'}
                            </span>
                            <span className={`text-right font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>
                              R {balance.toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {/* Grand Total */}
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="py-3 px-4">
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-semibold">
                        <span>Total Fees (incl. VAT)</span>
                        <span className="text-right">R {cases.reduce((s, c) => s + (c.service_fee || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        <span>Total Deposits Paid</span>
                        <span className="text-right text-success">R {cases.reduce((s, c) => s + (c.deposit_amount || 0), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</span>
                        <span className="text-destructive font-bold">Total Outstanding</span>
                        <span className="text-right text-destructive font-bold">
                          R {cases.reduce((s, c) => s + ((c.service_fee || 0) - (c.deposit_amount || 0)), 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileAODPayments;
