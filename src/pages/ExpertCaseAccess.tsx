import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Shield, KeyRound, Calendar, FileText, Clock, AlertCircle, CheckCircle2,
  XCircle, Loader2, Stethoscope, Lock, Search, User, Briefcase
} from 'lucide-react';
import { formatExpertType } from '@/utils/expertTypeMapping';
import { format } from 'date-fns';

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
  if (['completed', 'done', 'assessed'].includes(s))
    return <Badge className="bg-success/10 text-success border-success/20">{status}</Badge>;
  if (['scheduled', 'confirmed'].includes(s))
    return <Badge className="bg-info/10 text-info border-info/20">{status}</Badge>;
  if (s === 'cancelled')
    return <Badge variant="destructive">{status}</Badge>;
  return <Badge variant="secondary">{status || 'Scheduled'}</Badge>;
};

const ExpertCaseAccess: React.FC = () => {
  const [accessCode, setAccessCode] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [accessData, setAccessData] = useState<AccessResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredCases = useMemo(() => {
    if (!accessData) return [];
    return accessData.cases.filter(c =>
      c.claimant_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.matter_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.attorney_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [accessData, searchTerm]);

  const stats = useMemo(() => {
    if (!accessData) return null;
    const cases = accessData.cases;
    return {
      total: cases.length,
      pending: cases.filter(c => !['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())).length,
      completed: cases.filter(c => ['completed', 'taken_out', 'taken out'].includes(c.report_status?.toLowerCase())).length,
      upcoming: cases.filter(c => new Date(c.appointment_date) > new Date()).length,
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

  return (
    <>
      <Helmet>
        <title>Expert Case Access Portal - Medico-Legal Pro</title>
        <meta name="description" content="Medical experts: view your assigned cases, report deadlines and appointment details" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
        <header className="border-b bg-card sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
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

        <main className="max-w-6xl mx-auto px-4 py-8">
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
          {accessData && stats && (
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
                    <Button variant="outline" size="sm" onClick={() => { setAccessData(null); setAccessCode(''); }}>
                      Sign Out
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-xs text-muted-foreground">Total Cases</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-warning">{stats.pending}</p>
                    <p className="text-xs text-muted-foreground">Reports Pending</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-success">{stats.completed}</p>
                    <p className="text-xs text-muted-foreground">Reports Completed</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="py-4 text-center">
                    <p className="text-2xl font-bold text-info">{stats.upcoming}</p>
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                  </CardContent>
                </Card>
              </div>

              {/* Cases Table */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-3">
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCases.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No cases found
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredCases.map((c) => (
                            <TableRow key={c.id}>
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
                                    try {
                                      return format(new Date(c.appointment_date), 'dd MMM yyyy');
                                    } catch {
                                      return c.appointment_date;
                                    }
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
        </main>
      </div>
    </>
  );
};

export default ExpertCaseAccess;
