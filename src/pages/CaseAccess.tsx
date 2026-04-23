import React, { useState, useMemo, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, KeyRound, Briefcase, Calendar, FileText,
  CreditCard, Clock, AlertCircle, CheckCircle2, XCircle, Loader2,
  Bell, CalendarPlus, User, Upload, Download,
  FileSignature, BookMarked, Stamp, Scale, Search, Filter, Eye, TrendingUp,
  Stethoscope, AlertTriangle, FileWarning, Receipt, Lock, FolderOpen
} from 'lucide-react';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { format } from 'date-fns';
import AttorneyBrandedHeader from '@/components/attorney-portal/AttorneyBrandedHeader';
import ProfileNotifications from '@/components/attorney-profile/ProfileNotifications';
import ProfileRequestAppointment from '@/components/attorney-profile/ProfileRequestAppointment';
import ProfileAttorneyDetails from '@/components/attorney-profile/ProfileAttorneyDetails';
import CaseAccessClaimantView from '@/components/attorney-portal/CaseAccessClaimantView';
import SupportingDocumentsView from '@/components/attorney-portal/SupportingDocumentsView';

interface CaseData {
  id: string;
  claimant_name: string;
  appointment_date: string;
  case_status: string;
  payment_status: string;
  matter_type: string;
  expert_name: string;
  expert_type: string;
  report_status: string;
  report_submitted_date: string | null;
  service_fee: number;
  deposit_amount: number;
}

interface AttorneyInfo {
  id: string;
  name: string;
  code: string;
  contact_person: string;
}

interface AccessResponse {
  attorney: AttorneyInfo;
  cases: CaseData[];
  total_cases: number;
  message?: string;
}

// ── Litigation helpers ──
const getLitigationStage = (c: CaseData): string => {
  const reportDone = ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase());
  const paid = c.payment_status?.toLowerCase() === 'paid';
  if (reportDone && paid) return 'Trial Ready';
  if (reportDone) return 'Report Complete';
  const status = c.case_status?.toLowerCase() || '';
  if (['assessed', 'completed', 'done'].includes(status)) return 'Assessed';
  if (['scheduled', 'in_progress', 'in progress', 'confirmed'].includes(status)) return 'Scheduled';
  return 'Booking';
};

const getLitigationProgress = (stage: string): number => {
  const map: Record<string, number> = { 'Booking': 10, 'Scheduled': 30, 'Assessed': 55, 'Report Complete': 80, 'Trial Ready': 100 };
  return map[stage] || 0;
};

const isCaseClosed = (c: CaseData): boolean => {
  return getLitigationStage(c) === 'Trial Ready';
};

const isReportOutstanding = (c: CaseData): boolean => {
  return !['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase());
};

const isLitigationReady = (c: CaseData): boolean => {
  // All reports submitted = ready for litigation
  return ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase());
};

const litigationBadge = (stage: string) => {
  const colors: Record<string, string> = {
    'Trial Ready': 'bg-success/10 text-success border-success/20',
    'Report Complete': 'bg-primary/10 text-primary border-primary/20',
    'Assessed': 'bg-info/10 text-info border-info/20',
    'Scheduled': 'bg-warning/10 text-warning border-warning/20',
    'Booking': 'bg-muted text-muted-foreground border-border',
  };
  return <Badge className={colors[stage] || 'bg-muted text-muted-foreground'}>{stage}</Badge>;
};

const getStatusBadge = (status: string, type: 'case' | 'payment' | 'report') => {
  const normalized = status?.toLowerCase() || 'pending';
  if (type === 'case') {
    if (normalized === 'completed' || normalized === 'done') return <Badge className="bg-success/10 text-success border-success/20">{status}</Badge>;
    if (normalized === 'in_progress' || normalized === 'in progress') return <Badge className="bg-warning/10 text-warning border-warning/20">{status}</Badge>;
    if (normalized === 'cancelled') return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="secondary">{status || 'Pending'}</Badge>;
  }
  if (type === 'payment') {
    if (normalized === 'paid') return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    if (normalized === 'partial') return <Badge className="bg-warning/10 text-warning border-warning/20">{status}</Badge>;
    if (normalized === 'overdue') return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />{status}</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status || 'Pending'}</Badge>;
  }
  if (type === 'report') {
    if (normalized === 'completed' || normalized === 'taken_out' || normalized === 'taken out') return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    if (normalized === 'in_progress' || normalized === 'in progress') return <Badge className="bg-warning/10 text-warning border-warning/20">{status}</Badge>;
    if (normalized === 'overdue') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status || 'Not Received'}</Badge>;
  }
  return <Badge variant="secondary">{status}</Badge>;
};

const getAssessedStatus = (c: CaseData): string => {
  const status = c.case_status?.toLowerCase() || '';
  if (['assessed', 'completed', 'done', 'report_submitted'].includes(status)) return 'Yes';
  if (['scheduled', 'confirmed'].includes(status)) return 'Scheduled';
  if (['rescheduled'].includes(status)) return 'Rescheduled';
  if (['cancelled'].includes(status)) return 'Cancelled';
  return 'No';
};

const assessedBadge = (assessed: string) => {
  if (assessed === 'Yes') return <Badge className="bg-success/10 text-success border-success/20">Yes</Badge>;
  if (assessed === 'Scheduled') return <Badge className="bg-info/10 text-info border-info/20">Scheduled</Badge>;
  if (assessed === 'Rescheduled') return <Badge className="bg-warning/10 text-warning border-warning/20">Rescheduled</Badge>;
  if (assessed === 'Cancelled') return <Badge variant="destructive">Cancelled</Badge>;
  return <Badge variant="outline">No</Badge>;
};

// ── Component ──
const CaseAccess: React.FC = () => {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [accessData, setAccessData] = useState<AccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('cases');
  const [preselectedClaimant, setPreselectedClaimant] = useState<string | null>(null);
  const [preselectedExpertType, setPreselectedExpertType] = useState<string | null>(null);

  // Enhanced filters
  const [searchTerm, setSearchTerm] = useState('');
  const [litigationFilter, setLitigationFilter] = useState('all');

  // Case detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);

  // Reports download dialog (per-appointment)
  const [reportsDialogOpen, setReportsDialogOpen] = useState(false);
  const [reportsCase, setReportsCase] = useState<CaseData | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [appointmentReports, setAppointmentReports] = useState<Array<{
    id: string;
    file_name: string;
    document_type: string;
    upload_date: string;
    file_size: number | null;
    signed_url: string | null;
  }>>([]);

  const handleOpenReports = async (c: CaseData) => {
    setReportsCase(c);
    setReportsDialogOpen(true);
    setReportsLoading(true);
    setAppointmentReports([]);
    try {
      const { data, error } = await supabase.functions.invoke('get-appointment-reports', {
        body: { access_code: accessCode, appointment_id: c.id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setAppointmentReports(data?.reports || []);
      if ((data?.reports || []).length === 0) {
        toast.info('No reports uploaded for this appointment yet');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  };

  const handleDownloadReport = (url: string | null, fileName: string) => {
    if (!url) {
      toast.error('Download link unavailable');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'report';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const navigateToTabForClaimant = (tab: string, claimantName?: string, expertType?: string) => {
    if (claimantName) setPreselectedClaimant(claimantName);
    if (expertType !== undefined) setPreselectedExpertType(expertType);
    setActiveTab(tab);
  };

  // Read access code from URL (?code=...) and immediately strip it from the
  // address bar for security — protects attorney data from being exposed in
  // browser history, bookmarks, screenshots, or shared links.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAccessCode(code);
      try {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {
        // no-op
      }
      // Auto-validate the code so the attorney lands directly in their portal
      setTimeout(() => {
        autoValidateRef.current?.(code);
      }, 0);
    }
  }, []);

  const autoValidateRef = React.useRef<((code: string) => void) | null>(null);

  // ── Dashboard stats ──
  const dashboardStats = useMemo(() => {
    if (!accessData) return null;
    const cases = accessData.cases;
    return {
      totalActive: cases.filter(c => !isCaseClosed(c)).length,
      inBooking: cases.filter(c => getLitigationStage(c) === 'Booking').length,
      reportsOutstanding: cases.filter(c => isReportOutstanding(c)).length,
      litigationReady: cases.filter(c => isLitigationReady(c)).length,
      outstandingInvoices: cases.filter(c => c.payment_status?.toLowerCase() !== 'paid').length,
      totalOutstandingAmount: cases.reduce((sum, c) => {
        if (c.payment_status?.toLowerCase() !== 'paid') {
          return sum + ((c.service_fee || 0) - (c.deposit_amount || 0));
        }
        return sum;
      }, 0),
    };
  }, [accessData]);

  // ── Notification alerts ──
  const notificationAlerts = useMemo(() => {
    if (!accessData) return [];
    const alerts: { type: string; icon: React.ReactNode; title: string; message: string; color: string }[] = [];
    
    // Reports ready for download
    const reportsReady = accessData.cases.filter(c => 
      ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())
    );
    if (reportsReady.length > 0) {
      alerts.push({
        type: 'report_ready',
        icon: <FileText className="h-4 w-4" />,
        title: 'Reports Ready',
        message: `${reportsReady.length} report(s) ready for download: ${reportsReady.map(c => c.claimant_name).join(', ')}`,
        color: 'border-success/50 bg-success/5',
      });
    }

    // Outstanding invoices
    const unpaid = accessData.cases.filter(c => c.payment_status?.toLowerCase() !== 'paid' && (c.service_fee || 0) > 0);
    if (unpaid.length > 0) {
      const totalDue = unpaid.reduce((s, c) => s + ((c.service_fee || 0) - (c.deposit_amount || 0)), 0);
      alerts.push({
        type: 'invoice_issued',
        icon: <Receipt className="h-4 w-4" />,
        title: 'Outstanding Invoices',
        message: `${unpaid.length} invoice(s) outstanding — Total due: R${totalDue.toLocaleString()}`,
        color: 'border-warning/50 bg-warning/5',
      });
    }

    // Missing documents alert (cases without reports that may need docs)
    const missingDocs = accessData.cases.filter(c => 
      isReportOutstanding(c) && getLitigationStage(c) !== 'Booking'
    );
    if (missingDocs.length > 0) {
      alerts.push({
        type: 'missing_documents',
        icon: <FileWarning className="h-4 w-4" />,
        title: 'Action Required – Missing Documents',
        message: `Please ensure the following documents are uploaded for active cases: Instruction Letter, School Report, Payslip, Summons, Medical Records. Cases: ${missingDocs.map(c => c.claimant_name).join(', ')}`,
        color: 'border-destructive/50 bg-destructive/5',
      });
    }

    return alerts;
  }, [accessData]);

  // Filtered cases
  const filteredCases = useMemo(() => {
    if (!accessData) return [];
    return accessData.cases.filter(c => {
      const matchesSearch =
        c.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.expert_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.matter_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const litStage = getLitigationStage(c);
      let matchesLitigation = true;
      if (litigationFilter === 'active') matchesLitigation = !isCaseClosed(c);
      if (litigationFilter === 'closed') matchesLitigation = isCaseClosed(c);
      if (litigationFilter === 'trial_ready') matchesLitigation = litStage === 'Trial Ready';
      if (litigationFilter === 'reports_outstanding') matchesLitigation = isReportOutstanding(c);
      if (litigationFilter === 'booking') matchesLitigation = litStage === 'Booking';

      return matchesSearch && matchesLitigation;
    });
  }, [accessData, searchTerm, litigationFilter]);

  const handleValidateCode = async (codeOverride?: string) => {
    const codeToUse = (codeOverride ?? accessCode).trim();
    if (!codeToUse) {
      toast.error('Please enter your access code');
      return;
    }
    setIsValidating(true);
    setError(null);
    setAccessData(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('validate-access-code', {
        body: { access_code: codeToUse },
      });
      if (fnError) throw new Error(fnError.message || 'Failed to validate access code');
      if (data?.error) {
        setError(data.error);
        toast.error(data.error);
        return;
      }
      setAccessData(data);
      toast.success(`Access granted — ${data.total_cases} case(s) found`);
    } catch (err: any) {
      const msg = err.message || 'Failed to validate access code';
      setError(msg);
      toast.error(msg);
    } finally {
      setIsValidating(false);
    }
  };

  // Wire the auto-validate ref so the URL-code effect can trigger validation
  React.useEffect(() => {
    autoValidateRef.current = (code: string) => { handleValidateCode(code); };
  });

  // Manual refresh only — attorneys use the Refresh button to re-fetch case data.

  const handleReset = () => {
    setAccessCode('');
    setAccessData(null);
    setError(null);
  };

  return (
    <>
      <Helmet>
        <title>Case Access Portal - Medico-Legal Pro</title>
        <meta name="description" content="Track your cases, download reports, and view financials securely" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        {/* Branded Header */}
        {accessData ? (
          <AttorneyBrandedHeader
            attorneyName={accessData.attorney.name}
            onTabChange={setActiveTab}
            activeTab={activeTab}
            showBackButton={false}
          />
        ) : (
          <header className="border-b bg-card sticky top-0 z-10">
            <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2 rounded-lg">
                  <Scale className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Medico-Legal Pro</h1>
                  <p className="text-xs text-muted-foreground">Secure Case Access Portal</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="h-3.5 w-3.5" />
                <span>Secure Access</span>
              </div>
            </div>
          </header>
        )}

        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* ── Code Entry View ── */}
          {!accessData && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md shadow-xl border-border/30">
                <CardHeader className="text-center space-y-3">
                  <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10">
                    <KeyRound className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Case Access Portal</CardTitle>
                  <CardDescription className="text-base">
                    Enter your secure access code to track cases, download reports, and view financials.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Enter your 12-character access code"
                    value={accessCode}
                    onChange={(e) => { setAccessCode(e.target.value); setError(null); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleValidateCode()}
                    className="text-center text-lg tracking-widest font-mono h-12"
                    maxLength={12}
                  />
                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <Button onClick={() => handleValidateCode()} disabled={isValidating || accessCode.trim().length === 0} className="w-full h-11 text-base">
                    {isValidating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating...</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-2" />Access My Cases</>
                    )}
                  </Button>
                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span>Your access code remains active until all reports are delivered and payments complete.</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ── Full Dashboard View ── */}
          {accessData && dashboardStats && (
            <div className="space-y-6">
              {/* Attorney Info Header */}
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Briefcase className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">{accessData.attorney.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          Code: {accessData.attorney.code}
                          {accessData.attorney.contact_person && ` • ${accessData.attorney.contact_person}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={handleReset} className="text-xs">
                        <Lock className="h-3 w-3 mr-1" /> Sign Out
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* ── Notification Alerts ── */}
              {notificationAlerts.length > 0 && (
                <div className="space-y-2">
                  {notificationAlerts.map((alert, idx) => (
                    <Alert key={idx} className={alert.color}>
                      {alert.icon}
                      <AlertTitle className="text-sm font-semibold">{alert.title}</AlertTitle>
                      <AlertDescription className="text-xs">{alert.message}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}

              {/* Tabbed Dashboard */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

                {/* Profile Tab */}
                <TabsContent value="profile">
                  <ProfileAttorneyDetails attorney={accessData.attorney} />
                </TabsContent>

                {/* ══════ Case Status Tab (Claimant-centric) ══════ */}
                <TabsContent value="case-status">
                  <CaseAccessClaimantView
                    cases={accessData.cases}
                    onOpenDocuments={(claimantName) => navigateToTabForClaimant('reports', claimantName)}
                  />
                </TabsContent>

                {/* ══════ Cases Tab ══════ */}
                <TabsContent value="cases">
                  {/* Dashboard Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
                    <Card className="border-border/50">
                      <CardContent className="py-4 text-center">
                        <Briefcase className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="text-2xl font-bold">{dashboardStats.totalActive}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Active Cases</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/50">
                      <CardContent className="py-4 text-center">
                        <Calendar className="h-5 w-5 text-info mx-auto mb-1" />
                        <p className="text-2xl font-bold text-info">{dashboardStats.inBooking}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Booking Stage</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/50">
                      <CardContent className="py-4 text-center">
                        <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
                        <p className="text-2xl font-bold text-warning">{dashboardStats.reportsOutstanding}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Reports Outstanding</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/50">
                      <CardContent className="py-4 text-center">
                        <Scale className="h-5 w-5 text-success mx-auto mb-1" />
                        <p className="text-2xl font-bold text-success">{dashboardStats.litigationReady}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Litigation Ready</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/50">
                      <CardContent className="py-4 text-center">
                        <Receipt className="h-5 w-5 text-destructive mx-auto mb-1" />
                        <p className="text-2xl font-bold text-destructive">{dashboardStats.outstandingInvoices}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Outstanding Invoices</p>
                      </CardContent>
                    </Card>
                    <Card className="border-border/50">
                      <CardContent className="py-4 text-center">
                        <CreditCard className="h-5 w-5 text-destructive mx-auto mb-1" />
                        <p className="text-xl font-bold text-destructive">R{dashboardStats.totalOutstandingAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">Amount Due</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Search & Filter Bar */}
                  <Card className="mb-4 border-border/50">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by case ref, claimant, expert type, or matter..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Select value={litigationFilter} onValueChange={setLitigationFilter}>
                          <SelectTrigger className="w-full md:w-[220px]">
                            <Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Filter Cases" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Cases</SelectItem>
                            <SelectItem value="active">Active Cases</SelectItem>
                            <SelectItem value="closed">Closed Cases</SelectItem>
                            <SelectItem value="reports_outstanding">Reports Outstanding</SelectItem>
                            <SelectItem value="trial_ready">Trial Ready</SelectItem>
                            <SelectItem value="booking">Booking Stage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cases Table */}
                  <Card className="border-border/50">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-4 w-4 text-primary" />
                        Case List ({filteredCases.length})
                      </CardTitle>
                      <CardDescription>Click a case to view full details — expert assessments, reports, and financials</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredCases.length === 0 ? (
                        <div className="text-center text-muted-foreground py-12">
                          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-40" />
                          <p className="font-medium">No cases match your filters</p>
                          <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
                        </div>
                      ) : (
                        <ScrollArea className="h-[500px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Case Ref</TableHead>
                                <TableHead>Claimant</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Litigation Stage</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredCases.map((c) => {
                                const litStage = getLitigationStage(c);
                                const progressPercent = getLitigationProgress(litStage);
                                return (
                                  <TableRow
                                    key={c.id}
                                    className="cursor-pointer hover:bg-muted/50"
                                    onClick={() => { setSelectedCase(c); setDetailDialogOpen(true); }}
                                  >
                                    <TableCell>
                                      <span className="font-mono text-xs text-muted-foreground">{c.id.slice(0, 8).toUpperCase()}</span>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <div>
                                          <span className="font-medium block">{c.claimant_name}</span>
                                          <span className="text-xs text-muted-foreground">{formatExpertType(c.expert_type)}</span>
                                        </div>
                                      </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(c.case_status, 'case')}</TableCell>
                                    <TableCell>{litigationBadge(litStage)}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Progress value={progressPercent} className="h-2 w-16" />
                                        <span className="text-xs text-muted-foreground">{progressPercent}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedCase(c); setDetailDialogOpen(true); }} title="View Details">
                                          <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => handleOpenReports(c)} title="Download Reports">
                                          <Download className="h-4 w-4 mr-1" />
                                          <span className="hidden sm:inline text-xs">Reports</span>
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Notifications Tab */}
                <TabsContent value="notifications">
                  {/* In-page notification alerts */}
                  {notificationAlerts.length > 0 && (
                    <div className="space-y-2 mb-6">
                      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                        <Bell className="h-4 w-4 text-primary" /> Active Alerts
                      </h3>
                      {notificationAlerts.map((alert, idx) => (
                        <Alert key={idx} className={alert.color}>
                          {alert.icon}
                          <AlertTitle className="text-sm font-semibold">{alert.title}</AlertTitle>
                          <AlertDescription className="text-xs">{alert.message}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  )}
                  <ProfileNotifications referringAttorneyId={accessData.attorney.id} readOnly />
                </TabsContent>

                {/* Request Appointment Tab — email-only */}
                <TabsContent value="request">
                  <ProfileRequestAppointment
                    referringAttorneyId={accessData.attorney.id}
                    attorneyName={accessData.attorney.name}
                    preselectedClaimantName={preselectedClaimant}
                    preselectedExpertType={preselectedExpertType}
                    accessCode={accessCode}
                  />
                </TabsContent>

                {/* Supporting Documents Tab — sourced from Document Vault */}
                <TabsContent value="documents">
                  <SupportingDocumentsView
                    accessCode={accessCode}
                    preselectedClaimantName={preselectedClaimant}
                  />
                </TabsContent>
              </Tabs>

              {/* Footer */}
              <div className="text-center pb-8 space-y-2">
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  <span>Data isolated per attorney • Secure document access • No public links</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  For any queries, please contact Medico-Legal Pro directly.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ══════ Case Detail Dialog ══════ */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Case Detail — {selectedCase?.claimant_name}
            </DialogTitle>
            <DialogDescription>
              Ref: {selectedCase?.id.slice(0, 8).toUpperCase()} • {formatExpertType(selectedCase?.expert_type || '')} • {selectedCase?.matter_type}
            </DialogDescription>
          </DialogHeader>

          {selectedCase && (
            <div className="space-y-6">
              {/* A. Case Overview */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> A. Case Overview
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-muted/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Claimant Name</p>
                    <p className="font-medium">{selectedCase.claimant_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expert Assigned / Expected</p>
                    <p className="font-medium">{selectedCase.expert_name || formatExpertType(selectedCase.expert_type)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Case Reference</p>
                    <p className="font-mono font-medium">{selectedCase.id.slice(0, 8).toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Appointment Date</p>
                    <p className="font-medium">
                      {selectedCase.appointment_date ? format(new Date(selectedCase.appointment_date), 'dd MMMM yyyy') : 'To be confirmed'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Matter Type</p>
                    <p className="font-medium capitalize">{selectedCase.matter_type?.replace(/_/g, ' ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Litigation Stage</p>
                    {litigationBadge(getLitigationStage(selectedCase))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* B. Expert Assessment */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" /> B. Expert Assessment
                </h3>
                <Table>
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
                      <TableCell>{formatExpertType(selectedCase.expert_type)}</TableCell>
                      <TableCell>{selectedCase.claimant_name}</TableCell>
                      <TableCell>
                        {selectedCase.appointment_date ? format(new Date(selectedCase.appointment_date), 'dd MMM yyyy') : 'TBC'}
                      </TableCell>
                      <TableCell>{assessedBadge(getAssessedStatus(selectedCase))}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* C. Reports Section */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> C. Reports
                </h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Expert Type</TableHead>
                      <TableHead>Claimant</TableHead>
                      <TableHead>Report Status</TableHead>
                      <TableHead>Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>{formatExpertType(selectedCase.expert_type)}</TableCell>
                      <TableCell>{selectedCase.claimant_name}</TableCell>
                      <TableCell>{getStatusBadge(selectedCase.report_status, 'report')}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {selectedCase.report_submitted_date
                          ? format(new Date(selectedCase.report_submitted_date), 'dd MMM yyyy')
                          : '—'}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
                <p className="text-xs text-muted-foreground mt-2">
                  Reports are uploaded to the Document Vault and appear in the Supporting Documents tab.
                </p>
              </div>

              <Separator />

              {/* Litigation Progress Timeline */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> D. Litigation Progress
                </h3>
                {(() => {
                  const stages = ['Booking', 'Scheduled', 'Assessed', 'Report Complete', 'Trial Ready'];
                  const currentStage = getLitigationStage(selectedCase);
                  const currentIdx = stages.indexOf(currentStage);
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-5 gap-2">
                        {stages.map((stage, idx) => (
                          <div
                            key={stage}
                            className={`p-3 rounded-lg text-center text-xs border transition-all ${
                              idx < currentIdx
                                ? 'bg-success/10 border-success/20 text-success'
                                : idx === currentIdx
                                ? 'bg-primary/10 border-primary/20 text-primary ring-2 ring-primary/20'
                                : 'bg-muted/30 border-border/50 text-muted-foreground'
                            }`}
                          >
                            <div className="font-medium">{stage}</div>
                            {idx < currentIdx && <CheckCircle2 className="h-3.5 w-3.5 mx-auto mt-1" />}
                            {idx === currentIdx && <div className="h-2 w-2 rounded-full bg-primary mx-auto mt-1 animate-pulse" />}
                          </div>
                        ))}
                      </div>
                      <Progress value={getLitigationProgress(currentStage)} className="h-2.5" />
                    </div>
                  );
                })()}
              </div>

              <Separator />

              {/* Actions Allowed — appointment requests only (Finance & Reports excluded) */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setDetailDialogOpen(false);
                    navigateToTabForClaimant('request', selectedCase.claimant_name, '');
                  }}>
                    <CalendarPlus className="h-4 w-4 mr-1" /> Request Appointment
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setDetailDialogOpen(false);
                    navigateToTabForClaimant('request', selectedCase.claimant_name, 'Addendum (Post-Report)');
                  }}>
                    <FileSignature className="h-4 w-4 mr-1" /> Request Addendum
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setDetailDialogOpen(false);
                    navigateToTabForClaimant('request', selectedCase.claimant_name, 'Affidavits');
                  }}>
                    <Stamp className="h-4 w-4 mr-1" /> Request Affidavit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => {
                    setDetailDialogOpen(false);
                    navigateToTabForClaimant('documents');
                  }}>
                    <FolderOpen className="h-4 w-4 mr-1" /> View Supporting Documents
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════ Reports Download Dialog ══════ */}
      <Dialog open={reportsDialogOpen} onOpenChange={setReportsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5 text-primary" />
              Reports — {reportsCase?.claimant_name}
            </DialogTitle>
            <DialogDescription>
              Reports linked to this scheduled assessment appointment (past, current and future uploads).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {reportsLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading reports...
              </div>
            ) : appointmentReports.length === 0 ? (
              <div className="text-center text-muted-foreground py-12">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No reports available yet</p>
                <p className="text-xs mt-1">Reports will appear here as they are uploaded against this appointment.</p>
              </div>
            ) : (
              appointmentReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <FileText className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{r.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.document_type}
                        {r.upload_date && ` • ${format(new Date(r.upload_date), 'dd MMM yyyy')}`}
                        {r.file_size ? ` • ${(r.file_size / 1024).toFixed(0)} KB` : ''}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleDownloadReport(r.signed_url, r.file_name)}
                    disabled={!r.signed_url}
                  >
                    <Download className="h-4 w-4 mr-1" /> Download
                  </Button>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CaseAccess;
