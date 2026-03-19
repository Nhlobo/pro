import React, { useState, useMemo } from 'react';
import { LitigationTrialServices } from '@/components/attorney-portal/LitigationTrialServices';
import TrialPrepDashboard from '@/components/attorney-portal/trial-prep/TrialPrepDashboard';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, KeyRound, ArrowLeft, Briefcase, Calendar, FileText,
  CreditCard, Clock, AlertCircle, CheckCircle2, XCircle, Loader2,
  Building2, Bell, CalendarPlus, User, Mail, Phone, Upload, Download, ExternalLink,
  FileSignature, BookMarked, Stamp, Scale, Search, Filter, Eye, TrendingUp,
  Stethoscope, AlertTriangle
} from 'lucide-react';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { format } from 'date-fns';
import AttorneyBrandedHeader from '@/components/attorney-portal/AttorneyBrandedHeader';
import ProfileNotifications from '@/components/attorney-profile/ProfileNotifications';
import ProfileAODPayments from '@/components/attorney-profile/ProfileAODPayments';
import ProfileReportsDocuments from '@/components/attorney-profile/ProfileReportsDocuments';
import ProfileRequestAppointment from '@/components/attorney-profile/ProfileRequestAppointment';
import ProfileClaimantDocuments from '@/components/attorney-profile/ProfileClaimantDocuments';
import ProfileAttorneyDetails from '@/components/attorney-profile/ProfileAttorneyDetails';

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

// Derive litigation stage from flat case data
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
    if (normalized === 'completed' || normalized === 'done') return <Badge className="bg-secondary text-secondary-foreground">{status}</Badge>;
    if (normalized === 'in_progress' || normalized === 'in progress') return <Badge className="bg-warning/80 text-foreground">{status}</Badge>;
    if (normalized === 'cancelled') return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="secondary">{status}</Badge>;
  }

  if (type === 'payment') {
    if (normalized === 'paid') return <Badge className="bg-secondary text-secondary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    if (normalized === 'partial') return <Badge className="bg-warning/80 text-foreground">{status}</Badge>;
    if (normalized === 'overdue') return <Badge variant="destructive">{status}</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }

  if (type === 'report') {
    if (normalized === 'completed' || normalized === 'taken_out' || normalized === 'taken out') return <Badge className="bg-secondary text-secondary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    if (normalized === 'in_progress' || normalized === 'in progress') return <Badge className="bg-warning/80 text-foreground">{status}</Badge>;
    if (normalized === 'overdue') return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  }

  return <Badge variant="secondary">{status}</Badge>;
};

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
  const [statusFilter, setStatusFilter] = useState('all');
  const [litigationFilter, setLitigationFilter] = useState('all');

  // Case detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);

  const navigateToTabForClaimant = (tab: string, claimantName?: string, expertType?: string) => {
    if (claimantName) setPreselectedClaimant(claimantName);
    if (expertType !== undefined) setPreselectedExpertType(expertType);
    setActiveTab(tab);
  };

  // Filtered cases
  const filteredCases = useMemo(() => {
    if (!accessData) return [];
    return accessData.cases.filter(c => {
      const matchesSearch =
        c.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.expert_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.matter_type?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || c.case_status?.toLowerCase() === statusFilter;
      
      const litStage = getLitigationStage(c);
      let matchesLitigation = true;
      if (litigationFilter === 'trial_ready') matchesLitigation = litStage === 'Trial Ready';
      if (litigationFilter === 'reports_outstanding') matchesLitigation = litStage !== 'Report Complete' && litStage !== 'Trial Ready';
      if (litigationFilter === 'active') matchesLitigation = litStage !== 'Trial Ready';
      if (litigationFilter === 'report_complete') matchesLitigation = litStage === 'Report Complete';

      return matchesSearch && matchesStatus && matchesLitigation;
    });
  }, [accessData, searchTerm, statusFilter, litigationFilter]);

  const handleValidateCode = async () => {
    if (!accessCode.trim()) {
      toast.error('Please enter your access code');
      return;
    }

    setIsValidating(true);
    setError(null);
    setAccessData(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('validate-access-code', {
        body: { access_code: accessCode.trim() },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to validate access code');
      }

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

  const handleReset = () => {
    setAccessCode('');
    setAccessData(null);
    setError(null);
  };

  return (
    <>
      <Helmet>
        <title>Case Access - Medico-Legal Pro</title>
        <meta name="description" content="Access your case status using your secure access code" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        {/* Branded Header - shown when access is granted */}
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
                  <p className="text-xs text-muted-foreground">Medico-Legal Services</p>
                </div>
              </div>
            </div>
          </header>
        )}

        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Code Entry View */}
          {!accessData && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md shadow-xl border-border/30">
                <CardHeader className="text-center space-y-3">
                  <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10">
                    <KeyRound className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Case Access Portal</CardTitle>
                  <CardDescription className="text-base">
                    Enter your secure access code to view your case status. The code was sent to you via email when your appointment was confirmed.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Input
                      placeholder="Enter your 12-character access code"
                      value={accessCode}
                      onChange={(e) => {
                        setAccessCode(e.target.value);
                        setError(null);
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleValidateCode()}
                      className="text-center text-lg tracking-widest font-mono h-12"
                      maxLength={12}
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleValidateCode}
                    disabled={isValidating || accessCode.trim().length === 0}
                    className="w-full h-11 text-base"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        <Shield className="h-4 w-4 mr-2" />
                        Access My Cases
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Your access code remains active until your case is paid in full and the report has been delivered.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Full Dashboard View */}
          {accessData && (
            <div className="space-y-6">
              {/* Attorney Header */}
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
                    <Badge variant="outline" className="text-sm px-3 py-1">
                      {accessData.total_cases} Case{accessData.total_cases !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Tabbed Dashboard - no visible tab list, controlled by header nav */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">

                {/* Profile Tab */}
                <TabsContent value="profile">
                  <ProfileAttorneyDetails attorney={accessData.attorney} />
                </TabsContent>

                {/* Cases Tab */}
                <TabsContent value="cases">
                  {/* Summary Stats - Enhanced */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
                    <Card>
                      <CardContent className="py-4 text-center">
                        <Calendar className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="text-2xl font-bold">{accessData.total_cases}</p>
                        <p className="text-xs text-muted-foreground">Total Cases</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <Scale className="h-5 w-5 text-success mx-auto mb-1" />
                        <p className="text-2xl font-bold text-success">
                          {accessData.cases.filter(c => getLitigationStage(c) === 'Trial Ready').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Trial Ready</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <FileText className="h-5 w-5 text-primary mx-auto mb-1" />
                        <p className="text-2xl font-bold text-primary">
                          {accessData.cases.filter(c => ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Reports Ready</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <AlertTriangle className="h-5 w-5 text-warning mx-auto mb-1" />
                        <p className="text-2xl font-bold text-warning">
                          {accessData.cases.filter(c => !['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())).length}
                        </p>
                        <p className="text-xs text-muted-foreground">Reports Outstanding</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="py-4 text-center">
                        <CreditCard className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                        <p className="text-2xl font-bold">
                          {accessData.cases.filter(c => c.payment_status?.toLowerCase() !== 'paid').length}
                        </p>
                        <p className="text-xs text-muted-foreground">Pending Payment</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Search & Filter Bar */}
                  <Card className="mb-4">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by claimant, expert type, or matter..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="w-full md:w-[180px]">
                            <Filter className="h-4 w-4 mr-2" /><SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="scheduled">Scheduled</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select value={litigationFilter} onValueChange={setLitigationFilter}>
                          <SelectTrigger className="w-full md:w-[200px]">
                            <Scale className="h-4 w-4 mr-2" /><SelectValue placeholder="Litigation" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Stages</SelectItem>
                            <SelectItem value="active">Active Cases</SelectItem>
                            <SelectItem value="trial_ready">Trial Ready</SelectItem>
                            <SelectItem value="report_complete">Report Complete</SelectItem>
                            <SelectItem value="reports_outstanding">Reports Outstanding</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Cases Table - Enhanced */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Briefcase className="h-4 w-4" />
                        Case List ({filteredCases.length})
                      </CardTitle>
                      <CardDescription>Click a case row to view full details including financials and litigation progress</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {filteredCases.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                          <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No cases match your filters</p>
                        </div>
                      ) : (
                        <ScrollArea className="h-[500px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Claimant</TableHead>
                                <TableHead>Expert Type</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Litigation Stage</TableHead>
                                <TableHead>Progress</TableHead>
                                <TableHead>Payment</TableHead>
                                <TableHead>Report</TableHead>
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
                                      <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-medium">{c.claimant_name}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>{formatExpertType(c.expert_type)}</TableCell>
                                    <TableCell className="whitespace-nowrap">
                                      {c.appointment_date ? format(new Date(c.appointment_date), 'dd MMM yyyy') : 'N/A'}
                                    </TableCell>
                                    <TableCell>{litigationBadge(litStage)}</TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-2">
                                        <Progress value={progressPercent} className="h-2 w-16" />
                                        <span className="text-xs text-muted-foreground">{progressPercent}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(c.payment_status, 'payment')}</TableCell>
                                    <TableCell>{getStatusBadge(c.report_status, 'report')}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                        <button
                                          onClick={() => { setSelectedCase(c); setDetailDialogOpen(true); }}
                                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/60 transition-colors"
                                          title="View Details"
                                        >
                                          <Eye className="h-3 w-3" /> View
                                        </button>
                                        <button
                                          onClick={() => navigateToTabForClaimant('documents', c.claimant_name)}
                                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                                          title="Upload / View Documents"
                                        >
                                          <Upload className="h-3 w-3" /> Docs
                                        </button>
                                        {['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase()) && (
                                          <button
                                            onClick={() => navigateToTabForClaimant('reports', c.claimant_name)}
                                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-secondary/30 text-secondary hover:bg-secondary/10 transition-colors"
                                            title="Download Medico-Report"
                                          >
                                            <Download className="h-3 w-3" /> Report
                                          </button>
                                        )}
                                        <button
                                          onClick={() => navigateToTabForClaimant('request', c.claimant_name, '')}
                                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:bg-muted/60 transition-colors"
                                          title="New Appointment Request"
                                        >
                                          <CalendarPlus className="h-3 w-3" /> Request
                                        </button>
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
                  <ProfileNotifications referringAttorneyId={accessData.attorney.id} readOnly />
                </TabsContent>

                {/* Reports Tab */}
                 <TabsContent value="reports">
                   <ProfileReportsDocuments
                      referringAttorneyId={accessData.attorney.id}
                      preselectedClaimant={preselectedClaimant}
                      cases={accessData.cases.map(c => ({
                        id: c.id,
                        claimant_name: c.claimant_name,
                        expert_type: c.expert_type,
                        appointment_date: c.appointment_date,
                        report_status: c.report_status,
                        report_submitted_date: c.report_submitted_date,
                        service_fee: c.service_fee,
                        deposit_amount: c.deposit_amount,
                      }))}
                    />
                 </TabsContent>

                 {/* AOD & Payments Tab */}
                 <TabsContent value="aod-payments">
                   <ProfileAODPayments referringAttorneyId={accessData.attorney.id} cases={accessData.cases.map(c => ({
                     claimant_name: c.claimant_name,
                     service_fee: c.service_fee,
                     deposit_amount: c.deposit_amount,
                     expert_type: c.expert_type,
                     appointment_date: c.appointment_date,
                     payment_status: c.payment_status,
                   }))} />
                 </TabsContent>

                 {/* Request Appointment Tab */}
                 <TabsContent value="request">
                   <ProfileRequestAppointment
                      referringAttorneyId={accessData.attorney.id}
                      attorneyName={accessData.attorney.name}
                      preselectedClaimantName={preselectedClaimant}
                      preselectedExpertType={preselectedExpertType}
                    />
                 </TabsContent>

                 {/* Documents Tab */}
                 <TabsContent value="documents">
                   <ProfileClaimantDocuments referringAttorneyId={accessData.attorney.id} preselectedClaimantName={preselectedClaimant} />
                 </TabsContent>

                 {/* Litigation & Trial Prep Tab */}
                 <TabsContent value="litigation">
                   <TrialPrepDashboard liveCases={accessData.cases.map(c => ({
                     id: c.id,
                     claimant_name: c.claimant_name,
                     expert_type: c.expert_type,
                     appointment_date: c.appointment_date,
                     case_status: c.case_status,
                   }))} />
                 </TabsContent>
              </Tabs>

              {/* Footer Note */}
              <p className="text-xs text-muted-foreground text-center pb-8">
                For any queries, please contact Medico-Legal Pro directly.
                Your access code will expire once payment is complete and the report has been delivered.
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Case Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-primary" />
              Case Detail — {selectedCase?.claimant_name}
            </DialogTitle>
            <DialogDescription>
              {formatExpertType(selectedCase?.expert_type || '')} • {selectedCase?.matter_type}
            </DialogDescription>
          </DialogHeader>

          {selectedCase && (
            <div className="space-y-6">
              {/* Case Overview */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" /> Case Overview
                </h3>
                <div className="grid grid-cols-2 gap-3 bg-muted/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Claimant</p>
                    <p className="font-medium">{selectedCase.claimant_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Expert Assigned</p>
                    <p className="font-medium">{selectedCase.expert_name || formatExpertType(selectedCase.expert_type)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Appointment Date</p>
                    <p className="font-medium">
                      {selectedCase.appointment_date ? format(new Date(selectedCase.appointment_date), 'dd MMMM yyyy') : 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Matter Type</p>
                    <p className="font-medium capitalize">{selectedCase.matter_type?.replace(/_/g, ' ') || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Case Status</p>
                    {getStatusBadge(selectedCase.case_status, 'case')}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Litigation Stage</p>
                    {litigationBadge(getLitigationStage(selectedCase))}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Litigation Progress Timeline */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Litigation Progress
                </h3>
                {(() => {
                  const stages = ['Booking', 'Scheduled', 'Assessed', 'Report Complete', 'Trial Ready'];
                  const currentStage = getLitigationStage(selectedCase);
                  const currentIdx = stages.indexOf(currentStage);
                  return (
                    <div className="grid grid-cols-5 gap-2">
                      {stages.map((stage, idx) => (
                        <div
                          key={stage}
                          className={`p-3 rounded-lg text-center text-xs border ${
                            idx < currentIdx
                              ? 'bg-success/10 border-success/20 text-success'
                              : idx === currentIdx
                              ? 'bg-primary/10 border-primary/20 text-primary'
                              : 'bg-muted/30 border-border/50 text-muted-foreground'
                          }`}
                        >
                          <div className="font-medium">{stage}</div>
                          {idx < currentIdx && (
                            <CheckCircle2 className="h-3 w-3 mx-auto mt-1" />
                          )}
                          {idx === currentIdx && (
                            <div className="h-1.5 w-1.5 rounded-full bg-primary mx-auto mt-1 animate-pulse" />
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
                <div className="mt-3">
                  <Progress value={getLitigationProgress(getLitigationStage(selectedCase))} className="h-2" />
                </div>
              </div>

              <Separator />

              {/* Report Status */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Report Status
                </h3>
                <div className="grid grid-cols-2 gap-3 bg-muted/30 rounded-lg p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Report Status</p>
                    {getStatusBadge(selectedCase.report_status, 'report')}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Submitted Date</p>
                    <p className="font-medium">
                      {selectedCase.report_submitted_date
                        ? format(new Date(selectedCase.report_submitted_date), 'dd MMM yyyy')
                        : 'Not yet submitted'}
                    </p>
                  </div>
                </div>
                {['completed', 'taken_out', 'taken out'].includes(selectedCase.report_status?.toLowerCase()) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3"
                    onClick={() => {
                      setDetailDialogOpen(false);
                      navigateToTabForClaimant('reports', selectedCase.claimant_name);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" /> Download Report
                  </Button>
                )}
              </div>

              <Separator />

              {/* Financial Summary */}
              <div>
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary" /> Financial Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Service Fee</p>
                    <p className="text-lg font-bold">R{(selectedCase.service_fee || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10 text-center">
                    <p className="text-xs text-muted-foreground">Deposit</p>
                    <p className="text-lg font-bold text-success">R{(selectedCase.deposit_amount || 0).toLocaleString()}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10 text-center">
                    <p className="text-xs text-muted-foreground">Amount Due</p>
                    <p className="text-lg font-bold text-destructive">
                      R{((selectedCase.service_fee || 0) - (selectedCase.deposit_amount || 0)).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Payment Status</p>
                    {getStatusBadge(selectedCase.payment_status, 'payment')}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button size="sm" variant="outline" onClick={() => {
                  setDetailDialogOpen(false);
                  navigateToTabForClaimant('documents', selectedCase.claimant_name);
                }}>
                  <Upload className="h-4 w-4 mr-1" /> View/Upload Docs
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setDetailDialogOpen(false);
                  navigateToTabForClaimant('request', selectedCase.claimant_name, '');
                }}>
                  <CalendarPlus className="h-4 w-4 mr-1" /> New Request
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  setDetailDialogOpen(false);
                  navigateToTabForClaimant('request', selectedCase.claimant_name, 'Full Medico-Legal Report');
                }}>
                  <BookMarked className="h-4 w-4 mr-1" /> Request Medico-Report
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CaseAccess;
