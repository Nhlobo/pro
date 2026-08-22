import React, { useState, useEffect } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  FileSignature,
  FileText,
  Download,
  Eye,
  Calendar,
  Clock,
  CheckCircle2
} from "lucide-react";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { RandSign } from "@/components/icons/RandSign";
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

interface Agreement {
  id: string;
  file_name: string;
  total_contract_value: number | null;
  deposit_amount: number | null;
  total_reports_agreed: number | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  payment_status: string | null;
  created_at: string;
  document_url: string;
  type: 'short-term' | 'long-term';
}

type AgreementsTab = 'all' | 'short-term' | 'long-term';

const PAYMENT_STATUS_TONE: Record<string, PortalPillTone> = {
  paid: 'success',
  overdue: 'destructive',
};

const AttorneyAgreements: React.FC = () => {
  const linkStatus = useAttorneyLinkStatus();
  const { toast } = useToast();
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<AgreementsTab>('all');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchAgreements();
  }, []);

  // Downloads the agreement PDF from the aod-documents bucket. This
  // was previously wired to nothing at all — both the Eye (view) and
  // Download buttons had no onClick handler. document_url stores a
  // bucket-relative path (`${referring_attorney_id}/${filename}`, see
  // useAODDocuments.tsx), not a full URL, so it needs an actual
  // storage call rather than a plain link.
  const handleViewOrDownload = async (agreement: Agreement, mode: 'view' | 'download') => {
    if (!agreement.document_url || agreement.document_url === 'pending') {
      toast({ title: 'Not available', description: 'This agreement document has not been uploaded yet.', variant: 'destructive' });
      return;
    }
    setDownloadingId(agreement.id);
    try {
      if (mode === 'view') {
        const { data, error } = await supabase.storage
          .from('aod-documents')
          .createSignedUrl(agreement.document_url, 3600);
        if (error) throw error;
        if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
      } else {
        const { data, error } = await supabase.storage
          .from('aod-documents')
          .download(agreement.document_url);
        if (error) throw error;
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = agreement.file_name || 'agreement.pdf';
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Agreement download error:', err);
      toast({ title: 'Download failed', description: 'Could not retrieve this document. Please try again or contact support.', variant: 'destructive' });
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchAgreements = async () => {
    setLoading(true);
    try {
      // Fetch AOD documents (could be long-term or short-term based on duration)
      const { data: aodData } = await supabase
        .from('aod_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (aodData) {
        const processedAgreements: Agreement[] = aodData.map(doc => {
          // Determine if short-term (<=6 months) or long-term
          let type: 'short-term' | 'long-term' = 'long-term';
          if (doc.contract_start_date && doc.contract_end_date) {
            const start = new Date(doc.contract_start_date);
            const end = new Date(doc.contract_end_date);
            const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 +
                              (end.getMonth() - start.getMonth());
            type = monthsDiff <= 6 ? 'short-term' : 'long-term';
          }

          return {
            id: doc.id,
            file_name: doc.file_name,
            total_contract_value: doc.total_contract_value,
            deposit_amount: doc.deposit_amount,
            total_reports_agreed: doc.total_reports_agreed,
            contract_start_date: doc.contract_start_date,
            contract_end_date: doc.contract_end_date,
            payment_status: doc.payment_status,
            created_at: doc.created_at,
            document_url: doc.document_url,
            type
          };
        });
        setAgreements(processedAgreements);
      }
    } catch (error) {
      console.error('Error fetching agreements:', error);
    } finally {
      setLoading(false);
    }
  };

  const shortTermAgreements = agreements.filter(a => a.type === 'short-term');
  const longTermAgreements = agreements.filter(a => a.type === 'long-term');

  const AgreementTable = ({ items }: { items: Agreement[] }) => (
    <div className="max-h-[500px] overflow-y-auto">
      <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
        <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
          <TableRow>
            <TableHead>Agreement</TableHead>
            <TableHead>Contract Value</TableHead>
            <TableHead>Deposit</TableHead>
            <TableHead>Reports</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((agreement) => (
            <TableRow key={agreement.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <FileSignature className="h-3.5 w-3.5 text-slate-400" />
                  <span className="font-medium text-black">{agreement.file_name}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1 text-slate-600">
                  <RandSign className="h-3.5 w-3.5 text-slate-400" />
                  R{(agreement.total_contract_value || 0).toLocaleString()}
                </div>
              </TableCell>
              <TableCell className="text-slate-600">
                R{(agreement.deposit_amount || 0).toLocaleString()}
              </TableCell>
              <TableCell className="text-slate-600">
                {agreement.total_reports_agreed || 0}
              </TableCell>
              <TableCell>
                {agreement.contract_start_date && agreement.contract_end_date ? (
                  <div className="flex items-center gap-1 text-slate-500">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(agreement.contract_start_date), 'MMM yyyy')} -
                    {format(new Date(agreement.contract_end_date), 'MMM yyyy')}
                  </div>
                ) : (
                  <span className="text-slate-400">-</span>
                )}
              </TableCell>
              <TableCell>
                <PortalPill tone={PAYMENT_STATUS_TONE[agreement.payment_status || ''] || 'warning'}>
                  {agreement.payment_status === 'paid' && <CheckCircle2 className="h-3 w-3" />}
                  {agreement.payment_status === 'pending' && <Clock className="h-3 w-3" />}
                  {agreement.payment_status || 'Pending'}
                </PortalPill>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-none"
                    disabled={downloadingId === agreement.id}
                    onClick={() => handleViewOrDownload(agreement, 'view')}
                    title="View agreement"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-none"
                    disabled={downloadingId === agreement.id}
                    onClick={() => handleViewOrDownload(agreement, 'download')}
                  >
                    <Download className="mr-1 h-3.5 w-3.5" />
                    {downloadingId === agreement.id ? 'Downloading…' : 'Download'}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const TAB_ITEMS: { key: AgreementsTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: agreements.length },
    { key: 'short-term', label: 'Short-Term', count: shortTermAgreements.length },
    { key: 'long-term', label: 'Long-Term AOD', count: longTermAgreements.length },
  ];

  const activeItems = tab === 'all' ? agreements : tab === 'short-term' ? shortTermAgreements : longTermAgreements;
  const activeTitle = tab === 'all' ? 'All Agreements' : tab === 'short-term' ? 'Short-Term Agreements' : 'Long-Term AOD Agreements';
  const activeDescription = tab === 'all'
    ? 'View all your signed agreements'
    : tab === 'short-term'
    ? 'Agreements with 6 months or less duration'
    : 'Acknowledgement of Debt agreements longer than 6 months';
  const activeEmptyIcon = tab === 'all' ? FileSignature : tab === 'short-term' ? Clock : FileText;
  const activeEmptyLabel = tab === 'all'
    ? 'No agreements found'
    : tab === 'short-term'
    ? 'No short-term agreements found'
    : 'No long-term AOD agreements found';

  if (linkStatus === 'checking') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Agreements" icon={FileSignature} />
          <PortalLoadingState label="Checking your account…" />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Agreements" icon={FileSignature} />
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
          title="Agreements"
          description="View and download your short-term and long-term agreements"
          icon={FileSignature}
          actions={<SyncStatus loading={loading} onRefresh={fetchAgreements} label="Live data" />}
        />

        {/* KPI ledger — one bordered panel, matches Dashboard/My Cases/Appointments/Case Status/Reports/Payments */}
        <PortalStatStrip
          loading={loading}
          className="sm:grid-cols-3 lg:grid-cols-3"
          tiles={[
            { label: 'Total Agreements', value: agreements.length, icon: FileSignature },
            { label: 'Short-Term', value: shortTermAgreements.length, icon: Clock },
            { label: 'Long-Term (AOD)', value: longTermAgreements.length, icon: FileText },
          ]}
        />

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
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <PortalCard>
          <PortalCardHeader icon={FileSignature} title={activeTitle} description={activeDescription} />
          <PortalCardBody className="p-0">
            {loading ? (
              <PortalLoadingState label="Loading agreements…" />
            ) : activeItems.length === 0 ? (
              <PortalEmptyState icon={activeEmptyIcon} title={activeEmptyLabel} />
            ) : (
              <AgreementTable items={activeItems} />
            )}
          </PortalCardBody>
        </PortalCard>
      </PortalPage>
    </AttorneyPortalLayout>
  );
};

export default AttorneyAgreements;
