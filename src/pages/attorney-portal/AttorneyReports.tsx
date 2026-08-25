import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { useAttorneyLinkStatus } from '@/hooks/useAttorneyLinkStatus';
import { AttorneyNotLinkedState } from '@/components/portal/AttorneyNotLinkedState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import {
  FileText, Search, Download, Clock, CheckCircle2, AlertCircle,
  Calendar, User, Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BRAND_TEAL } from '@/components/admin/ui/AdminUI';
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

const FIELD_CLASS = 'rounded-none border-black/15 focus-visible:ring-[#00BAAD]/30';

type ReportStatus = 'pending' | 'in_progress' | 'taken_out' | 'completed';

interface ReportItem {
  claimantName: string;
  expertName: string;
  expertType: string;
  appointmentDate: string;
  appointmentId: string | null;
  status: ReportStatus;
  caseStatus: string | null;
  issueDate?: string;
  reportVersions: { id: string; file_name: string; file_path: string; version_number: number; created_at: string }[];
}

const AttorneyReports: React.FC = () => {
  const { liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const linkStatus = useAttorneyLinkStatus();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [caseStatusDialogOpen, setCaseStatusDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast } = useToast();

  // Transform cases to reports
  const reports: ReportItem[] = useMemo(() => {
    return liveCases.map(c => {
      const reportPhase = c.phases.find(p => p.name === 'Report Ready');
      let status: ReportStatus = 'pending';

      if (reportPhase?.status === 'completed') {
        status = 'completed';
      } else if (reportPhase?.status === 'in_progress') {
        status = 'in_progress';
      } else {
        const anyInProgress = c.phases.some(p => p.status === 'in_progress' || p.status === 'completed');
        if (anyInProgress) {
          status = 'in_progress';
        }
      }

      return {
        claimantName: c.claimantName,
        expertName: c.expertType,
        expertType: c.expertType,
        appointmentDate: c.appointmentDate,
        appointmentId: c.appointmentId,
        status,
        caseStatus: c.caseStatus,
        issueDate: status === 'completed' ? c.appointmentDate : undefined,
        reportVersions: c.reportVersions,
      };
    });
  }, [liveCases]);

  // Deep-link support: a notification click (bell or notifications
  // page) that resolves to this page can append ?open=<documents.id>
  // for the specific report document — see src/lib/notificationRouting.ts.
  // Auto-opens that exact report's Case Status sheet on arrival,
  // rather than just landing on the general Reports page and leaving
  // the person to find it themselves.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId || reports.length === 0) return;
    const match = reports.find(r => r.reportVersions.some(v => v.id === openId));
    if (match) {
      setSelectedReport(match);
      setCaseStatusDialogOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, reports, setSearchParams]);

  const filteredReports = useMemo(() => {
    let filtered = reports;
    if (searchTerm) {
      filtered = filtered.filter(r =>
        r.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.expertName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (activeTab !== 'all') {
      filtered = filtered.filter(r => r.status === activeTab);
    }
    return filtered;
  }, [reports, searchTerm, activeTab]);

  const handleDownloadReport = async (report: ReportItem) => {
    if (!report.reportVersions.length) {
      // Two different reasons this can be empty, and they mean very
      // different things to the person reading the message:
      //  - the expert has already submitted (report_status =
      //    'completed', visible via Phase 24's expert_reports fix) but
      //    the file itself is still pending staff review (Phase 27
      //    correctly hides it from the attorney until approved) — RLS
      //    silently filters the row out either way, so there's no way
      //    to tell "never existed" from "exists but hidden" other than
      //    by cross-checking the status the attorney can already see.
      //  - nothing has been submitted yet at all.
      if (report.status === 'completed') {
        toast({ title: "Report Pending Review", description: "The expert has submitted this report — it's completing final staff review and will be available here shortly.", variant: "default" });
      } else {
        toast({ title: "No Report Available", description: "Report file has not been uploaded yet.", variant: "destructive" });
      }
      return;
    }
    const latestVersion = report.reportVersions[0];
    setDownloading(latestVersion.file_path);
    try {
      const { data, error } = await supabase.storage.from('documents').download(latestVersion.file_path);
      if (error) throw error;
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = latestVersion.file_name;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Downloaded", description: `${latestVersion.file_name} downloaded.` });
    } catch (err: any) {
      console.error("Download error:", err);
      toast({ title: "Error", description: "Failed to download report.", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  const CASE_STATUS_TONE: Record<string, PortalPillTone> = {
    assessment_scheduled: 'teal',
    assessment_completed: 'teal',
    report_in_progress: 'warning',
    report_submitted: 'success',
    report_delivered: 'success',
    finalised: 'success',
    closed: 'neutral',
    under_review: 'warning',
    revision_requested: 'destructive',
  };

  const getCaseStatusBadge = (status: string | null) => {
    if (!status) return <PortalPill>Not Set</PortalPill>;
    const formatted = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return <PortalPill tone={CASE_STATUS_TONE[status] || 'neutral'}>{formatted}</PortalPill>;
  };

  const statusConfig: Record<ReportStatus, { label: string; icon: typeof Clock; tone: PortalPillTone }> = {
    pending: { label: 'Pending', icon: Clock, tone: 'warning' },
    in_progress: { label: 'In Progress', icon: AlertCircle, tone: 'teal' },
    taken_out: { label: 'Taken Out', icon: FileText, tone: 'teal' },
    completed: { label: 'Completed', icon: CheckCircle2, tone: 'success' },
  };

  const statusCounts = useMemo(() => ({
    all: reports.length,
    pending: reports.filter(r => r.status === 'pending').length,
    in_progress: reports.filter(r => r.status === 'in_progress').length,
    taken_out: reports.filter(r => r.status === 'taken_out').length,
    completed: reports.filter(r => r.status === 'completed').length,
  }), [reports]);

  const TAB_ITEMS: { key: string; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: statusCounts.all },
    { key: 'pending', label: 'Pending', count: statusCounts.pending },
    { key: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
    { key: 'taken_out', label: 'Taken Out', count: statusCounts.taken_out },
    { key: 'completed', label: 'Completed', count: statusCounts.completed },
  ];

  if (linkStatus === 'checking') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Reports" icon={FileText} />
          <PortalLoadingState label="Checking your account…" />
        </PortalPage>
      </AttorneyPortalLayout>
    );
  }

  if (linkStatus === 'not_linked') {
    return (
      <AttorneyPortalLayout>
        <PortalPage>
          <PortalHeader eyebrow="Attorney Portal" title="Reports" icon={FileText} />
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
          title="Reports"
          description="Track, download and view case status for your assessment reports"
          icon={FileText}
          actions={<SyncStatus loading={loading} onRefresh={refetchStats} label="Live data" />}
        />

        {/* KPI ledger — one bordered panel, matches Dashboard/My Cases/Appointments/Case Status */}
        <PortalStatStrip
          loading={loading}
          className="sm:grid-cols-4 lg:grid-cols-4"
          tiles={Object.entries(statusConfig).map(([key, config]) => ({
            label: config.label,
            value: statusCounts[key as keyof typeof statusCounts],
            icon: config.icon,
            urgent: key === 'pending' && statusCounts.pending > 0,
          }))}
        />

        {/* Search */}
        <PortalCard>
          <PortalCardBody>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search by claimant or expert…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(FIELD_CLASS, 'pl-9')}
              />
            </div>
          </PortalCardBody>
        </PortalCard>

        {/* Tabs — flat underline style, matches the rest of the portal */}
        <div className="flex flex-wrap gap-1 border-b border-black/10">
          {TAB_ITEMS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors',
                activeTab === t.key
                  ? 'border-[#00BAAD] text-[#00BAAD]'
                  : 'border-transparent text-slate-500 hover:text-black'
              )}
            >
              {t.label} ({t.count})
            </button>
          ))}
        </div>

        <PortalCard>
          <PortalCardHeader icon={FileText} title="Reports" description={`${filteredReports.length} report(s) in view`} />
          <PortalCardBody className="p-0">
            {loading ? (
              <PortalLoadingState label="Loading reports…" />
            ) : filteredReports.length === 0 ? (
              <PortalEmptyState icon={FileText} title="No reports found" />
            ) : (
              <div className="max-h-[500px] overflow-y-auto">
                <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                  <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                    <TableRow>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Expert</TableHead>
                      <TableHead>Assessment Date</TableHead>
                      <TableHead>Report Status</TableHead>
                      <TableHead>Case Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReports.map((report, index) => {
                      const config = statusConfig[report.status];
                      return (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-medium text-black">{report.claimantName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-black">{report.expertName}</p>
                            <p className="text-[11px] text-slate-500">{report.expertType}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-slate-500">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(report.appointmentDate), 'dd MMM yyyy')}
                            </div>
                          </TableCell>
                          <TableCell>
                            <PortalPill tone={config.tone}>
                              <config.icon className="h-3 w-3" />
                              {config.label}
                            </PortalPill>
                          </TableCell>
                          <TableCell>{getCaseStatusBadge(report.caseStatus)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-none"
                                onClick={() => { setSelectedReport(report); setCaseStatusDialogOpen(true); }}
                                title="View case status"
                              >
                                <Activity className="h-3.5 w-3.5" />
                              </Button>
                              {report.status === 'completed' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="rounded-none"
                                  onClick={() => handleDownloadReport(report)}
                                  disabled={downloading === report.reportVersions?.[0]?.file_path}
                                >
                                  <Download className="mr-1 h-3.5 w-3.5" />
                                  Download
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </PortalCardBody>
        </PortalCard>
      </PortalPage>

      {/* Case Status Dialog */}
      <Sheet open={caseStatusDialogOpen} onOpenChange={setCaseStatusDialogOpen}>
        <SheetContent
          side="right"
          className="flex h-full w-full flex-col overflow-y-auto rounded-none border-black/10 p-0 shadow-none sm:max-w-md"
        >
          <SheetHeader className="border-b border-black/10 px-4 py-4 text-left sm:px-6">
            <SheetTitle className="flex items-center gap-2 text-black">
              <Activity className="h-4 w-4" style={{ color: BRAND_TEAL }} />
              Case Status
            </SheetTitle>
            <SheetDescription>
              {selectedReport?.claimantName} — {selectedReport?.expertName}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 px-4 py-4 sm:px-6">
            <div className="space-y-2.5 border border-black/10 bg-black/[0.015] p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Case Status:</span>
                {getCaseStatusBadge(selectedReport?.caseStatus || null)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Report Status:</span>
                <span className="text-xs capitalize text-black">{selectedReport?.status?.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Expert Type:</span>
                <span className="text-xs text-black">{selectedReport?.expertType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Assessment Date:</span>
                <span className="text-xs text-black">{selectedReport?.appointmentDate ? format(new Date(selectedReport.appointmentDate), 'dd MMM yyyy') : '—'}</span>
              </div>
              {selectedReport?.issueDate && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Issue Date:</span>
                  <span className="text-xs text-black">{format(new Date(selectedReport.issueDate), 'dd MMM yyyy')}</span>
                </div>
              )}
            </div>
            {selectedReport?.status === 'completed' && selectedReport.reportVersions.length > 0 && (
              <Button className="w-full rounded-none" onClick={() => selectedReport && handleDownloadReport(selectedReport)}>
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
            )}
            {selectedReport?.status === 'completed' && selectedReport.reportVersions.length === 0 && (
              <div className="border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                The expert has submitted this report — it's completing final staff review and will be available to download here shortly.
              </div>
            )}
          </div>
          <SheetFooter className="border-t border-black/10 px-4 py-4 sm:px-6">
            <Button variant="outline" className="rounded-none" onClick={() => setCaseStatusDialogOpen(false)}>Close</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AttorneyPortalLayout>
  );
};

export default AttorneyReports;
