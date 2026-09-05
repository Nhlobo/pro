import React, { useState, useEffect } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDebts } from '@/hooks/useAttorneyDebts';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  CreditCard,
  Wallet,
  Calendar,
  FileText,
  Download,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { PaymentPopUploader } from "@/components/finance/PaymentPopUploader";
import { RandSign } from "@/components/icons/RandSign";
import { downloadAodDocument } from "@/lib/downloadAodDocument";
import {
  PortalPage,
  PortalHeader,
  SyncStatus,
  PortalStatStrip,
  PortalCard,
  PortalCardHeader,
  PortalCardBody,
  PortalPill,
  PortalEmptyState,
  PortalLoadingState,
  type PortalPillTone,
} from '@/components/attorney-portal/ui/PortalPrimitives';

interface AODDocument {
  id: string;
  file_name: string;
  document_url: string;
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

type PaymentsTab = 'aod' | 'history';

const PAYMENT_STATUS_TONE: Record<string, PortalPillTone> = {
  paid: 'success',
  overdue: 'destructive',
};

const AttorneyPayments: React.FC = () => {
  const { debtSummary, debtCases, loading: debtsLoading } = useAttorneyDebts();
  const linkStatus = useAttorneyLinkStatus();
  const { toast } = useToast();
  const [aodDocuments, setAodDocuments] = useState<AODDocument[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<PaymentsTab>('aod');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Most existing AOD records have no real file in Storage at all (see
  // downloadAodDocument.ts) — this regenerates one on demand rather
  // than failing outright, using the same server-side tenant check
  // that already gates direct downloads.
  const handleDownloadAod = async (doc: AODDocument) => {
    setDownloadingId(doc.id);
    try {
      await downloadAodDocument(doc.id, doc.document_url, doc.file_name);
    } catch (err) {
      console.error('AOD download error:', err);
      toast({ title: 'Download failed', description: 'Could not retrieve this document. Please try again or contact support.', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch AOD documents
      const { data: aodData } = await supabase
        .from('external_portal_agreements' as any)
        .select('*')
        .order('created_at', { ascending: false });

      if (aodData) {
        setAodDocuments(aodData as any);

        const aodIds = (aodData as any[]).map(d => d.id);
        if (aodIds.length > 0) {
          const { data: paymentData } = await supabase
            .from('external_portal_agreement_payments' as any)
            .select('*')
            .in('aod_document_id', aodIds)
            .order('payment_date', { ascending: false });

          if (paymentData) {
            setPayments(paymentData as any);
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

  const TAB_ITEMS: { key: PaymentsTab; label: string }[] = [
    { key: 'aod', label: 'AOD Agreements' },
    { key: 'history', label: 'Payment History' },
  ];

  if (linkStatus === 'checking') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="AOD & Payments" icon={CreditCard} />
          <PortalLoadingState label="Checking your account…" />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="AOD & Payments" icon={CreditCard} />
          <AttorneyNotLinkedState description="Your account isn't linked to a firm's referrals yet, so there's nothing to show here. Contact an administrator or get help below." />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader
          eyebrow="Attorney Portal"
          title="AOD & Payments"
          description="View your agreements, balances, and payment history"
          icon={CreditCard}
          actions={<SyncStatus loading={loading} onRefresh={fetchData} label="Live data" />}
        />

        {/* KPI ledger — one bordered panel, matches Dashboard/My Cases/Appointments/Case Status/Reports */}
        <PortalStatStrip
          loading={loading}
          className="sm:grid-cols-4 lg:grid-cols-4"
          tiles={[
            { label: 'Total Debt', value: `R${totalContractValue.toLocaleString()}`, icon: Wallet },
            { label: 'Deposits Paid', value: `R${totalDeposits.toLocaleString()}`, icon: RandSign },
            { label: 'Total Paid', value: `R${totalPaid.toLocaleString()}`, icon: TrendingUp },
            { label: 'Outstanding', value: `R${outstandingBalance.toLocaleString()}`, icon: AlertCircle, urgent: outstandingBalance > 0 },
          ]}
        />

        {/* Payment Progress */}
        <PortalCard>
          <PortalCardHeader icon={TrendingUp} title="Payment Progress" />
          <PortalCardBody>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Progress</span>
                <span className="font-medium text-black">{paymentProgress.toFixed(1)}%</span>
              </div>
              <Progress value={paymentProgress} className="h-2 rounded-none" />
              <div className="flex justify-between text-[11px] text-slate-500">
                <span>R{totalPaid.toLocaleString()} paid</span>
                <span>R{outstandingBalance.toLocaleString()} remaining</span>
              </div>
            </div>
          </PortalCardBody>
        </PortalCard>

        {/* Tabs — flat underline style, matches the rest of the portal */}
        <div className="flex flex-wrap gap-1 border-b border-black/10">
          {TAB_ITEMS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                tab === t.key
                  ? 'border-[#00BAAD] text-[#00BAAD]'
                  : 'border-transparent text-slate-500 hover:text-black'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'aod' && (
          <PortalCard>
            <PortalCardHeader
              icon={FileText}
              title="Your AOD Agreements"
              description="View and download your Acknowledgement of Debt documents"
            />
            <PortalCardBody className="p-0">
              {loading ? (
                <PortalLoadingState label="Loading agreements…" />
              ) : aodDocuments.length === 0 ? (
                <PortalEmptyState icon={FileText} title="No AOD agreements found" />
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
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
                              <FileText className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-medium text-black">{doc.file_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-600">R{(doc.total_contract_value || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-slate-600">{doc.total_reports_agreed || 0}</TableCell>
                          <TableCell>
                            <PortalPill tone={PAYMENT_STATUS_TONE[doc.payment_status || ''] || 'warning'}>
                              {doc.payment_status || 'Pending'}
                            </PortalPill>
                          </TableCell>
                          <TableCell>
                            {doc.next_payment_date ? (
                              <div className="flex items-center gap-2 text-slate-500">
                                <Calendar className="h-3.5 w-3.5" />
                                {format(new Date(doc.next_payment_date), 'dd MMM yyyy')}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-none"
                              disabled={downloadingId === doc.id}
                              onClick={() => handleDownloadAod(doc)}
                            >
                              <Download className="mr-1 h-3.5 w-3.5" />
                              {downloadingId === doc.id ? 'Downloading…' : 'Download'}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PortalCardBody>
          </PortalCard>
        )}

        {tab === 'history' && (
          <PortalCard>
            <PortalCardHeader
              icon={RandSign}
              title="Payment History"
              description="All payments made towards your AOD agreements"
            />
            <PortalCardBody className="p-0">
              {loading ? (
                <PortalLoadingState label="Loading payment history…" />
              ) : payments.length === 0 ? (
                <PortalEmptyState icon={RandSign} title="No payment records found" />
              ) : (
                <div className="max-h-[400px] overflow-y-auto">
                  <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                    <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Proof of Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="flex items-center gap-2 text-slate-500">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(payment.payment_date), 'dd MMM yyyy')}
                            </div>
                          </TableCell>
                          <TableCell><PortalPill>{payment.payment_type}</PortalPill></TableCell>
                          <TableCell className="font-medium text-success">
                            R{payment.payment_amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {payment.payment_notes || '-'}
                          </TableCell>
                          <TableCell>
                            <PaymentPopUploader
                              recordType="aod_payment"
                              recordId={payment.id}
                              paymentReference={`Payment ${format(new Date(payment.payment_date), 'dd MMM yyyy')}`}
                              canUpload={false}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </PortalCardBody>
          </PortalCard>
        )}
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

export default AttorneyPayments;
