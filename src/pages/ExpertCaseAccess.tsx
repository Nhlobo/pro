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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, KeyRound, Calendar, FileText, Clock, AlertCircle, CheckCircle2,
  XCircle, Loader2, Stethoscope, Lock, Search, User, Briefcase, AlertTriangle,
  Eye, ArrowLeft, MapPin, Building2, DollarSign, TrendingUp
} from 'lucide-react';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { format, differenceInDays, parseISO } from 'date-fns';

interface CaseData {
  id: string;
  claimant_name: string;
  appointment_date: string;
  case_status: string;
  payment_status: string;
  matter_type: string;
  attorney_name: string;
  report_status: string;
  report_submitted_date: string | null;
  report_due_date: string | null;
  location?: string | null;
}

interface ExpertInfo {
  id: string;
  name: string;
  expert_type: string;
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

const ExpertCaseAccess: React.FC = () => {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [accessData, setAccessData] = useState<AccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);

  // Auto-fill from URL
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) setAccessCode(code);
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

  const getUrgencyIndicator = (c: CaseData) => {
    if (!c.report_due_date || ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())) return null;
    const days = differenceInDays(parseISO(c.report_due_date), new Date());
    if (days < 0) return <Badge className="bg-destructive text-destructive-foreground text-[9px]">Overdue {Math.abs(days)}d</Badge>;
    if (days <= 3) return <Badge className="bg-destructive/80 text-destructive-foreground text-[9px]">Critical {days}d</Badge>;
    if (days <= 7) return <Badge className="bg-warning text-warning-foreground text-[9px]">Urgent {days}d</Badge>;
    return <Badge className="bg-success/20 text-success text-[9px]">{days}d left</Badge>;
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
          {/* Code Entry */}
          {!accessData && (
            <div className="flex items-center justify-center min-h-[60vh]">
              <Card className="w-full max-w-md shadow-xl border-border/30">
                <CardHeader className="text-center space-y-3">
                  <div className="mx-auto p-4 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10">
                    <KeyRound className="h-10 w-10 text-primary" />
                  </div>
                  <CardTitle className="text-2xl">Expert Case Access</CardTitle>
                  <CardDescription className="text-base">
                    Enter your secure access code to view assigned cases, report deadlines, and appointment details.
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

          {/* Dashboard */}
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
                        <p className="text-sm text-muted-foreground">{formatExpertType(accessData.expert.expert_type)}</p>
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
                  { label: 'Total Cases', value: stats.total, icon: Briefcase, color: 'text-primary' },
                  { label: 'Upcoming', value: stats.upcoming, icon: Calendar, color: 'text-primary' },
                  { label: 'Reports Pending', value: stats.pending, icon: Clock, color: 'text-warning' },
                  { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-destructive' },
                  { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: 'text-success' },
                ].map(s => (
                  <Card key={s.label}>
                    <CardContent className="py-3 px-4 flex items-center gap-3">
                      <s.icon className={`h-5 w-5 ${s.color}`} />
                      <div>
                        <p className="text-xl font-bold text-foreground">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
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
                      <span className="text-sm font-medium">You have {stats.overdue} overdue report(s). Please prioritize submission.</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabs + Cases Table */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-lg">Assigned Cases</CardTitle>
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search cases..."
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
                          <TableHead>Date</TableHead>
                          <TableHead>Matter Type</TableHead>
                          <TableHead>Referring Attorney</TableHead>
                          <TableHead>Case Status</TableHead>
                          <TableHead>Report Status</TableHead>
                          <TableHead>Deadline</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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

          {/* Case Detail View (unauthenticated) */}
          {accessData && selectedCase && (
            <div className="space-y-6">
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

              <div className="grid md:grid-cols-2 gap-6">
                {/* Claimant Information */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Claimant Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground">Name of Claimant</span>
                      <p className="font-medium text-foreground">{selectedCase.claimant_name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Referring Attorney</span>
                      <p className="font-medium text-foreground">{selectedCase.attorney_name}</p>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Referred by</span>
                      <p className="font-medium text-foreground">Kutlwano & Associates</p>
                    </div>
                    <Separator />
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
                    <div>
                      <span className="text-xs text-muted-foreground">Matter Type</span>
                      <p className="font-medium text-foreground">{selectedCase.matter_type || 'General'}</p>
                    </div>
                    {selectedCase.location && (
                      <div>
                        <span className="text-xs text-muted-foreground">Location</span>
                        <p className="text-foreground text-xs flex items-center gap-1">
                          <Building2 className="h-3 w-3" />{selectedCase.location}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Report Status Tracking */}
                <Card className="border-border/50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4 text-warning" /> Report Status Tracking
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
                    {/* Progress pipeline */}
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
                            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success' : 'bg-muted'}`} />
                            <span className={`text-xs ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{stage}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-center">
                <p className="text-xs text-muted-foreground">
                  To upload reports, please use the full Expert Portal with your login credentials, or contact Kutlwano & Associates.
                </p>
              </div>

              <Button variant="outline" onClick={() => setSelectedCase(null)} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to All Cases
              </Button>
            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default ExpertCaseAccess;
