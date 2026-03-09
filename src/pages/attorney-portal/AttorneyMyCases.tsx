import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AttorneyPortalLayout } from '@/components/portal/AttorneyPortalLayout';
import { useAttorneyDashboardStats } from '@/hooks/useAttorneyDashboardStats';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Briefcase, Search, Filter, AlertTriangle, CheckCircle2, Clock, FileText,
  Calendar, User, Eye, Plus, Upload, Download, ChevronDown, ChevronRight,
  Send, FolderOpen, Receipt, TrendingUp, FileCheck, Loader2, Scale
} from 'lucide-react';
import { LitigationTrialServices } from '@/components/attorney-portal/LitigationTrialServices';
import { format, differenceInDays } from 'date-fns';
import { formatExpertType } from '@/utils/expertTypeMapping';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { addBrandingToPDF, addBrandingFooter, getStyledTableOptions } from '@/utils/pdfBranding';

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
  { value: 'other', label: 'Other Supporting Document' },
];

const AttorneyMyCases: React.FC = () => {
  const { liveCases, loading, refetchStats } = useAttorneyDashboardStats();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('cases');
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [caseDocuments, setCaseDocuments] = useState<Record<string, CaseDocument[]>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadDocType, setUploadDocType] = useState('medical_records');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedCaseForUpload, setSelectedCaseForUpload] = useState<string | null>(null);
  const [selectedClaimantForUpload, setSelectedClaimantForUpload] = useState<string>('');

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
      return matchesSearch && matchesStatus;
    });
  }, [liveCases, searchTerm, statusFilter]);

  const statusBadge = (status: string) => {
    switch (status) {
      case 'Completed': return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'In Progress': return <Badge className="bg-info/10 text-info border-info/20">In Progress</Badge>;
      default: return <Badge className="bg-warning/10 text-warning border-warning/20">Pending</Badge>;
    }
  };

  const prescriptionBadge = (risk: { status: string; daysLeft: number }) => {
    if (risk.status === 'critical') return <Badge className="bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="h-3 w-3 mr-1" />{risk.daysLeft}d</Badge>;
    if (risk.status === 'warning') return <Badge className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />{risk.daysLeft}d</Badge>;
    return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />Safe</Badge>;
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
      // Get user's referring attorney info
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

  // Download report as PDF with claimant name
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

  // Calculate progress percentage
  const getProgressPercent = (phases: any[]) => {
    const completed = phases.filter(p => p.status === 'completed').length;
    return Math.round((completed / phases.length) * 100);
  };

  return (
    <AttorneyPortalLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Briefcase className="h-8 w-8 text-primary" />
              Case Management
            </h1>
            <p className="text-muted-foreground mt-1">
              Submit referrals, upload documents, track progress, and download reports
            </p>
          </div>
          <Button onClick={() => setReferralDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Submit New Referral
          </Button>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Cases</p>
              <p className="text-2xl font-bold">{liveCases.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">In Progress</p>
              <p className="text-2xl font-bold text-info">{liveCases.filter(c => getOverallStatus(c.phases) === 'In Progress').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-2xl font-bold text-success">{liveCases.filter(c => getOverallStatus(c.phases) === 'Completed').length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-card border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Reports Ready</p>
              <p className="text-2xl font-bold text-primary">{liveCases.filter(c => c.phases.find(p => p.name === 'Report Ready')?.status === 'completed').length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cases" className="gap-2"><FolderOpen className="h-4 w-4" />My Cases</TabsTrigger>
            <TabsTrigger value="documents" className="gap-2"><FileText className="h-4 w-4" />Documents</TabsTrigger>
            <TabsTrigger value="invoices" className="gap-2"><Receipt className="h-4 w-4" />Invoices & Statements</TabsTrigger>
          </TabsList>

          {/* Cases Tab */}
          <TabsContent value="cases" className="space-y-4">
            {/* Search & Filter */}
            <Card className="bg-gradient-card border-border/50">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by claimant name or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full md:w-[180px]">
                      <Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Cases List */}
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle>Case List</CardTitle>
                <CardDescription>Click a case to view details, upload documents, and track progress</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : filteredCases.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No cases found</p>
                    <Button variant="outline" className="mt-4" onClick={() => setReferralDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />Submit a New Referral
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredCases.map((caseItem) => {
                      const overallStatus = getOverallStatus(caseItem.phases);
                      const prescriptionRisk = calculatePrescriptionRisk(caseItem.appointmentDate);
                      const reportPhase = caseItem.phases.find(p => p.name === 'Report Ready');
                      const isExpanded = expandedCaseId === caseItem.id;
                      const progressPercent = getProgressPercent(caseItem.phases);
                      const docs = caseDocuments[caseItem.id] || [];

                      return (
                        <Collapsible key={caseItem.id} open={isExpanded} onOpenChange={() => toggleCaseExpansion(caseItem.id)}>
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-muted/30 cursor-pointer transition-colors">
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                              <div className="flex items-center gap-2 min-w-[180px]">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                  <User className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <p className="font-semibold text-sm">{caseItem.claimantName}</p>
                                  <p className="text-xs text-muted-foreground">{caseItem.claimantAutoId}</p>
                                </div>
                              </div>
                              <Badge variant="outline" className="text-xs hidden sm:inline-flex">{formatExpertType(caseItem.expertType)}</Badge>
                              <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(caseItem.appointmentDate), 'dd MMM yyyy')}
                              </div>
                              <div className="flex-1 hidden lg:block">
                                <div className="flex items-center gap-2">
                                  <Progress value={progressPercent} className="h-2 flex-1 max-w-[120px]" />
                                  <span className="text-xs text-muted-foreground">{progressPercent}%</span>
                                </div>
                              </div>
                              {statusBadge(overallStatus)}
                              {prescriptionBadge(prescriptionRisk)}
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="ml-8 mr-4 mb-4 mt-2 space-y-4 border-l-2 border-primary/20 pl-4">
                              {/* Progress Timeline */}
                              <div>
                                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                  <TrendingUp className="h-4 w-4 text-primary" />
                                  Assessment Progress
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                                  {caseItem.phases.map((phase, idx) => (
                                    <div key={idx} className={`p-2 rounded-lg text-center text-xs border ${
                                      phase.status === 'completed' ? 'bg-success/10 border-success/20 text-success' :
                                      phase.status === 'in_progress' ? 'bg-primary/10 border-primary/20 text-primary' :
                                      'bg-muted/30 border-border/50 text-muted-foreground'
                                    }`}>
                                      <div className="font-medium">{phase.name}</div>
                                      {phase.completedAt && (
                                        <div className="text-[10px] mt-1 opacity-70">
                                          {format(new Date(phase.completedAt), 'dd MMM')}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <Separator />

                              {/* Documents Section */}
                              <div>
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <FolderOpen className="h-4 w-4 text-primary" />
                                    Documents ({docs.length})
                                  </h4>
                                  <Button size="sm" variant="outline" onClick={() => {
                                    setSelectedCaseForUpload(caseItem.id);
                                    setSelectedClaimantForUpload(caseItem.claimantName);
                                    setUploadDialogOpen(true);
                                  }}>
                                    <Upload className="h-3 w-3 mr-1" />Upload
                                  </Button>
                                </div>
                                {docs.length === 0 ? (
                                  <p className="text-xs text-muted-foreground italic">No documents uploaded yet. Upload Medical Records, Instruction Letter, ID Copy, and other supporting documents.</p>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {docs.map(d => (
                                      <div key={d.id} className="flex items-center gap-2 p-2 rounded bg-muted/30 text-xs">
                                        <FileCheck className="h-3 w-3 text-success flex-shrink-0" />
                                        <span className="truncate flex-1">{d.file_name}</span>
                                        <Badge variant="outline" className="text-[10px]">
                                          {DOCUMENT_TYPES.find(t => t.value === d.document_type)?.label || d.document_type}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              <Separator />

                              {/* Actions */}
                              <div className="flex flex-wrap gap-2">
                                {reportPhase?.status === 'completed' && (
                                  <Button size="sm" onClick={() => downloadReportPDF(caseItem)} className="gap-1">
                                    <Download className="h-3 w-3" />
                                    Download Report ({caseItem.claimantName})
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" onClick={() => {
                                  setSelectedCaseForUpload(caseItem.id);
                                  setSelectedClaimantForUpload(caseItem.claimantName);
                                  setUploadDialogOpen(true);
                                }} className="gap-1">
                                  <Upload className="h-3 w-3" />Upload Document
                                </Button>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents Tab */}
          <TabsContent value="documents">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  All Case Documents
                </CardTitle>
                <CardDescription>View and upload documents across all your cases</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {liveCases.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No cases available</p>
                  ) : (
                    liveCases.map(caseItem => {
                      const docs = caseDocuments[caseItem.id] || [];
                      return (
                        <div key={caseItem.id} className="border border-border/50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-sm">{caseItem.claimantName}</span>
                              <Badge variant="outline" className="text-xs">{formatExpertType(caseItem.expertType)}</Badge>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => {
                              setSelectedCaseForUpload(caseItem.id);
                              setSelectedClaimantForUpload(caseItem.claimantName);
                              setUploadDialogOpen(true);
                              if (!caseDocuments[caseItem.id]) fetchCaseDocuments(caseItem.id);
                            }}>
                              <Upload className="h-3 w-3 mr-1" />Upload
                            </Button>
                          </div>
                          {!caseDocuments[caseItem.id] ? (
                            <Button variant="ghost" size="sm" onClick={() => fetchCaseDocuments(caseItem.id)}>
                              <Eye className="h-3 w-3 mr-1" />Load Documents
                            </Button>
                          ) : docs.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic">No documents uploaded</p>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {docs.map(d => (
                                <div key={d.id} className="flex items-center gap-2 p-2 rounded bg-muted/30 text-xs">
                                  <FileCheck className="h-3 w-3 text-success flex-shrink-0" />
                                  <span className="truncate flex-1">{d.file_name}</span>
                                  <Badge variant="outline" className="text-[10px]">
                                    {DOCUMENT_TYPES.find(t => t.value === d.document_type)?.label || d.document_type}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Invoices & Statements Tab */}
          <TabsContent value="invoices">
            <Card className="bg-gradient-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-primary" />
                      Invoices & Statements
                    </CardTitle>
                    <CardDescription>View and download your financial statements</CardDescription>
                  </div>
                  <Button size="sm" onClick={downloadStatementPDF} disabled={invoiceData.length === 0}>
                    <Download className="h-4 w-4 mr-2" />Download Statement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {invoiceLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : invoiceData.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No invoice data available</p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="p-3 rounded-lg bg-muted/30 text-center">
                        <p className="text-xs text-muted-foreground">Total Fees</p>
                        <p className="text-lg font-bold">R{invoiceData.reduce((s: number, i: any) => s + (i.service_fee || 0), 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-success/10 text-center">
                        <p className="text-xs text-muted-foreground">Total Deposits</p>
                        <p className="text-lg font-bold text-success">R{invoiceData.reduce((s: number, i: any) => s + (i.deposit_amount || 0), 0).toLocaleString()}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-destructive/10 text-center">
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                        <p className="text-lg font-bold text-destructive">
                          R{(invoiceData.reduce((s: number, i: any) => s + (i.service_fee || 0), 0) - invoiceData.reduce((s: number, i: any) => s + (i.deposit_amount || 0), 0)).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
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
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{name || 'Unknown'}</TableCell>
                                <TableCell className="text-sm">{formatExpertType(expert?.expert_type || '')}</TableCell>
                                <TableCell className="text-sm">{format(new Date(item.appointment_date), 'dd MMM yyyy')}</TableCell>
                                <TableCell className="text-right">R{(item.service_fee || 0).toLocaleString()}</TableCell>
                                <TableCell className="text-right text-success">R{(item.deposit_amount || 0).toLocaleString()}</TableCell>
                                <TableCell>
                                  <Badge variant={item.payment_status === 'paid' ? 'default' : 'outline'} className={item.payment_status === 'paid' ? 'bg-success/10 text-success border-success/20' : ''}>
                                    {item.payment_status || 'Pending'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Upload Document Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>Upload documents for {selectedClaimantForUpload}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Document Type</label>
              <Select value={uploadDocType} onValueChange={setUploadDocType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(dt => (
                    <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Select File</label>
              <Input
                type="file"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                disabled={uploading}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadDocument(file);
                }}
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />Uploading...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* New Referral Dialog */}
      <Dialog open={referralDialogOpen} onOpenChange={setReferralDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit New Referral</DialogTitle>
            <DialogDescription>Submit a new or existing case for medico-legal assessment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">First Name *</label>
                <Input value={newReferral.firstName} onChange={e => setNewReferral(p => ({ ...p, firstName: e.target.value }))} placeholder="Claimant first name" />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name *</label>
                <Input value={newReferral.lastName} onChange={e => setNewReferral(p => ({ ...p, lastName: e.target.value }))} placeholder="Claimant last name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Matter Type</label>
                <Select value={newReferral.matterType} onValueChange={v => setNewReferral(p => ({ ...p, matterType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <label className="text-sm font-medium">Expert Type</label>
                <Select value={newReferral.expertType} onValueChange={v => setNewReferral(p => ({ ...p, expertType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
              <label className="text-sm font-medium">Province</label>
              <Select value={newReferral.province} onValueChange={v => setNewReferral(p => ({ ...p, province: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['Gauteng', 'Western Cape', 'KwaZulu-Natal', 'Eastern Cape', 'Free State', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape'].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Additional Notes</label>
              <Textarea value={newReferral.notes} onChange={e => setNewReferral(p => ({ ...p, notes: e.target.value }))} placeholder="Any additional information about the case..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReferralDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmitReferral} disabled={submittingReferral || !newReferral.firstName || !newReferral.lastName}>
              {submittingReferral ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Submit Referral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AttorneyPortalLayout>
  );
};

export default AttorneyMyCases;
