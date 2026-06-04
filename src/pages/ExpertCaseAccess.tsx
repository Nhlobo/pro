import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield,
  KeyRound,
  Calendar,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Stethoscope,
  Lock,
  Search,
  User,
  Briefcase,
  AlertTriangle,
  Eye,
  ArrowLeft,
  MapPin,
  Building2,
  TrendingUp,
  Upload,
  FileDown,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  File,
  FileImage,
  Paperclip
} from "lucide-react";
import { formatExpertType } from '@/utils/expertTypeMapping';
import { format, differenceInDays, parseISO } from 'date-fns';

interface DocumentData {
  id: string;
  file_name: string;
  document_type: string;
  file_size: number | null;
  file_type: string | null;
  upload_date: string;
}

interface CaseData {
  id: string;
  claimant_name: string;
  claimant_contact: string | null;
  appointment_date: string;
  case_status: string;
  payment_status: string;
  matter_type: string;
  attorney_name: string;
  attorney_contact_person: string | null;
  attorney_email: string | null;
  attorney_phone: string | null;
  report_status: string;
  report_submitted_date: string | null;
  report_due_date: string | null;
  service_fee: number | null;
  deposit_amount: number | null;
  location?: string | null;
  documents: DocumentData[];
}

interface ExpertInfo {
  id: string;
  name: string;
  expert_type: string;
  practice_name?: string;
  province?: string;
}

interface AccessResponse {
  expert: ExpertInfo;
  cases: CaseData[];
  total_cases: number;
  message?: string;
}

const getReportBadge = (status: string) => {
  const s = status?.toLowerCase() || 'pending';
  if (['completed', 'taken_out', 'taken out'].includes(s))
    return <Badge className="bg-success/10 text-success border-success/20"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
  if (['in_progress', 'in progress'].includes(s))
    return <Badge className="bg-warning/10 text-warning border-warning/20"><Clock className="h-3 w-3 mr-1" />{status}</Badge>;
  if (s === 'overdue')
    return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />{status}</Badge>;
  return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{status || 'Pending'}</Badge>;
};

const getCaseBadge = (status: string) => {
  const s = status?.toLowerCase() || 'scheduled';
  if (['completed', 'done', 'assessed', 'report submitted'].includes(s))
    return <Badge className="bg-success/10 text-success border-success/20">{status}</Badge>;
  if (['scheduled', 'confirmed'].includes(s))
    return <Badge className="bg-primary/10 text-primary border-primary/20">{status}</Badge>;
  if (s === 'cancelled' || s.includes('declined'))
    return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="secondary">{status || 'Scheduled'}</Badge>;
};

const getDocIcon = (docType: string) => {
  const t = docType?.toLowerCase() || '';
  if (t.includes('medical') || t.includes('record')) return <FileText className="h-4 w-4 text-primary" />;
  if (t.includes('instruction') || t.includes('letter')) return <File className="h-4 w-4 text-warning" />;
  if (t.includes('report')) return <FileDown className="h-4 w-4 text-success" />;
  if (t.includes('image') || t.includes('scan') || t.includes('xray')) return <FileImage className="h-4 w-4 text-muted-foreground" />;
  return <Paperclip className="h-4 w-4 text-muted-foreground" />;
};

const categorizeDocuments = (docs: DocumentData[]) => {
  const categories: Record<string, DocumentData[]> = {
    'Medical Records': [],
    'Instruction Letters': [],
    'Previous Reports': [],
    'Supporting Documentation': [],
  };
  docs.forEach(d => {
    const t = d.document_type?.toLowerCase() || '';
    if (t.includes('medical') || t.includes('record') || t.includes('history')) {
      categories['Medical Records'].push(d);
    } else if (t.includes('instruction') || t.includes('letter') || t.includes('mandate')) {
      categories['Instruction Letters'].push(d);
    } else if (t.includes('report') || t.includes('assessment')) {
      categories['Previous Reports'].push(d);
    } else {
      categories['Supporting Documentation'].push(d);
    }
  });
  return categories;
};

const ExpertCaseAccess: React.FC = () => {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [accessData, setAccessData] = useState<AccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [expertNotes, setExpertNotes] = useState('');
  const [isSubmittingAction, setIsSubmittingAction] = useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAccessCode(code);
      // Strip the access code from the URL for security — keep it out of history/bookmarks
      try {
        const cleanUrl = window.location.pathname + window.location.hash;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {
        // no-op
      }
    }
  }, []);

  const filteredCases = useMemo(() => {
    if (!accessData) return [];
    return accessData.cases.filter(c => {
      const matchSearch = c.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.matter_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.attorney_name?.toLowerCase().includes(searchTerm.toLowerCase());

      if (activeTab === 'upcoming') return matchSearch && new Date(c.appointment_date) > new Date();
      if (activeTab === 'pending') return matchSearch && !['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase());
      if (activeTab === 'overdue') {
        if (!c.report_due_date || ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())) return false;
        return matchSearch && differenceInDays(parseISO(c.report_due_date), new Date()) < 0;
      }
      if (activeTab === 'completed') return matchSearch && ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase());
      return matchSearch;
    });
  }, [accessData, searchTerm, activeTab]);

  const stats = useMemo(() => {
    if (!accessData) return null;
    const cases = accessData.cases;
    const now = new Date();
    return {
      total: cases.length,
      upcoming: cases.filter(c => new Date(c.appointment_date) > now).length,
      pending: cases.filter(c => !['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())).length,
      overdue: cases.filter(c => {
        if (!c.report_due_date || ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())) return false;
        return differenceInDays(parseISO(c.report_due_date), now) < 0;
      }).length,
      completed: cases.filter(c => ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())).length,
    };
  }, [accessData]);

  const handleValidateCode = async () => {
    if (!accessCode.trim()) {
      toast.error('Please enter your access code');
      return;
    }
    setIsValidating(true);
    setError(null);
    setAccessData(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('validate-expert-access-code', {
        body: { access_code: accessCode.trim() },
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

  const handleAction = async (action: string, appointmentId: string, extra?: Record<string, string>) => {
    setIsSubmittingAction(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('validate-expert-access-code', {
        body: { access_code: accessCode.trim(), action, appointment_id: appointmentId, ...extra },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      toast.success(data.message || 'Action completed');

      // Refresh data
      const { data: refreshed } = await supabase.functions.invoke('validate-expert-access-code', {
        body: { access_code: accessCode.trim() },
      });
      if (refreshed && !refreshed.error) {
        setAccessData(refreshed);
        if (selectedCase) {
          const updated = refreshed.cases.find((c: CaseData) => c.id === selectedCase.id);
          if (updated) setSelectedCase(updated);
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setIsSubmittingAction(false);
      setShowDeclineDialog(false);
      setDeclineReason('');
      setExpertNotes('');
    }
  };

  const getUrgencyIndicator = (c: CaseData) => {
    if (!c.report_due_date || ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())) return null;
    const days = differenceInDays(parseISO(c.report_due_date), new Date());
    if (days < 0) return <Badge className="bg-destructive text-destructive-foreground text-[9px]">Overdue {Math.abs(days)}d</Badge>;
    if (days <= 3) return <Badge className="bg-destructive/80 text-destructive-foreground text-[9px]">Critical {days}d</Badge>;
    if (days <= 7) return <Badge className="bg-warning text-warning-foreground text-[9px]">Urgent {days}d</Badge>;
    return <Badge className="bg-success/20 text-success text-[9px]">{days}d left</Badge>;
  };

  const canAcceptDecline = (c: CaseData) => {
    const s = c.case_status?.toLowerCase();
    return s === 'scheduled' && new Date(c.appointment_date) > new Date();
  };

  return (
    <>
      <Helmet>
        <title>Expert Case Access Portal - Medico-Legal Pro</title>
        <meta name="description" content="Medical experts: view your assigned cases, report deadlines and appointment details" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Stethoscope className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-foreground">Medico-Legal Pro</h1>
                <p className="text-xs text-muted-foreground">Expert Case Access Portal</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              <span>Secure Access</span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* ============ CODE ENTRY ============ */}
          {!accessData && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md shadow-xl border-border/30">
                <CardHeader className="text-center space-y-3">
                  <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10">
                    <KeyRound className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Expert Case Access</CardTitle>
                  <CardDescription className="text-base">
                    Enter your secure access code to view assigned cases, upload reports, and manage appointments.
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
                  <Button onClick={handleValidateCode} disabled={isValidating || accessCode.trim().length === 0} className="w-full h-11 text-base">
                    {isValidating ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating...</>
                    ) : (
                      <><Shield className="h-4 w-4 mr-2" />Access My Cases</>
                    )}
                  </Button>
                  <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground">
                    <Lock className="h-3 w-3" />
                    <span>Your code is valid for 1 year or until the matter is closed.</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ============ DASHBOARD ============ */}
          {accessData && stats && !selectedCase && (
            <div className="space-y-6">
              {/* Expert Header */}
              <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-secondary/5">
                <CardContent className="py-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Stethoscope className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-foreground">{accessData.expert.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {formatExpertType(accessData.expert.expert_type)}
                          {accessData.expert.practice_name && ` • ${accessData.expert.practice_name}`}
                        </p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => { setAccessData(null); setAccessCode(''); setSelectedCase(null); }}>
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Upcoming Appointments', value: stats.upcoming, icon: Calendar, color: 'text-primary', bg: 'bg-primary/5' },
                  { label: 'Reports Pending', value: stats.pending, icon: Clock, color: 'text-warning', bg: 'bg-warning/5' },
                  { label: 'Overdue Reports', value: stats.overdue, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/5' },
                  { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-success', bg: 'bg-success/5' },
                  { label: 'Total Cases', value: stats.total, icon: Briefcase, color: 'text-primary', bg: 'bg-primary/5' },
                ].map(s => (
                  <Card key={s.label} className={`${s.bg} border-border/40`}>
                    <CardContent className="py-4 px-4 flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${s.bg}`}>
                        <s.icon className={`h-5 w-5 ${s.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-foreground">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Overdue Alert */}
              {stats.overdue > 0 && (
                <Card className="border-destructive/30 bg-destructive/5">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center gap-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        You have {stats.overdue} overdue report(s). Please prioritize submission to avoid delays.
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Appointment List with Tabs */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-lg">Assigned Cases</CardTitle>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search claimant, attorney..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9"
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
                    <TabsList className="grid grid-cols-5 w-full">
                      <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                      <TabsTrigger value="upcoming">Upcoming ({stats.upcoming})</TabsTrigger>
                      <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                      <TabsTrigger value="overdue" className={stats.overdue > 0 ? 'text-destructive' : ''}>Overdue ({stats.overdue})</TabsTrigger>
                      <TabsTrigger value="completed">Done ({stats.completed})</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <ScrollArea className="max-h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Claimant</TableHead>
                          <TableHead>Appointment Date</TableHead>
                          <TableHead>Matter Type</TableHead>
                          <TableHead>Referring Attorney</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Report</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead>Docs</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                              No cases found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCases.map((c) => (
                            <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelectedCase(c)}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                                  {c.claimant_name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                  {(() => {
                                    try { return format(new Date(c.appointment_date), 'dd MMM yyyy'); }
                                    catch { return c.appointment_date; }
                                  })()}
                                </div>
                              </TableCell>
                              <TableCell>{c.matter_type}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                                  {c.attorney_name}
                                </div>
                              </TableCell>
                              <TableCell>{getCaseBadge(c.case_status)}</TableCell>
                              <TableCell>{getReportBadge(c.report_status)}</TableCell>
                              <TableCell>{getUrgencyIndicator(c)}</TableCell>
                              <TableCell>
                                {c.documents?.length > 0 && (
                                  <Badge variant="outline" className="text-[10px]">
                                    <FileText className="h-3 w-3 mr-1" />{c.documents.length}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                <Button variant="ghost" size="sm" className="text-xs">
                                  <Eye className="h-3 w-3 mr-1" /> View
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground py-4">
                <p>Kutlwano & Associates (Pty) Ltd | Medico-Legal Service</p>
                <p className="italic">"We touch a file, We change a life, We are Kutlwano and Associate"</p>
              </div>
            </div>
          )}

          {/* ============ CASE DETAIL VIEW ============ */}
          {accessData && selectedCase && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setSelectedCase(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-foreground">{selectedCase.claimant_name}</h2>
                  <p className="text-sm text-muted-foreground">{selectedCase.matter_type || 'General Assessment'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getCaseBadge(selectedCase.case_status)}
                  {getReportBadge(selectedCase.report_status)}
                </div>
              </div>

              {/* Accept / Decline Actions */}
              {canAcceptDecline(selectedCase) && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">New Appointment — Action Required</p>
                        <p className="text-xs text-muted-foreground">Please confirm or decline this appointment</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-success hover:bg-success/90 text-success-foreground"
                          disabled={isSubmittingAction}
                          onClick={() => handleAction('accept_appointment', selectedCase.id)}
                        >
                          {isSubmittingAction ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <ThumbsUp className="h-4 w-4 mr-1" />}
                          Accept
                        </Button>
                        <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="destructive">
                              <ThumbsDown className="h-4 w-4 mr-1" /> Decline
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Decline Appointment</DialogTitle>
                              <DialogDescription>Please provide a reason for declining this appointment.</DialogDescription>
                            </DialogHeader>
                            <Textarea
                              placeholder="Reason for declining (e.g., scheduling conflict, not within my expertise)..."
                              value={declineReason}
                              onChange={(e) => setDeclineReason(e.target.value)}
                              className="min-h-[100px]"
                            />
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setShowDeclineDialog(false)}>Cancel</Button>
                              <Button
                                variant="destructive"
                                disabled={isSubmittingAction || !declineReason.trim()}
                                onClick={() => handleAction('decline_appointment', selectedCase.id, { decline_reason: declineReason })}
                              >
                                {isSubmittingAction ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                Confirm Decline
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* A. Claimant Information */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> A. Claimant Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Name of Claimant</span>
                        <p className="font-medium text-foreground">{selectedCase.claimant_name}</p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Matter Type</span>
                        <p className="font-medium text-foreground">{selectedCase.matter_type || 'General'}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Referring Attorney</span>
                        <p className="font-medium text-foreground">{selectedCase.attorney_name}</p>
                        {selectedCase.attorney_contact_person && (
                          <p className="text-xs text-muted-foreground">Contact: {selectedCase.attorney_contact_person}</p>
                        )}
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">Referred by</span>
                        <p className="font-medium text-foreground">Kutlwano & Associates</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-xs text-muted-foreground">Appointment Date</span>
                        <p className="font-medium text-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {(() => {
                            try { return format(new Date(selectedCase.appointment_date), 'dd MMMM yyyy, HH:mm'); }
                            catch { return selectedCase.appointment_date; }
                          })()}
                        </p>
                      </div>
                      {selectedCase.location && (
                        <div>
                          <span className="text-xs text-muted-foreground">Location</span>
                          <p className="text-foreground text-xs flex items-center gap-1">
                            <Building2 className="h-3 w-3" />{selectedCase.location}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* D. Report Status Tracking */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-warning" /> D. Report Status Tracking
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Case Status</span>
                      {getCaseBadge(selectedCase.case_status)}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Report Status</span>
                      {getReportBadge(selectedCase.report_status)}
                    </div>
                    {selectedCase.report_due_date && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Due Date</span>
                          <span className="font-medium text-foreground">
                            {format(parseISO(selectedCase.report_due_date), 'dd MMM yyyy')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Days Remaining / Overdue</span>
                          {getUrgencyIndicator(selectedCase) || <span className="text-muted-foreground">—</span>}
                        </div>
                      </>
                    )}
                    {selectedCase.report_submitted_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Submitted</span>
                        <span className="text-success font-medium">
                          {format(parseISO(selectedCase.report_submitted_date), 'dd MMM yyyy')}
                        </span>
                      </div>
                    )}
                    <Separator />
                    {/* Progress Pipeline */}
                    <div className="space-y-2">
                      <span className="text-xs text-muted-foreground font-medium">Report Pipeline</span>
                      {['Scheduled', 'Assessed', 'Report In Progress', 'Submitted', 'Completed'].map((stage, i) => {
                        const currentStage = ['completed', 'taken_out', 'taken out'].includes(selectedCase.report_status?.toLowerCase()) ? 4 :
                          selectedCase.report_submitted_date ? 3 :
                          ['in_progress', 'in progress'].includes(selectedCase.report_status?.toLowerCase()) ? 2 :
                          new Date(selectedCase.appointment_date) < new Date() ? 1 : 0;
                        const isActive = i <= currentStage;
                        return (
                          <div key={stage} className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-success' : 'bg-muted'}`} />
                            <span className={`text-xs ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{stage}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* B. Documents Available */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> B. Documents Available
                  </CardTitle>
                  <CardDescription className="text-xs">Only documents relevant to your assessment are shown</CardDescription>
                </CardHeader>
                <CardContent>
                  {(!selectedCase.documents || selectedCase.documents.length === 0) ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No documents available yet</p>
                      <p className="text-xs">Documents will appear here once uploaded by the administrator</p>
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                      {Object.entries(categorizeDocuments(selectedCase.documents)).map(([category, docs]) => {
                        if (docs.length === 0) return null;
                        return (
                          <div key={category} className="space-y-2">
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{category}</h4>
                            <div className="space-y-1.5">
                              {docs.map(doc => (
                                <div key={doc.id} className="flex items-center gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                                  {getDocIcon(doc.document_type)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{doc.file_name}</p>
                                    <p className="text-[10px] text-muted-foreground">
                                      {doc.document_type}
                                      {doc.file_size && ` • ${(doc.file_size / 1024).toFixed(0)} KB`}
                                    </p>
                                  </div>
                                  <Badge variant="outline" className="text-[9px] shrink-0">
                                    {(() => {
                                      try { return format(new Date(doc.upload_date), 'dd MMM'); }
                                      catch { return ''; }
                                    })()}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* C. Report Submission Section */}
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Upload className="h-4 w-4 text-success" /> C. Report Submission
                  </CardTitle>
                  <CardDescription className="text-xs">Upload your report and add notes for this assessment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/20 rounded-lg p-6 text-center bg-muted/10">
                    <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground mb-1">
                      To upload your report, please log in to the full Expert Portal
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Or email your report to <span className="font-medium text-foreground">reports@kutlwanoandassociates.co.za</span>
                    </p>
                  </div>

                  {/* Expert Notes */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1">
                      <MessageSquare className="h-3.5 w-3.5" /> Add Notes
                    </label>
                    <Textarea
                      placeholder="Add any notes about this case or report progress..."
                      value={expertNotes}
                      onChange={(e) => setExpertNotes(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isSubmittingAction || !expertNotes.trim()}
                      onClick={() => handleAction('add_notes', selectedCase.id, { notes: expertNotes })}
                    >
                      {isSubmittingAction ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <MessageSquare className="h-3.5 w-3.5 mr-1" />}
                      Submit Notes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Button variant="outline" onClick={() => setSelectedCase(null)} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to All Cases
              </Button>

              {/* Footer */}
              <div className="text-center text-xs text-muted-foreground py-2">
                <p>Kutlwano & Associates (Pty) Ltd | Medico-Legal Service</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default ExpertCaseAccess;
