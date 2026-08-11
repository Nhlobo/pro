import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Briefcase, Filter, AlertTriangle, CheckCircle2, Clock, FileText,
  User, Eye, Plus, Upload, Download, Send, FolderOpen, Receipt,
  TrendingUp, FileCheck, Loader2, Scale, CreditCard, Stethoscope,
} from 'lucide-react';
import { LitigationTrialServices } from '@/components/attorney-portal/LitigationTrialServices';
import { format, differenceInDays } from 'date-fns';
import { formatExpertType } from '@/utils/expertTypeMapping';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';
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
import { AdminTabList, AdminTabTrigger, AdminSearchInput, BRAND_TEAL } from '@/components/admin/ui/AdminUI';

interface CaseDocument {
  id: string;
  file_name: string;
  document_type: string;
  created_at: string;
  file_path: string;
}

const DOCUMENT_TYPES = [
  { value: 'medical_records', label: 'Medical Records' },
  { value: 'instruction_letter', label: 'Instruction Letter' },
  { value: 'id_copy', label: 'ID Copy' },
  { value: 'police_report', label: 'Police Report' },
  { value: 'raf1_raf4', label: 'RAF1 / RAF4' },
  { value: 'affidavit', label: 'Affidavit' },
  { value: 'hospital_file', label: 'Hospital File' },
  { value: 'school_report', label: 'School Report' },
  { value: 'payslip', label: 'Payslip' },
  { value: 'summons', label: 'Summons' },
  { value: 'other', label: 'Other Supporting Document' },
];

/** Shared flat input/select chrome, matching AdminSearchInput's border/radius. */
const FIELD_CLASS = 'rounded-none border-black/15 focus-visible:ring-[#00BAAD]/30';

const AttorneyMyCases: React.FC = () => {
  const { liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [litigationFilter, setLitigationFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('cases');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [caseDocuments, setCaseDocuments] = useState<Record<string, CaseDocument[]>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('medical_records');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCaseForUpload, setSelectedCaseForUpload] = useState<string | null>(null);
  const [selectedClaimantForUpload, setSelectedClaimantForUpload] = useState<string>('');

  // Case detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [caseExpertReports, setCaseExpertReports] = useState<any[]>([]);
  const [caseFinancials, setCaseFinancials] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // New referral dialog
  const [referralDialogOpen, setReferralDialogOpen] = useState(false);
  const [newReferral, setNewReferral] = useState({
    firstName: '', lastName: '', matterType: 'raf',
    expertType: 'orthopaedic_surgeon', notes: '', province: 'Gauteng'
  });
  const [submittingReferral, setSubmittingReferral] = useState(false);

  // Invoice data
  const [invoiceData, setInvoiceData] = useState<any[]>([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  // Fetch documents for a case
  const fetchCaseDocuments = useCallback(async (appointmentId: string) => {
    const { data } = await supabase
      .from('documents')
      .select('id, file_name, document_type, created_at, file_path')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: false });
    if (data) {
      setCaseDocuments(prev => ({ ...prev, [appointmentId]: data }));
    }
  }, []);

  // Fetch case detail (expert assessments, reports, financials)
  const fetchCaseDetail = useCallback(async (caseItem: any) => {
    setDetailLoading(true);
    try {
      // Fetch expert reports for this appointment
      const { data: reports } = await supabase
        .from('expert_reports')
        .select('*, medical_experts(first_name, last_name, expert_type)')
        .eq('appointment_id', caseItem.id);

      setCaseExpertReports(reports || []);

      // Fetch financial data
      const { data: appointment } = await supabase
        .from('appointments')
        .select('service_fee, deposit_amount, payment_status, payment_date, matter_type')
        .eq('id', caseItem.id)
        .single();

      setCaseFinancials(appointment);

      // Fetch docs if not already loaded
      if (!caseDocuments[caseItem.id]) {
        await fetchCaseDocuments(caseItem.id);
      }
    } catch (err) {
      console.error('Error fetching case detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, [caseDocuments, fetchCaseDocuments]);

  const openCaseDetail = (caseItem: any) => {
    setSelectedCase(caseItem);
    setDetailDialogOpen(true);
    fetchCaseDetail(caseItem);
  };

  // Fetch invoice/payment data
  const fetchInvoiceData = useCallback(async () => {
    setInvoiceLoading(true);
    try {
      const { data } = await supabase
        .from('appointments')
        .select(`
          id, appointment_date, service_fee, deposit_amount, payment_status,
          claimants(first_name, last_name, auto_id),
          medical_experts(first_name, last_name, expert_type)
        `)
        .is('deleted_at', null)
        .order('appointment_date', { ascending: false });
      setInvoiceData(data || []);
    } catch (err) {
      console.error('Error fetching invoice data:', err);
    } finally {
      setInvoiceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'invoices') fetchInvoiceData();
  }, [activeTab, fetchInvoiceData]);

  // Toggle case expansion
  const toggleCaseExpansion = (caseId: string) => {
    if (expandedCaseId === caseId) {
      setExpandedCaseId(null);
    } else {
      setExpandedCaseId(caseId);
      if (!caseDocuments[caseId]) fetchCaseDocuments(caseId);
    }
  };

  const getOverallStatus = (phases: any[]) => {
    if (phases.every(p => p.status === 'completed')) return 'Completed';
    if (phases.some(p => p.status === 'in_progress')) return 'In Progress';
    return 'Pending';
  };

  const getLitigationStage = (phases: any[]) => {
    if (phases.every(p => p.status === 'completed')) return 'Trial Ready';
    const reportPhase = phases.find(p => p.name === 'Report Ready');
    if (reportPhase?.status === 'completed') return 'Report Complete';
    const assessPhase = phases.find(p => p.name === 'Claimant Assessed');
    if (assessPhase?.status === 'completed') return 'Assessed';
    const scheduledPhase = phases.find(p => p.name === 'Appointment Scheduled');
    if (scheduledPhase?.status === 'completed') return 'Scheduled';
    return 'Booking';
  };

  const calculatePrescriptionRisk = (appointmentDate: string) => {
    const threeYearsFromNow = new Date();
    threeYearsFromNow.setFullYear(threeYearsFromNow.getFullYear() + 3);
    const daysLeft = differenceInDays(threeYearsFromNow, new Date(appointmentDate));
    if (daysLeft < 90) return { status: 'critical', daysLeft };
    if (daysLeft < 180) return { status: 'warning', daysLeft };
    return { status: 'safe', daysLeft };
  };

  const filteredCases = useMemo(() => {
    return liveCases.filter(c => {
      const matchesSearch =
        c.claimantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.expertType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.claimantAutoId.toLowerCase().includes(searchTerm.toLowerCase());
      const status = getOverallStatus(c.phases);
      const matchesStatus = statusFilter === 'all' || status.toLowerCase() === statusFilter.toLowerCase();

      // Litigation filter
      const litStage = getLitigationStage(c.phases);
      let matchesLitigation = true;
      if (litigationFilter === 'trial_ready') matchesLitigation = litStage === 'Trial Ready';
      if (litigationFilter === 'reports_outstanding') {
        const reportPhase = c.phases.find(p => p.name === 'Report Ready');
        matchesLitigation = reportPhase?.status !== 'completed';
      }
      if (litigationFilter === 'active') matchesLitigation = status !== 'Completed';
      if (litigationFilter === 'closed') matchesLitigation = status === 'Completed';

      return matchesSearch && matchesStatus && matchesLitigation;
    });
  }, [liveCases, searchTerm, statusFilter, litigationFilter]);

  const STATUS_PILL_TONE: Record<string, PortalPillTone> = {
    'Completed': 'success',
    'In Progress': 'teal',
    'Pending': 'warning',
  };
  const statusBadge = (status: string) => (
    <PortalPill tone={STATUS_PILL_TONE[status] || 'neutral'}>{status}</PortalPill>
  );

  const LITIGATION_PILL_TONE: Record<string, PortalPillTone> = {
    'Trial Ready': 'success',
    'Report Complete': 'teal',
    'Assessed': 'teal',
    'Scheduled': 'neutral',
    'Booking': 'warning',
  };
  const litigationBadge = (stage: string) => (
    <PortalPill tone={LITIGATION_PILL_TONE[stage] || 'neutral'}>{stage}</PortalPill>
  );

  const prescriptionBadge = (risk: { status: string; daysLeft: number }) => {
    if (risk.status === 'critical') return <PortalPill tone="destructive"><AlertTriangle className="h-3 w-3" />{risk.daysLeft}d</PortalPill>;
    if (risk.status === 'warning') return <PortalPill tone="warning"><Clock className="h-3 w-3" />{risk.daysLeft}d</PortalPill>;
    return null;
  };

  // Upload document
  const handleUploadDocument = async (file: File) => {
    if (!selectedCaseForUpload || !user) return;
    setUploading(true);
    try {
      const filePath = `attorney-documents/${selectedCaseForUpload}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('documents').insert({
        appointment_id: selectedCaseForUpload,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type,
        document_type: uploadDocType,
        uploaded_by: user.id,
        upload_date: new Date().toISOString().split('T')[0],
        upload_time: new Date().toTimeString().split(' ')[0],
      });
      if (insertError) throw insertError;

      toast({ title: 'Document Uploaded', description: `${file.name} uploaded successfully.` });
      setUploadDialogOpen(false);
      fetchCaseDocuments(selectedCaseForUpload);
    } catch (err: any) {
      console.error('Upload error:', err);
      toast({ title: 'Error', description: 'Failed to upload document.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  // Submit new referral
  const handleSubmitReferral = async () => {
    if (!user || !newReferral.firstName || !newReferral.lastName) return;
    setSubmittingReferral(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('referring_attorney_id')
        .eq('id', user.id)
        .single();

      if (!profile?.referring_attorney_id) {
        toast({ title: 'Error', description: 'No referring attorney linked to your profile.', variant: 'destructive' });
        return;
      }

      const { data: attorney } = await supabase
        .from('referring_attorneys')
        .select('name')
        .eq('id', profile.referring_attorney_id)
        .single();

      const { error } = await supabase.from('appointment_requests').insert({
        claimant_first_name: newReferral.firstName,
        claimant_last_name: newReferral.lastName,
        matter_type: newReferral.matterType,
        expert_type_requested: newReferral.expertType,
        province: newReferral.province,
        preferred_date_type: 'any',
        additional_notes: newReferral.notes || null,
        referring_attorney_id: profile.referring_attorney_id,
        referring_attorney_name: attorney?.name || 'Unknown',
        requested_by: user.id,
      });

      if (error) throw error;

      toast({ title: 'Referral Submitted', description: `New referral for ${newReferral.firstName} ${newReferral.lastName} submitted successfully.` });
      setReferralDialogOpen(false);
      setNewReferral({ firstName: '', lastName: '', matterType: 'raf', expertType: 'orthopaedic_surgeon', notes: '', province: 'Gauteng' });
      refetchStats();
    } catch (err: any) {
      console.error('Referral error:', err);
      toast({ title: 'Error', description: 'Failed to submit referral.', variant: 'destructive' });
    } finally {
      setSubmittingReferral(false);
    }
  };

  // Download report
  const handleDownloadReport = async (filePath: string, fileName: string) => {
    try {
      // Try multiple buckets
      const buckets = ['documents', 'attorney-documents', 'expert-documents'];
      for (const bucket of buckets) {
        const { data, error } = await supabase.storage.from(bucket).download(filePath);
        if (data && !error) {
          const url = URL.createObjectURL(data);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          toast({ title: 'Downloaded', description: `${fileName} downloaded.` });
          return;
        }
      }
      toast({ title: 'Error', description: 'Report file not found.', variant: 'destructive' });
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to download report.', variant: 'destructive' });
    }
  };

  // Download case report PDF
  const downloadReportPDF = (caseItem: any) => {
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'CASE REPORT', `Claimant: ${caseItem.claimantName}`);
    const phaseRows = caseItem.phases.map((p: any) => [
      p.name,
      p.status === 'completed' ? 'Completed' : p.status === 'in_progress' ? 'In Progress' : 'Pending',
      p.completedAt ? format(new Date(p.completedAt), 'dd MMM yyyy') : '—',
    ]);
    autoTable(doc, {
      ...getStyledTableOptions(),
      startY: startY + 10,
      head: [['Phase', 'Status', 'Date']],
      body: phaseRows,
    });
    addBrandingFooter(doc);
    const safeName = caseItem.claimantName.replace(/\s+/g, '_');
    doc.save(`Report_${safeName}.pdf`);
  };

  // Download statement PDF
  const downloadStatementPDF = () => {
    const doc = new jsPDF();
    const startY = addBrandingToPDF(doc, 'ACCOUNT STATEMENT', `Generated: ${format(new Date(), 'dd MMMM yyyy')}`);
    const rows = invoiceData.map((item: any) => {
      const claimant = Array.isArray(item.claimants) ? item.claimants[0] : item.claimants;
      const expert = Array.isArray(item.medical_experts) ? item.medical_experts[0] : item.medical_experts;
      return [
        `${claimant?.first_name || ''} ${claimant?.last_name || ''}`.trim(),
        formatExpertType(expert?.expert_type || ''),
        format(new Date(item.appointment_date), 'dd MMM yyyy'),
        `R${(item.service_fee || 0).toLocaleString()}`,
        `R${(item.deposit_amount || 0).toLocaleString()}`,
        item.payment_status || 'Pending',
      ];
    });
    autoTable(doc, {
      ...getStyledTableOptions(),
      startY: startY + 10,
      head: [['Claimant', 'Expert Type', 'Date', 'Service Fee', 'Deposit', 'Status']],
      body: rows,
    });
    const totalFees = invoiceData.reduce((s: number, i: any) => s + (i.service_fee || 0), 0);
    const totalDeposits = invoiceData.reduce((s: number, i: any) => s + (i.deposit_amount || 0), 0);
    const finalY = (doc as any).lastAutoTable?.finalY || 120;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Fees: R${totalFees.toLocaleString()}   |   Total Deposits: R${totalDeposits.toLocaleString()}   |   Outstanding: R${(totalFees - totalDeposits).toLocaleString()}`, 14, finalY + 10);
    addBrandingFooter(doc);
    doc.save(`Account_Statement_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const getProgressPercent = (phases: any[]) => {
    const completed = phases.filter(p => p.status === 'completed').length;
    return Math.round((completed / phases.length) * 100);
  };

  // ---- KPI strip (same numbers as before, ledger presentation) ----------
  const inProgressCount = liveCases.filter(c => getOverallStatus(c.phases) === 'In Progress').length;
  const trialReadyCount = liveCases.filter(c => getLitigationStage(c.phases) === 'Trial Ready').length;
  const reportsOutstandingCount = liveCases.filter(c => c.phases.find(p => p.name === 'Report Ready')?.status !== 'completed').length;
  const reportsReadyCount = liveCases.filter(c => c.phases.find(p => p.name === 'Report Ready')?.status === 'completed').length;

  const totalInvoiceFees = invoiceData.reduce((s: number, i: any) => s + (i.service_fee || 0), 0);
  const totalInvoiceDeposits = invoiceData.reduce((s: number, i: any) => s + (i.deposit_amount || 0), 0);

  return (
    <AttorneyPortalLayout>
      <PortalPage>
        <PortalHeader
          eyebrow="Attorney Portal"
          title="Case Management"
          description="Submit referrals, upload documents, track progress, and download reports"
          icon={Briefcase}
          actions={
            <>
              <SyncStatus loading={loading} onRefresh={refetchStats} label="Live data" />
              <Button onClick={() => setReferralDialogOpen(true)} className="rounded-none gap-2">
                <Plus className="h-4 w-4" />
                Submit New Referral
              </Button>
            </>
          }
        />

        {/* KPI ledger — one bordered panel, matches the Dashboard's stat strip */}
        <PortalStatStrip
          loading={loading}
          tiles={[
            { label: 'Total Cases', value: liveCases.length, icon: Briefcase },
            { label: 'In Progress', value: inProgressCount, icon: Clock },
            { label: 'Trial Ready', value: trialReadyCount, icon: CheckCircle2 },
            { label: 'Reports Outstanding', value: reportsOutstandingCount, icon: AlertTriangle, urgent: reportsOutstandingCount > 0 },
            { label: 'Reports Ready', value: reportsReadyCount, icon: FileCheck },
          ]}
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <AdminTabList columns={4}>
            <AdminTabTrigger value="cases" label="My Cases" icon={FolderOpen} center />
            <AdminTabTrigger value="documents" label="Documents" icon={FileText} center />
            <AdminTabTrigger value="litigation" label="Trial Prep" icon={Scale} center />
            <AdminTabTrigger value="invoices" label="Invoices" icon={Receipt} center />
          </AdminTabList>

          {/* Cases Tab */}
          <TabsContent value="cases" className="mt-4 space-y-4">
            {/* Search & Filter */}
            <PortalCard>
              <PortalCardBody>
                <div className="flex flex-col gap-3 md:flex-row">
                  <AdminSearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Search by claimant name, ID, or expert type…"
                    className="flex-1"
                  />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className={cn(FIELD_CLASS, 'w-full md:w-[180px]')}>
                      <Filter className="mr-2 h-4 w-4 text-slate-400" /><SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={litigationFilter} onValueChange={setLitigationFilter}>
                    <SelectTrigger className={cn(FIELD_CLASS, 'w-full md:w-[200px]')}>
                      <Scale className="mr-2 h-4 w-4 text-slate-400" /><SelectValue placeholder="Litigation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="active">Active Cases</SelectItem>
                      <SelectItem value="closed">Closed Cases</SelectItem>
                      <SelectItem value="reports_outstanding">Reports Outstanding</SelectItem>
                      <SelectItem value="trial_ready">Trial Ready</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </PortalCardBody>
            </PortalCard>

            {/* Cases Table */}
            <PortalCard>
              <PortalCardHeader
                icon={Briefcase}
                title={`Case List (${filteredCases.length})`}
                description="Click a case to view full details including expert assessments, reports, and financials"
              />
              {loading ? (
                <PortalLoadingState label="Loading cases…" />
              ) : filteredCases.length === 0 ? (
                <PortalEmptyState
                  icon={Briefcase}
                  title="No cases found"
                  description="Try a different search term or filter, or submit a new referral."
                  action={
                    <Button variant="outline" className="mt-2 rounded-none" onClick={() => setReferralDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />Submit a New Referral
                    </Button>
                  }
                />
              ) : (
                <>
                  {/* Desktop table */}
                  <ScrollArea className="hidden h-[500px] md:block">
                    <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                      <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                        <TableRow>
                          <TableHead>Reference</TableHead>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Expert</TableHead>
                          <TableHead>Current Status</TableHead>
                          <TableHead>Litigation Stage</TableHead>
                          <TableHead>Progress</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCases.map((caseItem) => {
                          const overallStatus = getOverallStatus(caseItem.phases);
                          const litStage = getLitigationStage(caseItem.phases);
                          const prescriptionRisk = calculatePrescriptionRisk(caseItem.appointmentDate);
                          const progressPercent = getProgressPercent(caseItem.phases);

                          return (
                            <TableRow key={caseItem.id} className="cursor-pointer hover:bg-black/[0.02]" onClick={() => openCaseDetail(caseItem)}>
                              <TableCell>
                                <span className="font-mono text-[11px] text-slate-500">{caseItem.claimantAutoId || caseItem.id.slice(0, 8)}</span>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-slate-400" />
                                  <span className="font-medium text-black">{caseItem.claimantName}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-500">{formatExpertType(caseItem.expertType)}</TableCell>
                              <TableCell>{statusBadge(overallStatus)}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {litigationBadge(litStage)}
                                  {prescriptionBadge(prescriptionRisk)}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Progress value={progressPercent} className="h-1.5 w-16 rounded-none" />
                                  <span className="text-[11px] tabular-nums text-slate-500">{progressPercent}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none" onClick={() => openCaseDetail(caseItem)} title="View Details">
                                    <Eye className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none" onClick={() => {
                                    setSelectedCaseForUpload(caseItem.id);
                                    setSelectedClaimantForUpload(caseItem.claimantName);
                                    setUploadDialogOpen(true);
                                  }} title="Upload Document">
                                    <Upload className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Mobile cards — same rows, no sideways scroll */}
                  <ScrollArea className="h-[560px] md:hidden">
                    <div className="divide-y divide-black/10">
                      {filteredCases.map((caseItem) => {
                        const overallStatus = getOverallStatus(caseItem.phases);
                        const litStage = getLitigationStage(caseItem.phases);
                        const prescriptionRisk = calculatePrescriptionRisk(caseItem.appointmentDate);
                        const progressPercent = getProgressPercent(caseItem.phases);

                        return (
                          <button
                            key={caseItem.id}
                            type="button"
                            onClick={() => openCaseDetail(caseItem)}
                            className="flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-black">{caseItem.claimantName}</p>
                                <p className="truncate font-mono text-[10px] text-slate-500">{caseItem.claimantAutoId || caseItem.id.slice(0, 8)}</p>
                              </div>
                              <div className="flex shrink-0 gap-1" onClick={e => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none" onClick={() => openCaseDetail(caseItem)} title="View Details">
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-none" onClick={() => {
                                  setSelectedCaseForUpload(caseItem.id);
                                  setSelectedClaimantForUpload(caseItem.claimantName);
                                  setUploadDialogOpen(true);
                                }} title="Upload Document">
                                  <Upload className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-xs text-slate-500">{formatExpertType(caseItem.expertType)}</p>
                            <div className="flex flex-wrap items-center gap-1">
                              {statusBadge(overallStatus)}
                              {litigationBadge(litStage)}
                              {prescriptionBadge(prescriptionRisk)}
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={progressPercent} className="h-1.5 flex-1 rounded-none" />
                              <span className="text-[11px] tabular-nums text-slate-500">{progressPercent}%</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </PortalCard>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents" className="mt-4">
            <PortalCard>
              <PortalCardHeader
                icon={FileText}
                title="All Case Documents"
                description="View and upload documents across all your cases"
              />
              <PortalCardBody>
                {liveCases.length === 0 ? (
                  <PortalEmptyState icon={FolderOpen} title="No cases available" />
                ) : (
                  <div className="space-y-3">
                    {liveCases.map(caseItem => {
                      const docs = caseDocuments[caseItem.id] || [];
                      return (
                        <div key={caseItem.id} className="border border-black/10 p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex min-w-0 items-center gap-2">
                              <User className="h-4 w-4 shrink-0" style={{ color: BRAND_TEAL }} />
                              <span className="truncate text-sm font-semibold text-black">{caseItem.claimantName}</span>
                              <PortalPill>{formatExpertType(caseItem.expertType)}</PortalPill>
                            </div>
                            <Button size="sm" variant="outline" className="rounded-none" onClick={() => {
                              setSelectedCaseForUpload(caseItem.id);
                              setSelectedClaimantForUpload(caseItem.claimantName);
                              setUploadDialogOpen(true);
                              if (!caseDocuments[caseItem.id]) fetchCaseDocuments(caseItem.id);
                            }}>
                              <Upload className="mr-1 h-3 w-3" />Upload
                            </Button>
                          </div>
                          {!caseDocuments[caseItem.id] ? (
                            <Button variant="ghost" size="sm" className="rounded-none" onClick={() => fetchCaseDocuments(caseItem.id)}>
                              <Eye className="mr-1 h-3 w-3" />Load Documents
                            </Button>
                          ) : docs.length === 0 ? (
                            <p className="text-xs italic text-slate-400">No documents uploaded</p>
                          ) : (
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                              {docs.map(d => (
                                <div key={d.id} className="flex items-center gap-2 border border-black/10 bg-black/[0.015] p-2 text-xs">
                                  <FileCheck className="h-3 w-3 shrink-0 text-success" />
                                  <span className="flex-1 truncate">{d.file_name}</span>
                                  <PortalPill className="shrink-0 text-[9px]">
                                    {DOCUMENT_TYPES.find(t => t.value === d.document_type)?.label || d.document_type}
                                  </PortalPill>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </PortalCardBody>
            </PortalCard>
          </TabsContent>

          {/* Litigation & Trial Prep Tab */}
          <TabsContent value="litigation" className="mt-4">
            <LitigationTrialServices liveCases={liveCases} />
          </TabsContent>

          {/* Invoices & Statements Tab */}
          <TabsContent value="invoices" className="mt-4">
            <PortalCard>
              <PortalCardHeader
                icon={Receipt}
                title="Invoices & Statements"
                description="View and download your financial statements"
                actions={
                  <Button size="sm" className="rounded-none" onClick={downloadStatementPDF} disabled={invoiceData.length === 0}>
                    <Download className="mr-2 h-4 w-4" />Download Statement
                  </Button>
                }
              />
              {invoiceLoading ? (
                <PortalLoadingState label="Loading invoices…" />
              ) : invoiceData.length === 0 ? (
                <PortalEmptyState icon={Receipt} title="No invoice data available" />
              ) : (
                <>
                  <div className="grid grid-cols-3 divide-x divide-black/10 border-b border-black/10">
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Fees</p>
                      <p className="text-lg font-bold tabular-nums text-black">R{totalInvoiceFees.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Total Deposits</p>
                      <p className="text-lg font-bold tabular-nums text-success">R{totalInvoiceDeposits.toLocaleString()}</p>
                    </div>
                    <div className="px-3 py-3 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Outstanding</p>
                      <p className="text-lg font-bold tabular-nums text-destructive">R{(totalInvoiceFees - totalInvoiceDeposits).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Desktop table */}
                  <ScrollArea className="hidden h-[400px] md:block">
                    <Table className="text-xs [&_td]:px-3 [&_td]:py-2.5 [&_th]:h-9 [&_th]:px-3 [&_th]:text-[11px]">
                      <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_theme(colors.black/10%)]">
                        <TableRow>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Expert Type</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Service Fee</TableHead>
                          <TableHead className="text-right">Deposit</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceData.map((item: any) => {
                          const claimant = Array.isArray(item.claimants) ? item.claimants[0] : item.claimants;
                          const expert = Array.isArray(item.medical_experts) ? item.medical_experts[0] : item.medical_experts;
                          const name = `${claimant?.first_name || ''} ${claimant?.last_name || ''}`.trim();
                          return (
                            <TableRow key={item.id} className="hover:bg-black/[0.02]">
                              <TableCell className="font-medium text-black">{name || 'Unknown'}</TableCell>
                              <TableCell className="text-slate-500">{formatExpertType(expert?.expert_type || '')}</TableCell>
                              <TableCell className="text-slate-500">{format(new Date(item.appointment_date), 'dd MMM yyyy')}</TableCell>
                              <TableCell className="text-right tabular-nums">R{(item.service_fee || 0).toLocaleString()}</TableCell>
                              <TableCell className="text-right tabular-nums text-success">R{(item.deposit_amount || 0).toLocaleString()}</TableCell>
                              <TableCell>
                                <PortalPill tone={item.payment_status === 'paid' ? 'success' : 'warning'}>
                                  {item.payment_status || 'Pending'}
                                </PortalPill>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  {/* Mobile cards */}
                  <ScrollArea className="h-[460px] md:hidden">
                    <div className="divide-y divide-black/10">
                      {invoiceData.map((item: any) => {
                        const claimant = Array.isArray(item.claimants) ? item.claimants[0] : item.claimants;
                        const expert = Array.isArray(item.medical_experts) ? item.medical_experts[0] : item.medical_experts;
                        const name = `${claimant?.first_name || ''} ${claimant?.last_name || ''}`.trim();
                        return (
                          <div key={item.id} className="px-4 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-black">{name || 'Unknown'}</p>
                                <p className="truncate text-xs text-slate-500">{formatExpertType(expert?.expert_type || '')}</p>
                              </div>
                              <PortalPill tone={item.payment_status === 'paid' ? 'success' : 'warning'}>
                                {item.payment_status || 'Pending'}
                              </PortalPill>
                            </div>
                            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                              <span>{format(new Date(item.appointment_date), 'dd MMM yyyy')}</span>
                              <span className="tabular-nums text-black">
                                R{(item.service_fee || 0).toLocaleString()}
                                <span className="text-success"> / R{(item.deposit_amount || 0).toLocaleString()}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </>
              )}
            </PortalCard>
          </TabsContent>
        </Tabs>
      </PortalPage>

      {/* Case Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-none border-black/10 sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-black">
              <Briefcase className="h-5 w-5" style={{ color: BRAND_TEAL }} />
              Case Detail — {selectedCase?.claimantName}
            </DialogTitle>
            <DialogDescription>
              {selectedCase?.claimantAutoId} • {formatExpertType(selectedCase?.expertType || '')}
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <PortalLoadingState label="Loading case detail…" />
          ) : selectedCase && (
            <div className="space-y-6">
              {/* A. Case Overview */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black">
                  <User className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Case Overview
                </h3>
                <div className="grid grid-cols-2 gap-3 border border-black/10 bg-black/[0.015] p-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Claimant</p>
                    <p className="font-medium text-black">{selectedCase.claimantName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Reference</p>
                    <p className="font-mono font-medium text-black">{selectedCase.claimantAutoId}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Expert Assigned</p>
                    <p className="font-medium text-black">{formatExpertType(selectedCase.expertType)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Appointment Date</p>
                    <p className="font-medium text-black">{format(new Date(selectedCase.appointmentDate), 'dd MMMM yyyy')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Matter Type</p>
                    <p className="font-medium capitalize text-black">{caseFinancials?.matter_type?.replace(/_/g, ' ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Litigation Stage</p>
                    {litigationBadge(getLitigationStage(selectedCase.phases))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* B. Expert Assessment */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black">
                  <Stethoscope className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Expert Assessment
                </h3>
                <Table className="text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:h-8 [&_th]:px-3 [&_th]:text-[11px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expert Type</TableHead>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Appointment Date</TableHead>
                      <TableHead>Assessed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{formatExpertType(selectedCase.expertType)}</TableCell>
                      <TableCell>{selectedCase.claimantName}</TableCell>
                      <TableCell>{format(new Date(selectedCase.appointmentDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell>
                        {selectedCase.phases.find((p: any) => p.name === 'Claimant Assessed')?.status === 'completed'
                          ? <PortalPill tone="success">Yes</PortalPill>
                          : selectedCase.phases.find((p: any) => p.name === 'Claimant Assessed')?.status === 'in_progress'
                          ? <PortalPill tone="warning">Scheduled</PortalPill>
                          : <PortalPill>No</PortalPill>
                        }
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* C. Reports Section */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black">
                  <FileText className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Reports
                </h3>
                {caseExpertReports.length === 0 ? (
                  <p className="text-sm italic text-slate-400">No reports available yet.</p>
                ) : (
                  <Table className="text-xs [&_td]:px-3 [&_td]:py-2 [&_th]:h-8 [&_th]:px-3 [&_th]:text-[11px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Expert Type</TableHead>
                        <TableHead>Report Status</TableHead>
                        <TableHead>Submitted</TableHead>
                        <TableHead className="text-right">Download</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {caseExpertReports.map((report: any) => {
                        const expert = report.medical_experts;
                        const isCompleted = ['completed', 'taken_out', 'report_submitted'].includes(report.report_status);
                        return (
                          <TableRow key={report.id}>
                            <TableCell>{formatExpertType(expert?.expert_type || selectedCase.expertType)}</TableCell>
                            <TableCell>
                              <PortalPill tone={isCompleted ? 'success' : 'warning'}>
                                {report.report_status?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                              </PortalPill>
                            </TableCell>
                            <TableCell>
                              {report.report_submitted_date ? format(new Date(report.report_submitted_date), 'dd MMM yyyy') : '—'}
                            </TableCell>
                            <TableCell className="text-right">
                              {isCompleted && report.report_file_path ? (
                                <Button size="sm" variant="outline" className="rounded-none" onClick={() => handleDownloadReport(report.report_file_path, `Report_${selectedCase.claimantName}.pdf`)}>
                                  <Download className="mr-1 h-4 w-4" /> Download
                                </Button>
                              ) : isCompleted ? (
                                <Button size="sm" variant="outline" className="rounded-none" onClick={() => downloadReportPDF(selectedCase)}>
                                  <Download className="mr-1 h-4 w-4" /> PDF
                                </Button>
                              ) : (
                                <span className="text-xs text-slate-400">Not available</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>

              <Separator />

              {/* D. Documents */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black">
                    <FolderOpen className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Documents
                  </h3>
                  <Button size="sm" variant="outline" className="rounded-none" onClick={() => {
                    setSelectedCaseForUpload(selectedCase.id);
                    setSelectedClaimantForUpload(selectedCase.claimantName);
                    setUploadDialogOpen(true);
                  }}>
                    <Upload className="mr-1 h-3 w-3" /> Upload
                  </Button>
                </div>
                {(caseDocuments[selectedCase.id] || []).length === 0 ? (
                  <p className="text-xs italic text-slate-400">No documents uploaded yet.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {(caseDocuments[selectedCase.id] || []).map((d: CaseDocument) => (
                      <div key={d.id} className="flex items-center gap-2 border border-black/10 bg-black/[0.015] p-2 text-xs">
                        <FileCheck className="h-3 w-3 shrink-0 text-success" />
                        <span className="flex-1 truncate">{d.file_name}</span>
                        <PortalPill className="shrink-0 text-[9px]">
                          {DOCUMENT_TYPES.find(t => t.value === d.document_type)?.label || d.document_type}
                        </PortalPill>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* E. Financial Section */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black">
                  <CreditCard className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Financial Summary
                </h3>
                <div className="grid grid-cols-2 divide-x divide-y divide-black/10 border border-black/10 sm:grid-cols-4 sm:divide-y-0">
                  <div className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Service Fee</p>
                    <p className="text-lg font-bold tabular-nums text-black">R{(caseFinancials?.service_fee || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Deposit</p>
                    <p className="text-lg font-bold tabular-nums text-success">R{(caseFinancials?.deposit_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Amount Due</p>
                    <p className="text-lg font-bold tabular-nums text-destructive">
                      R{((caseFinancials?.service_fee || 0) - (caseFinancials?.deposit_amount || 0)).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 text-center">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Payment Status</p>
                    <PortalPill tone={caseFinancials?.payment_status === 'paid' ? 'success' : 'warning'}>
                      {caseFinancials?.payment_status || 'Pending'}
                    </PortalPill>
                  </div>
                </div>
              </div>

              {/* Progress Timeline */}
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-black">
                  <TrendingUp className="h-3.5 w-3.5" style={{ color: BRAND_TEAL }} /> Assessment Progress
                </h3>
                <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-7">
                  {selectedCase.phases.map((phase: any, idx: number) => (
                    <div key={idx} className={cn(
                      'border p-2 text-center text-[11px]',
                      phase.status === 'completed' ? 'border-success/40 bg-success/5 text-success' :
                      phase.status === 'in_progress' ? 'border-[#00BAAD]/40 bg-[#00BAAD]/5' :
                      'border-black/10 bg-black/[0.015] text-slate-500'
                    )} style={phase.status === 'in_progress' ? { color: BRAND_TEAL } : undefined}>
                      <div className="font-medium">{phase.name}</div>
                      {phase.completedAt && (
                        <div className="mt-1 text-[10px] opacity-70">
                          {format(new Date(phase.completedAt), 'dd MMM')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="rounded-none border-black/10 sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-black">Upload Document</DialogTitle>
            <DialogDescription>Upload documents for {selectedClaimantForUpload}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Document Type</label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger className={cn(FIELD_CLASS, 'mt-1')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Select File</label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={uploading}
                className={cn(FIELD_CLASS, 'mt-1')}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadDocument(file);
                }}
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />Uploading...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Referral Dialog */}
      <Dialog open={referralDialogOpen} onOpenChange={setReferralDialogOpen}>
        <DialogContent className="max-w-lg rounded-none border-black/10 sm:rounded-none">
          <DialogHeader>
            <DialogTitle className="text-black">Submit New Referral</DialogTitle>
            <DialogDescription>Submit a new or existing case for medico-legal assessment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">First Name *</label>
                <Input value={newReferral.firstName} onChange={e => setNewReferral(p => ({ ...p, firstName: e.target.value }))} placeholder="Claimant first name" className={cn(FIELD_CLASS, 'mt-1')} />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Last Name *</label>
                <Input value={newReferral.lastName} onChange={e => setNewReferral(p => ({ ...p, lastName: e.target.value }))} placeholder="Claimant last name" className={cn(FIELD_CLASS, 'mt-1')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Matter Type</label>
                <Select value={newReferral.matterType} onValueChange={v => setNewReferral(p => ({ ...p, matterType: v }))}>
                  <SelectTrigger className={cn(FIELD_CLASS, 'mt-1')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raf">RAF</SelectItem>
                    <SelectItem value="slip_and_fall">Slip & Fall</SelectItem>
                    <SelectItem value="unlawful_arrest">Unlawful Arrest</SelectItem>
                    <SelectItem value="medical_negligence">Medical Negligence</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Expert Type</label>
                <Select value={newReferral.expertType} onValueChange={v => setNewReferral(p => ({ ...p, expertType: v }))}>
                  <SelectTrigger className={cn(FIELD_CLASS, 'mt-1')}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="orthopaedic_surgeon">Orthopaedic Surgeon</SelectItem>
                    <SelectItem value="neurosurgeon">Neurosurgeon</SelectItem>
                    <SelectItem value="psychologist">Psychologist</SelectItem>
                    <SelectItem value="psychiatrist">Psychiatrist</SelectItem>
                    <SelectItem value="occupational_therapist">Occupational Therapist</SelectItem>
                    <SelectItem value="general_surgeon">General Surgeon</SelectItem>
                    <SelectItem value="neurologist">Neurologist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Province</label>
              <Select value={newReferral.province} onValueChange={v => setNewReferral(p => ({ ...p, province: v }))}>
                <SelectTrigger className={cn(FIELD_CLASS, 'mt-1')}><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-slate-500">Additional Notes</label>
              <Textarea value={newReferral.notes} onChange={e => setNewReferral(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional information about the case..." className={cn(FIELD_CLASS, 'mt-1')} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-none" onClick={() => setReferralDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-none" onClick={handleSubmitReferral} disabled={submittingReferral || !newReferral.firstName || !newReferral.lastName}>
              {submittingReferral ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              Submit Referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AttorneyPortalLayout>
  );
};

export default AttorneyMyCases;
